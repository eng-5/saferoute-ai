import { useState, useEffect, useRef } from "react"
import { X, Radio } from "lucide-react"

const CATEGORY_COLORS = {
  suspicious: { dot: "bg-coral",  border: "border-coral/30",  text: "text-coral",  glow: "shadow-[0_0_20px_rgba(255,107,74,0.12)]" },
  hazard:     { dot: "bg-amber",  border: "border-amber/30",  text: "text-amber",  glow: "shadow-[0_0_20px_rgba(251,191,36,0.12)]" },
  lighting:   { dot: "bg-amber",  border: "border-amber/30",  text: "text-amber",  glow: "shadow-[0_0_20px_rgba(251,191,36,0.12)]" },
  safe:       { dot: "bg-amber2", border: "border-amber2/30", text: "text-amber2", glow: "shadow-[0_0_20px_rgba(251,146,60,0.12)]" },
  other:      { dot: "bg-sky",    border: "border-sky/30",    text: "text-sky",    glow: "shadow-[0_0_20px_rgba(56,189,248,0.12)]" },
}

const LIFETIME_MS = 45_000  // 45 seconds on screen

/**
 * BroadcastToast
 *
 * Props:
 *   report   — { lat, lng, category, label, timestamp }
 *   onDismiss — called when user dismisses or timer expires
 *   onFlyTo  — called with (lat, lng) when user clicks the toast body
 */
export function BroadcastToast({ report, onDismiss, onFlyTo }) {
  const [visible,  setVisible]  = useState(false)   // controls slide-in animation
  const [progress, setProgress] = useState(100)      // countdown bar 100→0
  const timerRef  = useRef(null)
  const frameRef  = useRef(null)
  const startRef  = useRef(null)

  const colors = CATEGORY_COLORS[report?.category] || CATEGORY_COLORS.other

  // Slide in after 1.8s delay (per spec)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1800)
    return () => clearTimeout(t)
  }, [])

  // Start countdown once visible
  useEffect(() => {
    if (!visible) return

    startRef.current = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const remaining = Math.max(0, 1 - elapsed / LIFETIME_MS)
      setProgress(remaining * 100)

      if (remaining > 0) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        handleDismiss()
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frameRef.current)
      clearTimeout(timerRef.current)
    }
  }, [visible])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => onDismiss?.(), 300) // wait for slide-out
  }

  const handleBodyClick = () => {
    if (report?.lat && report?.lng) {
      onFlyTo?.(report.lat, report.lng)
    }
    handleDismiss()
  }

  const minsAgo = report?.timestamp
    ? Math.round((Date.now() - report.timestamp) / 60000)
    : 0

  return (
    <div
      className={`
        fixed top-3 left-1/2 z-[9999] w-[calc(100vw-24px)] max-w-[380px]
        transition-all duration-300 ease-out
        ${visible
          ? "-translate-x-1/2 translate-y-0 opacity-100"
          : "-translate-x-1/2 -translate-y-4 opacity-0 pointer-events-none"
        }
      `}
    >
      <div className={`
        rounded-2xl glass border ${colors.border} ${colors.glow}
        overflow-hidden
      `}>
        {/* Progress bar — drains left to right over 45s */}
        <div className="h-0.5 bg-bg3 w-full">
          <div
            className={`h-full transition-none ${
              report?.category === "suspicious" ? "bg-coral" :
              report?.category === "other"      ? "bg-sky"   : "bg-amber"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Toast body — clickable to fly map */}
        <button
          onClick={handleBodyClick}
          className="w-full px-4 py-3 flex items-center gap-3 text-left"
        >
          {/* Animated dot */}
          <div className="relative flex-shrink-0">
            <span className={`absolute inset-0 rounded-full ${colors.dot} opacity-40 animate-ping`} />
            <span className={`relative w-2.5 h-2.5 rounded-full ${colors.dot} block`} />
          </div>

          <Radio className={`w-3.5 h-3.5 flex-shrink-0 ${colors.text}`} />

          <div className="flex-1 min-w-0">
            <p className={`font-mono text-[10px] uppercase tracking-wider ${colors.text} truncate`}>
              1 new community report in your area
            </p>
            <p className="font-mono text-[9px] text-muted-foreground/60 mt-0.5">
              {report?.label || report?.category || "Safety report"} ·{" "}
              {minsAgo < 1 ? "Just now" : `${minsAgo}m ago`} · Tap to view
            </p>
          </div>
        </button>

        {/* Dismiss */}
        <button
          onClick={(e) => { e.stopPropagation(); handleDismiss() }}
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}