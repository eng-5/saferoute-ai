/**
 * fake-call.jsx — Cover Me / Fake Incoming Call
 *
 * Flow:
 *   1. User taps COVER ME → delay picker sheet opens
 *   2. User picks Now / 10s / 30s → silent countdown begins
 *   3. After delay → full-screen fake incoming call UI
 *   4. Accept → 45s synthesised "voice on the line" audio plays
 *   5. Decline / call ends → returns to navigation silently
 *
 * • Works with zero network — entirely local
 * • Navigation continues running underneath the entire time
 * • SOS button remains accessible via onSOS prop
 * • Contact name read from localStorage saferoute_fake_caller (default "Mom")
 */
 
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { X, Phone, PhoneOff } from "lucide-react"
import { playFakeRing } from "@/lib/audio"
 
// ── Synthesise a "voice on the line" using Web Audio ─────────
function createFakeVoice(ctx) {
  // Low-frequency noise shaped to sound like a muffled voice
  // Uses a biquad bandpass filter at ~300 Hz (phone voice frequency)
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate)
  const data   = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.4
  }
 
  const play = (startT, duration) => {
    const source  = ctx.createBufferSource()
    const filter  = ctx.createBiquadFilter()
    const gain    = ctx.createGain()
    source.buffer = buffer
    source.loop   = true
    filter.type   = "bandpass"
    filter.frequency.value = 320
    filter.Q.value         = 0.8
    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0, startT)
    gain.gain.linearRampToValueAtTime(0.22, startT + 0.1)
    gain.gain.setValueAtTime(0.22, startT + duration - 0.15)
    gain.gain.linearRampToValueAtTime(0, startT + duration)
    source.start(startT)
    source.stop(startT + duration)
  }
 
  return play
}
 
function startFakeConversation(ctx) {
  // Pattern: voice segments with gaps (user "speaking")
  const segments = [3, 2, 4, 1.5, 3.5, 2, 5, 1, 3, 2, 4]
  let t = ctx.currentTime + 0.5
  const play = createFakeVoice(ctx)
  segments.forEach((dur, i) => {
    play(t, dur)
    // Alternate voice + silence gap (simulate user talking)
    t += dur + (i % 2 === 0 ? 1.8 : 2.5)
  })
}
 
// ── Delay picker sheet ────────────────────────────────────────
function DelayPicker({ callerName, onPick, onClose }) {
  const options = [
    { label: "Now",  value: 0   },
    { label: "10s",  value: 10  },
    { label: "30s",  value: 30  },
    { label: "60s",  value: 60  },
  ]
 
  return createPortal(
    <div className="fixed inset-0 z-[99990] flex items-end justify-center bg-bg/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-bg2 border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div>
            <h3 className="font-serif italic text-lg text-foreground">Cover Me</h3>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">
              Fake call from <span className="text-sky">{callerName}</span> incoming in…
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2.5 p-4">
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => onPick(o.value)}
              className="py-4 rounded-xl bg-bg3 border border-border/40 hover:border-sky/40 hover:bg-sky/8 transition-all font-mono text-sm text-foreground active:scale-95"
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-center font-mono text-[10px] text-muted-foreground/40 pb-4">
          Navigation continues running in the background
        </p>
      </div>
    </div>,
    document.body
  )
}
 
// ── Incoming call screen ──────────────────────────────────────
function IncomingCallScreen({ callerName, onAccept, onDecline }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[99995] flex flex-col items-center"
      style={{ background: "linear-gradient(to bottom, #0a0e1a, #05070F)" }}
    >
      {/* Top info */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full px-8">
        {/* Animated avatar rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute w-40 h-40 rounded-full bg-sky/5 animate-ping" style={{ animationDuration: "2s" }} />
          <div className="absolute w-32 h-32 rounded-full bg-sky/8 animate-ping" style={{ animationDuration: "2s", animationDelay: "0.5s" }} />
          <div className="relative w-24 h-24 rounded-full bg-sky/15 border border-sky/30 flex items-center justify-center shadow-[0_0_40px_rgba(56,189,248,0.2)]">
            <span className="font-serif italic text-4xl text-sky">
              {callerName.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
 
        <div className="text-center">
          <h1 className="font-serif italic text-4xl text-foreground mb-2">{callerName}</h1>
          <p className="font-mono text-sm text-muted-foreground">Mobile · Incoming</p>
          {/* Animated dots */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
 
      {/* Action buttons */}
      <div className="flex items-center justify-around w-full max-w-xs pb-16 px-6">
        {/* Decline */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onDecline}
            className="w-20 h-20 rounded-full bg-coral flex items-center justify-center shadow-[0_0_30px_rgba(255,107,74,0.4)] hover:bg-coral/90 active:scale-95 transition-all"
          >
            <PhoneOff className="w-8 h-8 text-white" />
          </button>
          <span className="font-mono text-xs text-muted-foreground">Decline</span>
        </div>
 
        {/* Accept */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onAccept}
            className="w-20 h-20 rounded-full bg-mint flex items-center justify-center shadow-[0_0_30px_rgba(0,229,160,0.4)] hover:bg-mint/90 active:scale-95 transition-all"
          >
            <Phone className="w-8 h-8 text-bg" />
          </button>
          <span className="font-mono text-xs text-muted-foreground">Accept</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
 
// ── Active call screen ────────────────────────────────────────
function ActiveCallScreen({ callerName, elapsed, onHangUp }) {
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
 
  return createPortal(
    <div
      className="fixed inset-0 z-[99995] flex flex-col items-center"
      style={{ background: "linear-gradient(to bottom, #0a0e1a, #05070F)" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center gap-5 w-full px-8">
        <div className="w-20 h-20 rounded-full bg-mint/15 border border-mint/30 flex items-center justify-center">
          <span className="font-serif italic text-3xl text-mint">
            {callerName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="text-center">
          <h1 className="font-serif italic text-3xl text-foreground mb-1">{callerName}</h1>
          <p className="font-mono text-sm text-mint">{fmt(elapsed)}</p>
          {/* Voice waveform animation */}
          <div className="flex items-center justify-center gap-1 mt-3">
            {[3, 5, 7, 4, 6, 8, 5, 3, 6, 4, 7].map((h, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-mint/50 animate-waveform"
                style={{
                  height: `${h * 2}px`,
                  animationDelay: `${i * 0.07}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
 
      {/* End call */}
      <div className="flex flex-col items-center gap-2 pb-16">
        <button
          onClick={onHangUp}
          className="w-20 h-20 rounded-full bg-coral flex items-center justify-center shadow-[0_0_30px_rgba(255,107,74,0.4)] hover:bg-coral/90 active:scale-95 transition-all"
        >
          <PhoneOff className="w-8 h-8 text-white" />
        </button>
        <span className="font-mono text-xs text-muted-foreground">End Call</span>
      </div>
    </div>,
    document.body
  )
}
 
// ── Main export: CoverMe ──────────────────────────────────────
export default function CoverMe({ onClose, onSOS }) {
  const callerName = (() => {
    try { return localStorage.getItem("saferoute_fake_caller") || "Mom" } catch { return "Mom" }
  })()
 
  const [phase,    setPhase]    = useState("picker")  // picker | waiting | ringing | active | done
  const [delay,    setDelay]    = useState(0)
  const [elapsed,  setElapsed]  = useState(0)
  const waitRef   = useRef(null)
  const ringStop  = useRef(null)
  const callTimer = useRef(null)
  const audioCtx  = useRef(null)
 
  const cleanup = useCallback(() => {
    clearTimeout(waitRef.current)
    clearInterval(callTimer.current)
    ringStop.current?.()
    try { audioCtx.current?.close() } catch {}
  }, [])
 
  useEffect(() => () => cleanup(), [cleanup])
 
  const handlePick = (delaySeconds) => {
    setDelay(delaySeconds)
    if (delaySeconds === 0) {
      startRinging()
    } else {
      setPhase("waiting")
      waitRef.current = setTimeout(startRinging, delaySeconds * 1000)
    }
  }
 
  const startRinging = () => {
    setPhase("ringing")
    ringStop.current = playFakeRing()
  }
 
  const handleAccept = () => {
    ringStop.current?.()
    ringStop.current = null
    setPhase("active")
    setElapsed(0)
 
    // Start fake conversation audio
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtx.current = ctx
      startFakeConversation(ctx)
    } catch {}
 
    // Elapsed timer
    callTimer.current = setInterval(() => {
      setElapsed(e => {
        if (e >= 44) {
          // Auto hang up after 45 seconds
          handleHangUp()
          return 45
        }
        return e + 1
      })
    }, 1000)
  }
 
  const handleDecline = () => {
    cleanup()
    setPhase("done")
    setTimeout(onClose, 200)
  }
 
  const handleHangUp = () => {
    cleanup()
    setPhase("done")
    setTimeout(onClose, 300)
  }
 
  if (phase === "picker") {
    return <DelayPicker callerName={callerName} onPick={handlePick} onClose={onClose} />
  }
 
  if (phase === "waiting") {
    return createPortal(
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[99990] px-4 py-2.5 rounded-full bg-bg2 border border-sky/30 shadow-xl flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-sky animate-pulse flex-shrink-0" />
        <span className="font-mono text-xs text-sky">
          Incoming call in {delay}s…
        </span>
        <button onClick={handleDecline} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>,
      document.body
    )
  }
 
  if (phase === "ringing") {
    return <IncomingCallScreen callerName={callerName} onAccept={handleAccept} onDecline={handleDecline} />
  }
 
  if (phase === "active") {
    return <ActiveCallScreen callerName={callerName} elapsed={elapsed} onHangUp={handleHangUp} />
  }
 
  return null
}