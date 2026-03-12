import { useState, useRef, useEffect, useCallback } from "react"
import { useLocationSearch } from "@/lib/useLocationSearch"
import { BroadcastToast } from "@/components/broadcast-toast"
import { CommunityReportModal } from "@/components/community-report"
import { playBroadcastPing } from "@/lib/audio"
import { useNavigate } from "react-router-dom"
import { useSafety } from "@/context/SafetyContext"
import { MapBackground } from "@/components/map-background"
import { GlassPanel } from "@/components/glass-panel"
import { AIChat } from "@/components/ai-chat"
import {
    Search, Navigation, MapPin, Shield, AlertTriangle,
    History, TrendingUp, Activity, Zap, Mic, MicOff,
    Loader2, CheckCircle, Bot, X, Radio, Bell, Clock, Filter
} from "lucide-react"

// ── WEB SPEECH API TRANSCRIPTION ─────────────────────────────
function createSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return null
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognition.maxAlternatives = 1
    return recognition
}

// ── MAPBOX REVERSE GEOCODING ──────────────────────────────────
async function reverseGeocode(lat, lng) {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) return null
    try {
        const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=neighborhood,address,poi,place&limit=1&access_token=${token}`
        )
        const data = await res.json()
        return data.features?.[0] || null
    } catch { return null }
}

// ── MAPBOX FORWARD GEOCODING ──────────────────────────────────
async function forwardGeocode(query) {
    const token = import.meta.env.VITE_MAPBOX_TOKEN
    if (!token) return null
    try {
        const bbox = "-86.45,32.28,-86.18,32.50"
        const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?bbox=${bbox}&limit=1&access_token=${token}`
        )
        const data = await res.json()
        return data.features?.[0] || null
    } catch { return null }
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function DashboardPage() {
    const navigate   = useNavigate()
    const mapControl = useRef(null)

    const {
        aiContext, neighborhoods, fireIncidents = [],
        stats, hasLiveData, loading,
    } = useSafety()
    // complaints311 not in SafetyContext — derive from liveIncidents that aren't fire type
    const complaints311 = []

    const highRiskCount    = neighborhoods.filter(n => n.risk_level === "HIGH").length
    const safestArea       = [...neighborhoods].sort((a, b) => a.risk_score - b.risk_score)[0]
    const topIncident      = fireIncidents[0]
    const topComplaint     = complaints311[0]
    const displayFireCount = Math.min(fireIncidents.length, 25)

    // ── UI STATE ──────────────────────────────────────────────
    const [activeTab,      setActiveTab]      = useState("briefing")
    const [searchQuery,    setSearchQuery]    = useState("")
    const [clickedPlace,   setClickedPlace]   = useState(null)
    const [statusText,     setStatusText]     = useState("")
    const [triggerMsg,     setTriggerMsg]     = useState("")
    const [sidebarOpen,    setSidebarOpen]    = useState(true)
    const [lastUpdated,    setLastUpdated]    = useState(null)
    const [searchLoading,  setSearchLoading]  = useState(false)
    const [searchNotFound, setSearchNotFound] = useState(false)
    const [showReport,     setShowReport]     = useState(false)
    const [selectedZoneId, setSelectedZoneId] = useState(null)
    const [broadcastToast, setBroadcastToast] = useState(null)
    const [showSpaceHint,  setShowSpaceHint]  = useState(true)
    const [pulseCount,     setPulseCount]     = useState(0)
    const [searchOpen,     setSearchOpen]     = useState(false)
    const dashSearch = useLocationSearch()
    const searchWrapRef = useRef(null)

    // ── WEB SPEECH API VOICE STATE ────────────────────────────
    const [voiceState,     setVoiceState]     = useState("idle") // idle | listening | ready
    const [interimText,    setInterimText]    = useState("")
    const [finalText,      setFinalText]      = useState("")
    const [voiceError,     setVoiceError]     = useState("")
    const recognitionRef   = useRef(null)

    // ── JOURNEY HISTORY ───────────────────────────────────────
    const [journeyHistory] = useState(() => {
        try { return JSON.parse(localStorage.getItem("saferoute_journeys") || "[]") }
        catch { return [] }
    })

    useEffect(() => {
        if (hasLiveData) setLastUpdated(new Date())
    }, [hasLiveData])

    // ── TAB TITLE — live incident count ───────────────────────
    useEffect(() => {
        const count = fireIncidents.length + complaints311.length
        document.title = count > 0
            ? `⚠️ ${count} Active — SafeRoute AI+`
            : "SafeRoute AI+ · Montgomery"
        return () => { document.title = "SafeRoute AI+" }
    }, [fireIncidents.length, complaints311.length])

    // ── SEARCH DROPDOWN close on outside click ──────────────
    useEffect(() => {
        const h = (e) => { if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) setSearchOpen(false) }
        document.addEventListener("mousedown", h)
        return () => document.removeEventListener("mousedown", h)
    }, [])

    // ── SPACE HINT — fades after 5s ───────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setShowSpaceHint(false), 5000)
        return () => clearTimeout(t)
    }, [])

    // ── LIVE PULSE — incident count ticks every 60s ───────────
    useEffect(() => {
        const iv = setInterval(() => setPulseCount(c => c + 1), 60000)
        return () => clearInterval(iv)
    }, [])

    // ── Keyboard shortcut: Space = toggle voice ───────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
                e.preventDefault()
                if (voiceState === "listening") stopListening()
                else if (voiceState === "idle") startListening()
            }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [voiceState])

    // ── STATUS TEXT ───────────────────────────────────────────
    useEffect(() => {
        if (clickedPlace) {
            setStatusText(
                clickedPlace.risk
                    ? `${clickedPlace.shortName} — ${clickedPlace.risk.level} RISK`
                    : clickedPlace.shortName
            )
            return
        }
        if (loading)             { setStatusText("Loading Data..."); return }
        if (highRiskCount > 4)    setStatusText("Elevated Risk — Avoid Downtown")
        else if (highRiskCount > 2) setStatusText("Monitor Active — Stay Alert")
        else                      setStatusText("Systems Nominal")
    }, [loading, highRiskCount, clickedPlace])

    // ── MAP CLICK ─────────────────────────────────────────────
    const handleMapClick = useCallback(async ({ lat, lng }) => {
        const feature   = await reverseGeocode(lat, lng)
        const fullName  = feature?.place_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        const shortName = feature?.text || fullName.split(",")[0] || "Unknown Area"

        const nearest = neighborhoods.length
            ? neighborhoods.reduce((closest, n) => {
                const d1 = Math.abs((n.lat || 32.38) - lat) + Math.abs((n.lng || -86.30) - lng)
                const d2 = Math.abs((closest.lat || 32.38) - lat) + Math.abs((closest.lng || -86.30) - lng)
                return d1 < d2 ? n : closest
            })
            : null

        setSearchQuery(shortName)
        setClickedPlace({
            shortName, fullName, lat, lng,
            risk: nearest ? { level: nearest.risk_level, score: nearest.risk_score, name: nearest.name } : null,
        })
        setTriggerMsg(`What is the safety situation at or near "${shortName}" in Montgomery, Alabama? ${Date.now()}`)
        setActiveTab("briefing")
        setSidebarOpen(true)
    }, [neighborhoods])

    // ── SEARCH ────────────────────────────────────────────────
    const handleSearchSubmit = useCallback(async () => {
        const q = searchQuery.trim()
        if (!q) return
        setSearchLoading(true)
        setSearchNotFound(false)

        const query   = q.toLowerCase().includes("montgomery") ? q : `${q}, Montgomery Alabama`
        const feature = await forwardGeocode(query)

        if (!feature) {
            setSearchNotFound(true)
            setSearchLoading(false)
            return
        }

        const [lng, lat] = feature.center
        const shortName  = feature.text || q
        const fullName   = feature.place_name || q

        const nearest = neighborhoods.length
            ? neighborhoods.reduce((closest, n) => {
                const d1 = Math.abs((n.lat || 32.38) - lat) + Math.abs((n.lng || -86.30) - lng)
                const d2 = Math.abs((closest.lat || 32.38) - lat) + Math.abs((closest.lng || -86.30) - lng)
                return d1 < d2 ? n : closest
            })
            : null

        mapControl.current?.flyTo(lat, lng, 16)
        setTimeout(() => mapControl.current?.placeMarker(lat, lng), 400)

        setClickedPlace({
            shortName, fullName, lat, lng,
            risk: nearest ? { level: nearest.risk_level, score: nearest.risk_score, name: nearest.name } : null,
        })
        setStatusText(nearest ? `${shortName} — ${nearest.risk_level} RISK (${nearest.risk_score}/99)` : shortName)
        setTriggerMsg(`What is the safety situation at or near "${shortName}" in Montgomery? Include risk scores and incident data. ${Date.now()}`)
        setActiveTab("briefing")
        setSidebarOpen(true)
        setSearchLoading(false)
    }, [searchQuery, neighborhoods])

    // ── SAFE ZONE CLICK — flyTo + pulse + AI auto-brief ─────────
    const handleSafeZoneClick = useCallback((zone) => {
        const lat = zone.coordinates ? zone.coordinates[1] : (zone.lat || 32.3654)
        const lng = zone.coordinates ? zone.coordinates[0] : (zone.lng || -86.2891)
        setSelectedZoneId(zone.id)
        mapControl.current?.flyTo(lat, lng, 15)
        setTimeout(() => mapControl.current?.pulseZone(lat, lng), 900)
        const riskScore = zone.risk_score ?? zone.confidence ?? "—"
        const msg = `Give me a detailed safety briefing for ${zone.name} in Montgomery, Alabama. ` +
            `Current risk score: ${riskScore}/99. Risk level: ${zone.level || zone.risk_level}. ` +
            `Include any active incidents nearby and whether it is currently safe to be there. ` +
            `Be specific and use the live data you have. ${Date.now()}`
        setTriggerMsg(msg)
        setActiveTab("briefing")
        setSidebarOpen(true)
    }, [])

    const handleSafeZoneButton = useCallback(() => {
        // Find the safest zone and brief it
        const zones = neighborhoods.length
            ? neighborhoods.map(n => ({ ...n, coordinates: [n.lng || -86.30, n.lat || 32.38] }))
            : [{ id: "cloverdale", name: "Cloverdale", level: "LOW", risk_score: 22, coordinates: [-86.2891, 32.3654] }]
        const safest = zones.reduce((a, b) => (a.risk_score ?? 99) < (b.risk_score ?? 99) ? a : b)
        handleSafeZoneClick(safest)
        // Also auto-query all safe zones
        const allZonesMsg = `List all safe zones in Montgomery tonight. For each zone give the name, ` +
            `risk score out of 99, risk level (LOW/MEDIUM/HIGH), and a one-sentence safety note. ` +
            `Sort by safest first. Use the live data you have. ${Date.now()}`
        setTimeout(() => setTriggerMsg(allZonesMsg), 100)
    }, [neighborhoods, handleSafeZoneClick])

    // ── WEB SPEECH API VOICE ──────────────────────────────────
    const startListening = () => {
        setVoiceError("")
        setInterimText("")
        setFinalText("")

        const recognition = createSpeechRecognition()
        if (!recognition) {
            setVoiceError("Speech recognition not supported in this browser. Try Chrome.")
            return
        }

        recognitionRef.current = recognition

        recognition.onresult = (event) => {
            let interim = ""
            let final = ""
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript
                if (event.results[i].isFinal) {
                    final += transcript
                } else {
                    interim += transcript
                }
            }
            setInterimText(interim)
            if (final) {
                setFinalText(prev => prev + final)
                setInterimText("")
            }
        }

        recognition.onend = () => {
            setVoiceState(prev => {
                if (prev === "listening") {
                    // Check if we got something
                    setFinalText(text => {
                        if (text.trim()) {
                            setVoiceState("ready")
                        } else {
                            setVoiceError("No speech detected — try again")
                            setVoiceState("idle")
                        }
                        return text
                    })
                }
                return prev
            })
        }

        recognition.onerror = (event) => {
            if (event.error === "not-allowed") {
                setVoiceError("Microphone permission denied")
            } else if (event.error !== "no-speech") {
                setVoiceError(`Error: ${event.error}`)
            }
            setVoiceState("idle")
        }

        recognition.start()
        setVoiceState("listening")
    }

    const stopListening = () => {
        recognitionRef.current?.stop()
    }

    const handleVoiceToggle = () => {
        if (voiceState === "listening") stopListening()
        else if (voiceState === "idle") startListening()
    }

    const handleVoiceSubmit = () => {
        const text = finalText.trim()
        if (!text) return
        setTriggerMsg(text + " __" + Date.now())
        setVoiceState("idle")
        setFinalText("")
        setInterimText("")
        setActiveTab("briefing")
    }

    const handleVoiceDiscard = () => {
        recognitionRef.current?.abort()
        setFinalText("")
        setInterimText("")
        setVoiceError("")
        setVoiceState("idle")
    }

    // ── COMMUNITY REPORT ──────────────────────────────────────
    const handleCommunityReport = () => setShowReport(true)

    const handleReportSubmitted = useCallback((report) => {
        // Play soft ping sound — delayed to sync with BroadcastToast 1.8s slide-in animation
        setTimeout(() => playBroadcastPing(), 1800)
        // Drop marker on map immediately
        if (report.location?.lat && report.location?.lng) {
            mapControl.current?.addCommunityMarker({
                lat: report.location.lat,
                lng: report.location.lng,
                category: report.type,
                label: report.label || report.type,
                timestamp: Date.now(),
                anonymous: true,
            })
        }
        // Simulate broadcast — another user nearby filed a report
        // Toast is now managed by BroadcastToast component (45s lifetime)
        setBroadcastToast(report)
    }, [])

    // ── STATUS DOT ────────────────────────────────────────────
    const dotColor = loading                             ? "bg-muted-foreground"
        : clickedPlace?.risk?.level === "HIGH"           ? "bg-coral"
        : clickedPlace?.risk?.level === "MEDIUM"         ? "bg-amber"
        : highRiskCount > 4                              ? "bg-coral"
        : highRiskCount > 2                              ? "bg-amber"
        :                                                  "bg-mint"

    return (
        <div className="h-full relative flex flex-col md:flex-row">

            {/* ── BROADCAST TOAST ──────────────────────────────── */}
            {broadcastToast && (
                <BroadcastToast
                    report={broadcastToast}
                    onDismiss={() => setBroadcastToast(null)}
                    onFlyTo={(lat, lng) => {
                        mapControl.current?.flyTo(lat, lng, 17)
                        setBroadcastToast(null)
                    }}
                />
            )}

            {/* ── SPACE HINT ────────────────────────────────────── */}
            {showSpaceHint && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 transition-opacity duration-1000 pointer-events-none">
                    <div className="glass rounded-full px-4 py-2 border border-amber/20 flex items-center gap-2">
                        <Mic className="w-3 h-3 text-amber" />
                        <span className="font-mono text-xs text-amber/70 uppercase tracking-wider">
                            Press <kbd className="px-1.5 py-0.5 rounded bg-bg3 border border-border/50 text-[11px]">Space</kbd> to ask AI anything
                        </span>
                    </div>
                </div>
            )}

            {/* ══ MAP COLUMN ════════════════════════════════════ */}
            <div className="flex-1 relative min-h-[45vh] md:min-h-0">
                <MapBackground
                    showHeatmap showGrid
                    neighborhoods={neighborhoods}
                    fireIncidents={fireIncidents}
                    onMapClick={handleMapClick}
                    mapControlRef={mapControl}
                >
                    {/* TOP LEFT — Status + Search */}
                    <div className="absolute top-3 left-3 z-20 space-y-2 w-[min(calc(100vw-130px),340px)]">
                        <GlassPanel className="px-3 py-2">
                            <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                Current Status
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor} animate-pulse`} />
                                <span className="font-mono text-xs md:text-xs text-foreground uppercase tracking-wider truncate flex-1">
                                    {statusText}
                                </span>
                                {clickedPlace && (
                                    <button
                                        onClick={() => { setClickedPlace(null); setSearchQuery("") }}
                                        className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            {clickedPlace?.risk && (
                                <p className={`mt-1 font-mono text-xs ${
                                    clickedPlace.risk.level === "HIGH"   ? "text-coral" :
                                    clickedPlace.risk.level === "MEDIUM" ? "text-amber" : "text-mint"
                                }`}>
                                    Nearest: {clickedPlace.risk.name} ({clickedPlace.risk.score}/99 danger)
                                </p>
                            )}
                        </GlassPanel>

                        <div className="flex gap-1.5" ref={searchWrapRef}>
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none z-10" />
                                <input
                                    type="text"
                                    value={searchQuery || dashSearch.query}
                                    onChange={e => {
                                        setSearchQuery(e.target.value)
                                        dashSearch.setQuery(e.target.value)
                                        setSearchNotFound(false)
                                        setSearchOpen(true)
                                    }}
                                    onFocus={() => setSearchOpen(true)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") { setSearchOpen(false); handleSearchSubmit() }
                                        if (e.key === "Escape") setSearchOpen(false)
                                    }}
                                    placeholder="Search Montgomery safety zones..."
                                    className={`w-full glass rounded-xl pl-9 pr-3 py-2 text-foreground placeholder:text-muted-foreground font-sans text-xs focus:outline-none focus:ring-1 ${
                                        searchNotFound ? "focus:ring-coral/50 ring-1 ring-coral/30" : "focus:ring-amber2"
                                    }`}
                                />
                                {searchNotFound && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-coral">Not found</span>
                                )}
                                {/* Autocomplete dropdown */}
                                {searchOpen && dashSearch.results.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-bg2 border border-border rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                                        {dashSearch.showLandmarks && (
                                            <div className="px-3 py-1.5 border-b border-border/30">
                                                <span className="font-mono text-[11px] text-muted-foreground/50 uppercase">Suggested</span>
                                            </div>
                                        )}
                                        {dashSearch.results.map((r, i) => (
                                            <button key={r.id || i}
                                                onClick={() => {
                                                    setSearchQuery(r.text)
                                                    dashSearch.select(r)
                                                    setSearchOpen(false)
                                                    // Fly map to result
                                                    if (r.center) {
                                                        const [lng, lat] = r.center
                                                        mapControl.current?.flyTo(lat, lng, 16)
                                                        setTimeout(() => mapControl.current?.placeMarker(lat, lng), 400)
                                                        setTriggerMsg(`What is the safety situation at "${r.text}" in Montgomery? Include risk score and any nearby incidents. ${Date.now()}`)
                                                        setSidebarOpen(true)
                                                        setActiveTab("briefing")
                                                    }
                                                }}
                                                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-bg3 transition-colors text-left border-b border-border/20 last:border-0">
                                                <MapPin className="w-3 h-3 text-sky flex-shrink-0 mt-0.5" />
                                                <div className="min-w-0">
                                                    <div className="font-sans text-xs text-foreground truncate">{r.text}</div>
                                                    <div className="font-mono text-xs text-muted-foreground/60 truncate">{r.place_name}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => { setSearchOpen(false); handleSearchSubmit() }}
                                disabled={!searchQuery.trim() || searchLoading}
                                className="flex-shrink-0 w-9 h-9 glass rounded-xl flex items-center justify-center text-amber2 hover:bg-amber2/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-amber2/20 hover:border-amber2/40"
                            >
                                {searchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>

                    {/* TOP RIGHT — Live Badge */}
                    <div className="absolute top-3 right-14 md:right-16 z-20 flex flex-col items-end gap-1.5">
                        <GlassPanel className={`px-2 py-1 flex items-center gap-1.5 transition-opacity ${!hasLiveData && "opacity-40"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasLiveData ? "bg-mint animate-pulse" : "bg-muted-foreground"}`} />
                            <span className="font-mono text-[11px] text-mint uppercase tracking-wider hidden sm:block">
                                {hasLiveData ? "Live Data Active" : "Static Mode"}
                            </span>
                        </GlassPanel>
                        {lastUpdated && (
                            <span className="font-mono text-[11px] text-muted-foreground/60 hidden sm:block">
                                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        )}
                    </div>

                    {/* BOTTOM LEFT — Risk Legend */}
                    <div className="absolute bottom-16 left-3 z-20">
                        <GlassPanel className="px-2.5 py-2 space-y-1">
                            <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
                                Risk Scale
                            </div>
                            {[
                                { color: "bg-coral",  label: "High",   glow: "shadow-[0_0_6px_#FF6B4A]" },
                                { color: "bg-amber",  label: "Medium", glow: "shadow-[0_0_6px_#FBBF24]" },
                                { color: "bg-mint",   label: "Low",    glow: "shadow-[0_0_6px_#00E5A0]" },
                                { color: "bg-amber2", label: "Tapped", glow: "shadow-[0_0_6px_#FB923C]" },
                            ].map(({ color, label, glow }) => (
                                <div key={label} className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color} ${glow}`} />
                                    <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
                                </div>
                            ))}
                        </GlassPanel>
                    </div>

                    {/* MOBILE — Sidebar Toggle */}
                    <button
                        onClick={() => setSidebarOpen(o => !o)}
                        className="absolute bottom-3 right-3 z-20 md:hidden glass rounded-xl px-3 py-2 flex items-center gap-2"
                    >
                        <span className="font-mono text-xs text-amber2 uppercase">
                            {sidebarOpen ? "Hide Intel" : "Show Intel"}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full bg-amber2 ${sidebarOpen ? "" : "animate-pulse"}`} />
                    </button>

                    {/* BOTTOM — Voice Bar */}
                    <div className="absolute bottom-3 left-3 right-16 md:right-auto md:max-w-sm z-20">
                        <DashboardVoiceBar
                            voiceState={voiceState}
                            interimText={interimText}
                            finalText={finalText}
                            voiceError={voiceError}
                            onToggle={handleVoiceToggle}
                        />
                    </div>
                </MapBackground>
            </div>

            {/* ══ RIGHT SIDEBAR ════════════════════════════════ */}
            <aside className={`w-full md:w-[320px] lg:w-[380px] flex-shrink-0 bg-bg2 border-l border-border flex flex-col z-30 max-h-[55vh] md:max-h-none transition-all ${
                sidebarOpen ? "flex" : "hidden md:flex"
            }`}>

                <div className="flex border-b border-border flex-shrink-0">
                    {["briefing", "live-intel", "history"].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 md:py-3 font-mono text-xs md:text-xs uppercase tracking-wider transition-colors ${
                                activeTab === tab
                                    ? "text-amber2 bg-bg3 border-b-2 border-amber2"
                                    : "text-muted-foreground hover:text-foreground hover:bg-bg3/50"
                            }`}>
                            {tab.replace("-", " ")}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">

                    {/* ── BRIEFING TAB ── */}
                    {activeTab === "briefing" && (
                        <>
                            <section>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-serif italic text-base md:text-lg text-foreground">
                                        {clickedPlace ? clickedPlace.shortName.split(",")[0] : "AI Safety Briefing"}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full bg-mint/10 border border-mint/20 font-mono text-[11px] text-mint uppercase">
                                        {hasLiveData ? "Live" : "Static"}
                                    </span>
                                </div>
                                <AIChat
                                    key={neighborhoods.some(n => n.risk_score > 25) ? "loaded" : "loading"}
                                    aiContext={aiContext}
                                    triggerMessage={triggerMsg}
                                    initialMessages={[{
                                        id: "1",
                                        role: "assistant",
                                        content: neighborhoods.some(n => n.risk_score > 25)
                                            ? `Montgomery: ${highRiskCount} of ${neighborhoods.length} neighborhoods are HIGH danger. Safest area: ${safestArea?.name} (score ${safestArea?.risk_score}/99). Tap the mic or type to ask about any area.`
                                            : "SafeRoute AI ready — tap the mic or ask about any Montgomery area.",
                                        confidence: hasLiveData ? 94 : 78,
                                    }]}
                                />
                            </section>

                            {/* Voice Panel */}
                            {(voiceState !== "idle" || finalText || voiceError) && (
                                <div className={`rounded-lg p-3 border transition-all ${
                                    voiceState === "listening" ? "border-coral/40 bg-coral/5"  :
                                    voiceState === "ready"     ? "border-purple/40 bg-purple/5":
                                    voiceError                 ? "border-coral/30 bg-coral/5"  :
                                    "border-border/50 bg-bg3"
                                }`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {voiceState === "listening" && <>
                                            <span className="w-2 h-2 rounded-full bg-coral animate-pulse" />
                                            <span className="font-mono text-xs text-coral uppercase">Listening...</span>
                                            <div className="ml-auto flex gap-0.5 items-end">
                                                {[8,14,10,16,9].map((h, i) => (
                                                    <div key={i} className="w-0.5 rounded-full bg-coral animate-pulse"
                                                        style={{ height: h, animationDelay: `${i * 0.12}s` }} />
                                                ))}
                                            </div>
                                        </>}
                                        {voiceState === "ready" && <>
                                            <Mic className="w-3 h-3 text-purple" />
                                            <span className="font-mono text-xs text-purple uppercase">Review & send</span>
                                            <button onClick={handleVoiceDiscard} className="ml-auto text-muted-foreground hover:text-foreground">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </>}
                                        {voiceError && <>
                                            <span className="font-mono text-xs text-coral uppercase">Error</span>
                                            <button onClick={handleVoiceDiscard} className="ml-auto text-muted-foreground hover:text-foreground">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </>}
                                    </div>

                                    {interimText && (
                                        <p className="font-sans text-xs text-muted-foreground italic mb-2">{interimText}</p>
                                    )}

                                    {voiceState === "ready" && (
                                        <>
                                            <textarea
                                                value={finalText}
                                                onChange={e => setFinalText(e.target.value)}
                                                rows={2}
                                                className="w-full bg-bg3 rounded-lg px-3 py-2 text-sm text-foreground font-sans leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-purple/40 mb-2"
                                            />
                                            <div className="flex gap-2">
                                                <button onClick={handleVoiceDiscard}
                                                    className="flex-1 py-1.5 rounded-lg border border-border text-muted-foreground font-mono text-xs uppercase hover:border-coral/40 hover:text-coral transition-colors">
                                                    Discard
                                                </button>
                                                <button onClick={handleVoiceSubmit}
                                                    className="flex-1 py-1.5 rounded-lg bg-purple/15 border border-purple/30 text-purple font-mono text-xs uppercase hover:bg-purple/25 transition-colors flex items-center justify-center gap-1.5">
                                                    <Bot className="w-3 h-3" />
                                                    Send to AI
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    {voiceError && <p className="font-mono text-xs text-coral">{voiceError}</p>}
                                </div>
                            )}

                            <p className="font-mono text-[11px] text-muted-foreground/40 text-center">
                                Press{" "}
                                <kbd className="px-1 py-0.5 rounded bg-bg3 border border-border/50">Space</kbd>
                                {" "}to start/stop voice
                            </p>

                            {/* Safe Zones List */}
                            <section className="space-y-2">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="font-mono text-xs text-muted-foreground uppercase">Safety Zones</h4>
                                    <span className="font-mono text-[11px] text-muted-foreground/50">Click to brief</span>
                                </div>
                                {(neighborhoods.length
                                    ? [...neighborhoods].sort((a,b) => (a.risk_score??99)-(b.risk_score??99))
                                    : [
                                        {id:"cloverdale",name:"Cloverdale",risk_level:"LOW",risk_score:22,coordinates:[-86.2891,32.3654]},
                                        {id:"fairview",name:"Fairview",risk_level:"MEDIUM",risk_score:48,coordinates:[-86.3312,32.3543]},
                                        {id:"oakpark",name:"Oak Park",risk_level:"MEDIUM",risk_score:55,coordinates:[-86.3198,32.3901]},
                                        {id:"downtown",name:"Downtown District",risk_level:"HIGH",risk_score:78,coordinates:[-86.3012,32.3769]},
                                        {id:"hull",name:"Hull Street Corridor",risk_level:"HIGH",risk_score:84,coordinates:[-86.2956,32.3834]},
                                    ]
                                ).map(zone => {
                                    const level = zone.risk_level || zone.level || "LOW"
                                    const score = zone.risk_score ?? "—"
                                    const isSelected = selectedZoneId === zone.id
                                    const incidentCount = fireIncidents.filter(inc => {
                                        if (!inc.coordinates) return false
                                        const dlat = Math.abs(inc.coordinates[1] - (zone.lat || (zone.coordinates?.[1]) || 32.38))
                                        const dlng = Math.abs(inc.coordinates[0] - (zone.lng || (zone.coordinates?.[0]) || -86.30))
                                        return dlat < 0.02 && dlng < 0.02
                                    }).length
                                    return (
                                        <button key={zone.id}
                                            onClick={() => handleSafeZoneClick({
                                                ...zone,
                                                coordinates: zone.coordinates || [zone.lng || -86.30, zone.lat || 32.38],
                                                level: level,
                                            })}
                                            className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left group ${
                                                isSelected
                                                    ? level === "HIGH"   ? "border-coral/50 bg-coral/8"
                                                    : level === "MEDIUM" ? "border-amber/50 bg-amber/8"
                                                    :                      "border-mint/50  bg-mint/8"
                                                    : "border-border/30 hover:border-border/60 bg-transparent"
                                            }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                level === "HIGH" ? "bg-coral" : level === "MEDIUM" ? "bg-amber" : "bg-mint"
                                            } ${isSelected ? "animate-pulse" : ""}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-mono text-xs text-foreground truncate">{zone.name}</div>
                                                <div className="font-mono text-[11px] text-muted-foreground/60">{score}/99 danger</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-0.5">
                                                <span className={`font-mono text-[7px] uppercase px-1.5 py-0.5 rounded-full ${
                                                    level === "HIGH"   ? "bg-coral/15 text-coral" :
                                                    level === "MEDIUM" ? "bg-amber/15 text-amber" : "bg-mint/15 text-mint"
                                                }`}>{level}</span>
                                                {incidentCount > 0 && (
                                                    <span className="font-mono text-[7px] text-coral">{incidentCount} inc.</span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </section>

                            {/* Stats */}
                            <section className="space-y-2">
                                <h4 className="font-mono text-xs text-muted-foreground uppercase">Local Insights</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <StatCard icon={Activity} label="High Risk Zones"
                                        value={loading ? "..." : `${highRiskCount}`} color="coral" />
                                    <StatCard icon={Zap} label="Live Incidents"
                                        value={loading ? "..." : `${displayFireCount}`} color="amber" />
                                </div>
                            </section>
                        </>
                    )}

                    {/* ── LIVE INTEL TAB ── */}
                    {activeTab === "live-intel" && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-coral border-b border-coral/20 pb-2">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="font-mono text-xs uppercase">
                                    Active Alerts ({fireIncidents.length + complaints311.length})
                                </span>
                            </div>

                            {fireIncidents.slice(0, 4).map((inc, i) => (
                                <GlassPanel key={`f-${i}`} className="p-3 border-l-2 border-l-coral">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-sans text-xs font-medium text-foreground">
                                            {inc.type || "Fire/Rescue Incident"}
                                        </span>
                                        <span className="font-mono text-[11px] text-coral uppercase ml-2 flex-shrink-0">Live</span>
                                    </div>
                                    <p className="font-sans text-xs text-muted-foreground">
                                        {inc.address || inc.district || "Montgomery, AL"}
                                        {inc.category ? ` — ${inc.category}` : ""}
                                    </p>
                                </GlassPanel>
                            ))}

                            {complaints311.slice(0, 3).map((c, i) => (
                                <GlassPanel key={`c-${i}`} className="p-3 border-l-2 border-l-amber">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-sans text-xs font-medium text-foreground">
                                            {c.type || "311 Service Request"}
                                        </span>
                                        <span className="font-mono text-[11px] text-amber uppercase ml-2 flex-shrink-0">Open</span>
                                    </div>
                                    <p className="font-sans text-xs text-muted-foreground">
                                        {c.status || "Active request — Montgomery"}
                                    </p>
                                </GlassPanel>
                            ))}

                            {!fireIncidents.length && !complaints311.length && (
                                <div className="text-center py-8">
                                    <CheckCircle className="w-8 h-8 text-mint/40 mx-auto mb-2" />
                                    <p className="font-mono text-xs text-muted-foreground uppercase">No active alerts</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── HISTORY TAB ── */}
                    {activeTab === "history" && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sky border-b border-sky/20 pb-2">
                                <History className="w-4 h-4" />
                                <span className="font-mono text-xs uppercase">Past Journeys</span>
                            </div>

                            {journeyHistory.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-12 h-12 rounded-full bg-sky/10 border border-sky/20 flex items-center justify-center mx-auto mb-3">
                                        <Navigation className="w-5 h-5 text-sky opacity-40" />
                                    </div>
                                    <p className="font-mono text-xs text-muted-foreground uppercase mb-1">No journeys yet</p>
                                    <p className="font-sans text-xs text-muted-foreground/60 mb-4">
                                        Complete your first SafeJourney to see history here.
                                    </p>
                                    <button onClick={() => navigate("/journey")}
                                        className="px-4 py-2 rounded-lg bg-mint/10 border border-mint/20 text-mint font-mono text-xs uppercase tracking-wider hover:bg-mint/20 transition-colors">
                                        Start First Journey
                                    </button>
                                </div>
                            ) : (
                                journeyHistory.map((j, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-bg3 rounded-lg border border-border/50">
                                        <div>
                                            <div className="font-sans text-xs text-foreground">{j.from} → {j.to}</div>
                                            <div className="font-mono text-xs text-muted-foreground mt-1">
                                                {j.date} • {j.duration}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`font-mono text-xs ${j.outcome === "SAFE" ? "text-mint" : "text-amber"}`}>
                                                {j.outcome || "SAFE"}
                                            </div>
                                            <TrendingUp className="w-3 h-3 text-mint ml-auto mt-1" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* ── FOOTER BUTTONS ─────────────────────────── */}
                <div className="p-3 md:p-4 bg-bg3 border-t border-border flex-shrink-0">
                    <div className="flex gap-2">
                        <button onClick={() => navigate("/journey")}
                            className="flex-1 flex flex-col items-center justify-center p-2.5 md:p-3 glass-dark hover:bg-bg2 transition-all group rounded-lg">
                            <Navigation className="w-4 h-4 md:w-5 md:h-5 text-mint mb-1 group-hover:scale-110 transition-transform" />
                            <span className="font-mono text-[7px] md:text-[11px] text-muted-foreground">START TRIP</span>
                        </button>

                        <button onClick={handleSafeZoneButton}
                            className={`flex-1 flex flex-col items-center justify-center p-2.5 md:p-3 glass-dark hover:bg-sky/5 transition-all group rounded-lg ${
                                selectedZoneId ? "border border-sky/30 bg-sky/5" : ""
                            }`}>
                            <MapPin className={`w-4 h-4 md:w-5 md:h-5 mb-1 group-hover:scale-110 transition-transform ${
                                selectedZoneId ? "text-sky" : "text-sky"
                            }`} />
                            <span className="font-mono text-[7px] md:text-[11px] text-muted-foreground">SAFE ZONE</span>
                        </button>

                        {/* Live Pulse — replaces Guardian */}
                        <div className="flex-1 flex flex-col items-center justify-center p-2.5 md:p-3 glass-dark rounded-lg relative overflow-hidden">
                            <div className="absolute inset-0 bg-coral/3 animate-pulse rounded-lg" />
                            <div className="relative z-10 flex flex-col items-center">
                                <div className="flex items-center gap-1 mb-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-coral animate-pulse" />
                                    <span className={`font-mono text-xs md:text-sm font-bold text-coral transition-all`}>
                                        {fireIncidents.length + complaints311.length}
                                    </span>
                                </div>
                                <span className="font-mono text-[7px] md:text-[11px] text-muted-foreground">LIVE</span>
                            </div>
                        </div>

                        <button onClick={handleCommunityReport}
                            className="flex-1 flex flex-col items-center justify-center p-2.5 md:p-3 glass-dark hover:bg-coral/5 transition-all group rounded-lg">
                            <Radio className="w-4 h-4 md:w-5 md:h-5 text-coral mb-1 group-hover:scale-110 transition-transform" />
                            <span className="font-mono text-[7px] md:text-[11px] text-muted-foreground">REPORT</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── COMMUNITY REPORT MODAL ──────────────────────── */}
            {showReport && (
                <CommunityReportModal
                    onClose={() => setShowReport(false)}
                    onSubmitted={handleReportSubmitted}
                />
            )}
        </div>
    )
}

// ── DASHBOARD VOICE BAR — Web Speech API version ──────────────
function DashboardVoiceBar({ voiceState, interimText, finalText, voiceError, onToggle }) {
    const isListening = voiceState === "listening"
    const isReady     = voiceState === "ready"

    return (
        <div className="glass rounded-2xl px-3 py-2.5 flex items-center gap-3 shadow-2xl">
            <button
                onClick={onToggle}
                disabled={isReady}
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all border ${
                    isListening ? "bg-coral/20 border-coral/50 text-coral animate-pulse" :
                    isReady     ? "bg-purple/15 border-purple/30 text-purple cursor-default" :
                    "bg-bg3 border-border text-muted-foreground hover:border-amber2/40 hover:text-amber2"
                }`}
            >
                {isListening ? <MicOff className="w-4 h-4" />
                 : isReady   ? <CheckCircle className="w-4 h-4" />
                 : <Mic className="w-4 h-4" />}
            </button>

            <div className="flex-1 min-w-0">
                {isListening && (
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-coral uppercase tracking-wider">Listening...</span>
                        <div className="flex gap-0.5 items-end">
                            {[8,13,10,15,9].map((h, i) => (
                                <div key={i} className="w-0.5 rounded-full bg-coral animate-pulse"
                                    style={{ height: h, animationDelay: `${i * 0.12}s` }} />
                            ))}
                        </div>
                    </div>
                )}
                {isListening && interimText && (
                    <p className="font-sans text-xs text-muted-foreground italic truncate">{interimText}</p>
                )}
                {isReady && <span className="font-sans text-xs text-purple truncate block">Review in sidebar →</span>}
                {voiceError && <span className="font-mono text-xs text-coral">{voiceError}</span>}
                {!isListening && !isReady && !voiceError && (
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                        Ask SafeRoute AI anything...
                    </span>
                )}
            </div>

            <div className="w-7 h-7 rounded-full bg-purple/15 border border-purple/20 flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-purple" />
            </div>
        </div>
    )
}

// ── STAT CARD ─────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = "amber" }) {
    const colorMap = {
        coral:  "text-coral",
        amber:  "text-amber",
        amber2: "text-amber2",
        mint:   "text-mint",
        sky:    "text-sky",
        purple: "text-purple",
    }
    return (
        <div className="bg-bg3 rounded-xl p-3 border border-border/30 flex items-center gap-3">
            <div className={`flex-shrink-0 ${colorMap[color] || "text-amber"}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <div className={`font-mono text-sm font-bold ${colorMap[color] || "text-amber"}`}>{value}</div>
                <div className="font-mono text-xs text-muted-foreground uppercase truncate">{label}</div>
            </div>
        </div>
    )
}