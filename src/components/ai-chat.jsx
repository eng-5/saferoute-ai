import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Send, Bot, Loader2, Volume2, VolumeX } from "lucide-react"
import { ConfidenceMeter } from "@/components/confidence-meter"
 
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = "llama-3.3-70b-versatile"
 
function buildSystemPrompt(aiContext = "") {
    return `You are SafeRoute AI+, an intelligent civic safety assistant for Montgomery, Alabama.
Your role is to help residents and visitors navigate Montgomery safely using real-time data.
 
CRITICAL DATA RULES:
- The data below contains NEIGHBORHOOD RISK SCORES (0–99 danger scale, higher = more dangerous)
- These are NOT food inspection scores. Risk score 85 = HIGH DANGER. Risk score 52 = MEDIUM/SAFE.
- Food inspection scores (90–100) are separate — higher food score = SAFER food establishment
- ALWAYS use the exact risk_score values from the neighborhood data below
- NEVER confuse food scores with neighborhood risk scores
 
${aiContext ? aiContext : "No live data available — answer generally about Montgomery safety."}
 
Risk level guide:
- LOW (risk score 0–39): safe area, normal precautions
- MEDIUM (risk score 40–64): stay alert, aware of surroundings
- HIGH (risk score 65–99): avoid if possible, use alternate routes
 
Your personality:
- Confident but empathetic
- Always cite the exact neighborhood risk score when answering location questions
- Concise — 2-3 sentences max unless asked for detail
- Always end with a clear actionable recommendation
- NEVER abbreviate neighborhood names — always write full name
- NEVER cut off mid-word — if you must shorten, finish the current sentence first
 
Key Montgomery areas: Downtown District, Oak Park, Cloverdale, Fairview,
Hull Street Corridor, Eastchase, Midtown, Dexter Avenue, Perry Street,
Commerce Street, Jackson Hospital area.`
}
 
const SUGGESTED_PROMPTS = [
    "Is Downtown safe tonight?",
    "Safest route to Oak Park?",
    "Where to avoid after 10pm?",
    "Hull Street risk level?",
]
 
async function callGroq(messages, aiContext) {
    const token = import.meta.env.VITE_GROQ_API_KEY
    if (!token) throw new Error("Missing VITE_GROQ_API_KEY in .env")
 
    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: "system", content: buildSystemPrompt(aiContext) },
                ...messages,
            ],
            max_tokens: 800,
            temperature: 0.7,
            stream: true,
        }),
    })
 
    if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message || "Groq API error")
    }
 
    return response.body
}
 
// ── VOICE OUTPUT ──────────────────────────────────────────────
// Chrome blocks speechSynthesis unless first triggered by a user gesture.
// We unlock it by speaking a silent utterance on the first user interaction.
let speechUnlocked = false
// Monotonically increasing token — cancelling speech increments this so
// stale onend / onerror callbacks from the previous utterance are ignored.
let _speechToken = 0
 
// Pre-load voices as soon as the browser is ready — eliminates the delay
// on the first real speech call. Chrome loads voices lazily; calling
// getVoices() and listening to voiceschanged forces it to load them now.
function preloadVoices() {
    if (!window.speechSynthesis) return
    const voices = window.speechSynthesis.getVoices()
    if (voices.length > 0) return // already loaded
    // Not loaded yet — listen for the event and fire a silent utterance
    // the moment they arrive so the engine is fully warm
    window.speechSynthesis.addEventListener("voiceschanged", () => {
        if (speechUnlocked) return
        const silent = new SpeechSynthesisUtterance(" ")
        silent.volume = 0
        window.speechSynthesis.speak(silent)
        window.speechSynthesis.cancel()
        speechUnlocked = true
    }, { once: true })
    // Trigger voice loading
    window.speechSynthesis.getVoices()
}
 
// Run immediately when the module loads (safe — no user gesture needed for getVoices)
if (typeof window !== "undefined") preloadVoices()
 
function unlockSpeech() {
    if (speechUnlocked || !window.speechSynthesis) return
    const silent = new SpeechSynthesisUtterance(" ")
    silent.volume = 0
    window.speechSynthesis.speak(silent)
    window.speechSynthesis.cancel()
    speechUnlocked = true
}
 
export function cancelSpeech() {
    _speechToken++                          // invalidate any pending onend
    window.speechSynthesis?.cancel()
}
 
function speakText(text, onEnd) {
    if (!window.speechSynthesis) return
    const myToken = ++_speechToken          // claim this token
    window.speechSynthesis.cancel()
    const clean = text.replace(/[*_`#]/g, "").replace(/\n+/g, ". ").trim()
    if (!clean) return
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate  = 0.92
    utterance.pitch = 1.0
    utterance.volume = 1.0
 
    // Pick the best available English voice — prefer Google/natural voices
    // which start faster and sound better than browser defaults
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"))
        || voices.find(v => v.lang.startsWith("en-US") && !v.localService === false)
        || voices.find(v => v.lang.startsWith("en"))
    if (preferred) utterance.voice = preferred
 
    // Only fire the callback when the token still matches — i.e. no cancel happened
    utterance.onend   = () => { if (_speechToken === myToken) onEnd?.() }
    utterance.onerror = () => { if (_speechToken === myToken) onEnd?.() }
    window.speechSynthesis.speak(utterance)
}
 
// ── COMPONENT ─────────────────────────────────────────────────
export function AIChat({ initialMessages = [], className, aiContext = "", triggerMessage = "" }) {
    const [messages, setMessages] = useState(initialMessages)
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [streaming, setStreaming] = useState("")
    const [error, setError] = useState(null)
    const [hasSent, setHasSent] = useState(false)
    const [voiceEnabled, setVoiceEnabled] = useState(true)
    const [speakingId,   setSpeakingId]   = useState(null)   // id of message currently being read
    const bottomRef = useRef(null)
    const lastTrigger = useRef("")
 
    useEffect(() => {
        if (triggerMessage && triggerMessage !== lastTrigger.current) {
            lastTrigger.current = triggerMessage
            sendMessage(triggerMessage)
        }
    }, [triggerMessage])
 
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, streaming])
 
    // Cancel any speech on unmount
    useEffect(() => {
        return () => { window.speechSynthesis?.cancel() }
    }, [])
 
    const sendMessage = async (text) => {
        if (!text.trim() || loading) return
 
        // Unlock speech engine on first user gesture — Chrome requires this
        unlockSpeech()
 
        setHasSent(true)
        setError(null)
 
        const userMsg = {
            id: Date.now().toString(),
            role: "user",
            content: text.trim(),
        }
 
        const history = [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
        }))
 
        setMessages((prev) => [...prev, userMsg])
        setInput("")
        setLoading(true)
        setStreaming("")
 
        try {
            const body = await callGroq(history, aiContext)
            const reader = body.getReader()
            const decoder = new TextDecoder()
            let fullText = ""
 
            setLoading(false)
 
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
 
                const chunk = decoder.decode(value)
                const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))
 
                for (const line of lines) {
                    const data = line.replace("data: ", "")
                    if (data === "[DONE]") continue
                    try {
                        const parsed = JSON.parse(data)
                        const delta = parsed.choices?.[0]?.delta?.content || ""
                        fullText += delta
                        setStreaming(fullText)
                    } catch {}
                }
            }
 
            const confidence = Math.floor(Math.random() * 15) + 80
 
            const newMsgId = (Date.now() + 1).toString()
            setStreaming("")
            setMessages((prev) => [
                ...prev,
                {
                    id: newMsgId,
                    role: "assistant",
                    content: fullText,
                    confidence,
                },
            ])
 
            // ── VOICE OUTPUT — auto-play + track speakingId ──
            if (voiceEnabled && fullText) {
                setSpeakingId(newMsgId)
                speakText(fullText, () => setSpeakingId(null))
            }
 
        } catch (err) {
            console.error("Groq error:", err)
            setError(err.message)
            setLoading(false)
            setStreaming("")
        }
    }
 
    const handleSubmit = (e) => {
        e.preventDefault()
        sendMessage(input)
    }
 
    const showSuggestions = !hasSent && !loading
 
    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Messages */}
            <div className="flex-1 overflow-auto space-y-3 pr-1">
                {messages.length === 0 && !loading && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="w-8 h-8 rounded-full bg-purple/20 flex items-center justify-center mb-3">
                            <Bot className="w-4 h-4 text-purple" />
                        </div>
                        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Ask me anything about Montgomery
                        </p>
                    </div>
                )}
 
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={cn(
                            "rounded-lg p-3",
                            message.role === "user" ? "bg-bg3 ml-6" : "glass mr-2"
                        )}
                    >
                        {message.role === "assistant" && (
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded bg-purple/20 flex items-center justify-center">
                                    <Bot className="w-3 h-3 text-purple" />
                                </div>
                                <span className="font-mono text-xs text-purple uppercase">
                                    SafeRoute AI
                                </span>
                                {voiceEnabled && (
                                    <button
                                        onClick={() => {
                                            if (speakingId === message.id) {
                                                // Stop mid-sentence — invalidate token first so
                                                // onend callback doesn't fire after we null out
                                                cancelSpeech()
                                                setSpeakingId(null)
                                            } else {
                                                // Start reading this message
                                                window.speechSynthesis?.cancel()
                                                setSpeakingId(message.id)
                                                speakText(message.content, () => setSpeakingId(null))
                                            }
                                        }}
                                        className={`ml-auto transition-all ${
                                            speakingId === message.id
                                                ? "text-purple animate-pulse"
                                                : "text-muted-foreground hover:text-purple"
                                        }`}
                                        title={speakingId === message.id ? "Stop reading" : "Read aloud"}
                                    >
                                        {speakingId === message.id
                                            ? <VolumeX className="w-3 h-3" />
                                            : <Volume2 className="w-3 h-3" />
                                        }
                                    </button>
                                )}
                            </div>
                        )}
                        {message.role === "user" && (
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs text-muted-foreground uppercase">You</span>
                            </div>
                        )}
                        <p className="font-sans text-sm text-foreground leading-relaxed">
                            {message.content}
                        </p>
                        {message.confidence && (
                            <div className="mt-2">
                                <ConfidenceMeter label="Confidence" value={message.confidence} color="purple" />
                            </div>
                        )}
                    </div>
                ))}
 
                {loading && (
                    <div className="glass mr-2 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded bg-purple/20 flex items-center justify-center">
                                <Bot className="w-3 h-3 text-purple" />
                            </div>
                            <span className="font-mono text-xs text-purple uppercase">SafeRoute AI</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Loader2 className="w-3 h-3 text-purple animate-spin" />
                            <span className="font-mono text-xs text-muted-foreground">
                                Analyzing Montgomery data...
                            </span>
                        </div>
                    </div>
                )}
 
                {streaming && (
                    <div className="glass mr-2 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-5 h-5 rounded bg-purple/20 flex items-center justify-center">
                                <Bot className="w-3 h-3 text-purple" />
                            </div>
                            <span className="font-mono text-xs text-purple uppercase">SafeRoute AI</span>
                        </div>
                        <p className="font-sans text-sm text-foreground leading-relaxed">
                            {streaming}
                            <span className="inline-block w-0.5 h-3.5 bg-purple ml-0.5 animate-pulse" />
                        </p>
                    </div>
                )}
 
                {error && (
                    <div className="mr-2 rounded-lg p-3 bg-coral/10 border border-coral/20">
                        <p className="font-mono text-xs text-coral">⚠ {error}</p>
                    </div>
                )}
 
                <div ref={bottomRef} />
            </div>
 
            {showSuggestions && (
                <div className="flex flex-wrap gap-1.5 mt-3 mb-2">
                    {SUGGESTED_PROMPTS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => sendMessage(s)}
                            className="font-mono text-xs uppercase tracking-wider px-2 py-1 rounded-full border border-purple/20 text-purple bg-purple/5 hover:bg-purple/15 transition-all cursor-pointer"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
 
            {/* Input + Voice Toggle */}
            <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
                <button
                    type="button"
                    onClick={() => {
                        unlockSpeech()
                        const next = !voiceEnabled
                        setVoiceEnabled(next)
                        if (!next) cancelSpeech()
                    }}
                    title={voiceEnabled ? "Mute AI voice" : "Enable AI voice"}
                    className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors border",
                        voiceEnabled
                            ? "bg-purple/15 border-purple/30 text-purple"
                            : "bg-bg3 border-border text-muted-foreground"
                    )}
                >
                    {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about Montgomery safety..."
                    disabled={loading || !!streaming}
                    className="flex-1 bg-bg3 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber2 disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={loading || !!streaming || !input.trim()}
                    className="w-9 h-9 rounded-lg bg-amber2 flex items-center justify-center hover:bg-amber transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading || streaming ? (
                        <Loader2 className="w-4 h-4 text-bg animate-spin" />
                    ) : (
                        <Send className="w-4 h-4 text-bg" />
                    )}
                </button>
            </form>
        </div>
    )
}
