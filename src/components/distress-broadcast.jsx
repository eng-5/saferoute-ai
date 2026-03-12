/**
 * distress-broadcast.jsx
 * Silent Distress Broadcast — full-screen panic pad portaled to document.body.
 *
 * Trigger paths:
 *   1. Long-press SOS button (2 000 ms) in NavigationPage
 *   2. 3 rapid device shakes (handled in NavigationPage, opens via prop)
 *   3. "DISTRESS" button in NavigationPage sidebar footer
 *
 * Features:
 *   • 6 one-tap preset buttons — send instantly, no confirm
 *   • Optional freetext line — auto-sends after 8 s of inactivity
 *   • 10-second auto-send countdown ring (SVG arc around screen edge)
 *   • Stealth mode — dims screen, suppresses audio, vibration-only confirm
 *   • Sends WhatsApp + Email + clipboard simultaneously via fireDistressAlerts
 *   • Haptic confirm on every send
 */
 
import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  X, Send, Eye, EyeOff, CheckCircle, Loader2, Wifi,
  AlertTriangle, MessageSquare
} from "lucide-react"
import {
  DISTRESS_PRESETS, fireDistressAlerts, loadGuardianContacts
} from "@/lib/useNotifications"
import { playDistressConfirm, playStealthConfirm } from "@/lib/audio"
 
// ── SVG countdown ring ────────────────────────────────────────
function CountdownRing({ seconds, total, stealth }) {
  const r   = 48
  const circ = 2 * Math.PI * r
  const pct  = seconds / total
  const dash = circ * pct
 
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <circle
        cx="50%" cy="50%" r={r}
        fill="none"
        stroke={stealth ? "rgba(251,146,60,0.15)" : "rgba(255,107,74,0.25)"}
        strokeWidth="3"
      />
      <circle
        cx="50%" cy="50%" r={r}
        fill="none"
        stroke={stealth ? "#FB923C" : "#FF6B4A"}
        strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90, 50%, 50%)"
        style={{ transition: "stroke-dasharray 1s linear", transformOrigin: "50% 50%" }}
      />
    </svg>
  )
}
 
// ── Sent confirmation overlay ─────────────────────────────────
function SentOverlay({ results, onClose }) {
  const channels = results.filter(r => r.success)
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-bg/90 backdrop-blur-sm rounded-none">
      <div className="relative w-20 h-20 mb-5">
        <div className="absolute inset-0 rounded-full bg-mint/20 animate-ping" />
        <div className="relative w-20 h-20 rounded-full bg-mint/10 border border-mint flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-mint" />
        </div>
      </div>
      <h3 className="font-mono text-lg font-bold text-mint uppercase mb-2">Alert Sent</h3>
      <div className="space-y-1.5 mb-6 text-center">
        {channels.map((r, i) => (
          <div key={i} className="font-mono text-xs text-mint/80 flex items-center gap-2 justify-center">
            <CheckCircle className="w-3 h-3" />
            {r.channel === "whatsapp"  && `WhatsApp → ${r.contact}`}
            {r.channel === "email"     && `Email → ${r.contact}`}
            {r.channel === "clipboard" && "Guardian link + message copied"}
          </div>
        ))}
        {channels.length === 0 && (
          <p className="font-mono text-xs text-amber">No guardian contacts configured — add them in Settings</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="px-8 py-3 rounded-xl bg-mint/15 border border-mint/40 text-mint font-mono text-sm uppercase hover:bg-mint/25 transition-colors"
      >
        Close
      </button>
    </div>
  )
}
 
// ── Main component ────────────────────────────────────────────
export default function DistressBroadcast({ journey, userPos, onClose }) {
  const [stealth,      setStealth]      = useState(false)
  const [customText,   setCustomText]   = useState("")
  const [countdown,    setCountdown]    = useState(10)
  const [sending,      setSending]      = useState(false)
  const [sentResults,  setSentResults]  = useState(null)
  const [activePreset, setActivePreset] = useState(null)
  const autoSendRef   = useRef(null)
  const textTimerRef  = useRef(null)
  const inputRef      = useRef(null)
 
  const TOTAL_COUNTDOWN = 10
 
  // ── auto-send countdown ───────────────────────────────────
  useEffect(() => {
    autoSendRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(autoSendRef.current)
          doSend("location", "SEND MY LOCATION NOW")
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(autoSendRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
 
  // Stop countdown once user taps a preset or types
  const stopCountdown = () => {
    clearInterval(autoSendRef.current)
    setCountdown(null)
  }
 
  // ── auto-send after 8s of no typing ──────────────────────
  const resetTextTimer = useCallback(() => {
    clearTimeout(textTimerRef.current)
    textTimerRef.current = setTimeout(() => {
      if (customText.trim()) doSend(null, customText)
    }, 8000)
  }, [customText]) // eslint-disable-line react-hooks/exhaustive-deps
 
  // ── send ──────────────────────────────────────────────────
  const doSend = useCallback(async (presetId, text) => {
    if (sending) return
    stopCountdown()
    setSending(true)
    setActivePreset(presetId)
 
    const contacts = loadGuardianContacts()
    const results  = await fireDistressAlerts(contacts, presetId, text, journey, userPos)
 
    if (stealth) playStealthConfirm()
    else         playDistressConfirm()
 
    setSending(false)
    setSentResults(results)
  }, [sending, journey, userPos, stealth])
 
  const handlePreset = useCallback((preset) => {
    stopCountdown()
    doSend(preset.id, preset.label)
  }, [doSend])
 
  const handleTextChange = (e) => {
    setCustomText(e.target.value)
    stopCountdown()
    resetTextTimer()
  }
 
  const handleTextSend = () => {
    if (!customText.trim()) return
    doSend(null, customText)
  }
 
  const colorMap = {
    coral: { bg: "bg-coral/10",  border: "border-coral/40",  text: "text-coral",  hover: "hover:bg-coral/20"  },
    amber: { bg: "bg-amber/10",  border: "border-amber/40",  text: "text-amber",  hover: "hover:bg-amber/20"  },
    sky:   { bg: "bg-sky/10",    border: "border-sky/40",    text: "text-sky",    hover: "hover:bg-sky/20"    },
  }
 
  const panel = (
    <div
      className="fixed inset-0 z-[99999] flex flex-col"
      style={{
        background: stealth
          ? "rgba(5,7,15,0.97)"
          : "rgba(5,7,15,0.92)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Countdown ring — surrounds entire screen edge */}
      {countdown !== null && !sending && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
            <circle
              cx="50%" cy="50%"
              r="49%"
              fill="none"
              stroke={stealth ? "rgba(251,146,60,0.1)" : "rgba(255,107,74,0.18)"}
              strokeWidth="3"
            />
            <circle
              cx="50%" cy="50%"
              r="49%"
              fill="none"
              stroke={stealth ? "#FB923C" : "#FF6B4A"}
              strokeWidth="3"
              strokeDasharray={`${(countdown / TOTAL_COUNTDOWN) * (2 * Math.PI * (window.innerWidth * 0.49))} 9999`}
              strokeLinecap="round"
              transform={`rotate(-90, ${window.innerWidth / 2}, ${window.innerHeight / 2})`}
              style={{ transition: "stroke-dasharray 1s linear" }}
            />
          </svg>
        </div>
      )}
 
      {/* Sent overlay */}
      {sentResults && (
        <SentOverlay results={sentResults} onClose={onClose} />
      )}
 
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-safe pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-coral/20 border border-coral/40 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-coral" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">
              {stealth ? "SILENT DISTRESS" : "DISTRESS BROADCAST"}
            </div>
            {countdown !== null ? (
              <div className="font-mono text-xs text-coral">
                Auto-sends in {countdown}s — tap to cancel
              </div>
            ) : (
              <div className="font-mono text-[11px] text-muted-foreground/60">
                Tap a message to send instantly
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Stealth toggle */}
          <button
            onClick={() => setStealth(s => !s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-[10px] uppercase transition-all ${
              stealth
                ? "bg-amber/10 border-amber/30 text-amber"
                : "border-border/40 text-muted-foreground hover:border-border/70"
            }`}
          >
            {stealth ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {stealth ? "Stealth On" : "Stealth"}
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
 
      {/* Stealth mode dim overlay */}
      {stealth && (
        <div className="absolute inset-0 z-[2] bg-bg/60 pointer-events-none" />
      )}
 
      {/* Preset buttons */}
      <div className="relative z-10 flex-1 px-4 pb-2 grid grid-cols-1 gap-2.5 overflow-y-auto">
        {DISTRESS_PRESETS.map(preset => {
          const c = colorMap[preset.color] || colorMap.coral
          const isActive = activePreset === preset.id && sending
          return (
            <button
              key={preset.id}
              onClick={() => handlePreset(preset)}
              disabled={sending}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all text-left active:scale-[0.98] ${c.bg} ${c.border} ${c.hover} ${
                isActive ? "ring-2 ring-offset-2 ring-offset-bg ring-coral/60 animate-pulse" : ""
              } disabled:opacity-60`}
            >
              <span className="text-2xl flex-shrink-0">{preset.icon}</span>
              <span className={`font-mono text-sm font-bold uppercase tracking-wide ${c.text}`}>
                {preset.label}
              </span>
              {isActive && <Loader2 className="w-4 h-4 ml-auto animate-spin text-coral flex-shrink-0" />}
              {!isActive && !sending && (
                <Send className={`w-4 h-4 ml-auto opacity-40 flex-shrink-0 ${c.text}`} />
              )}
            </button>
          )
        })}
      </div>
 
      {/* Freetext input */}
      <div className="relative z-10 px-4 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-bg3 border border-border/40 focus-within:border-sky/40 transition-colors">
          <MessageSquare className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
          <input
            ref={inputRef}
            value={customText}
            onChange={handleTextChange}
            onKeyDown={e => e.key === "Enter" && handleTextSend()}
            placeholder="Add detail... plate number, description (auto-sends after 8s)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
            disabled={sending}
          />
          {customText.trim() && (
            <button
              onClick={handleTextSend}
              disabled={sending}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-sky/15 border border-sky/30 flex items-center justify-center text-sky hover:bg-sky/25 transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        {/* Guardian status */}
        <div className="mt-2 flex items-center gap-1.5 justify-center">
          <Wifi className="w-3 h-3 text-muted-foreground/40" />
          <span className="font-mono text-[10px] text-muted-foreground/40">
            {loadGuardianContacts().length > 0
              ? `${loadGuardianContacts().length} guardian${loadGuardianContacts().length > 1 ? "s" : ""} will be alerted · WhatsApp + Email + Clipboard`
              : "No guardians configured — location copied to clipboard only"
            }
          </span>
        </div>
      </div>
    </div>
  )
 
  return createPortal(panel, document.body)
}