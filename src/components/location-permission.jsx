import { useState } from "react"
import { MapPin, Shield, X } from "lucide-react"

/**
 * LocationPermissionCard
 *
 * Shows before calling navigator.geolocation so users understand WHY
 * location is needed. Dramatically improves grant rate vs silent prompts.
 *
 * Props:
 *   onAllow   — called when user clicks Allow; component triggers geolocation
 *   onDismiss — called when user dismisses (app falls back to manual input)
 *   context   — "journey" | "monitor" | "report" — drives the description text
 */
export function LocationPermissionCard({ onAllow, onDismiss, context = "journey" }) {
  const [requesting, setRequesting] = useState(false)
  const [denied,     setDenied]     = useState(false)

  const COPY = {
    journey: {
      title:  "Use your current location",
      body:   "SafeRoute AI+ needs your location to calculate the safest route from where you are right now. Your position is never stored or shared.",
      allow:  "Use My Location",
    },
    monitor: {
      title:  "Track your journey",
      body:   "Live GPS tracking lets SafeRoute monitor your movement and alert your guardians if you stop unexpectedly. No data leaves your device.",
      allow:  "Enable Tracking",
    },
    report: {
      title:  "Pin your report accurately",
      body:   "Your GPS coordinates are attached to the community report so nearby users get the right location. Submitted anonymously.",
      allow:  "Allow Location",
    },
  }

  const copy = COPY[context] || COPY.journey

  const handleAllow = () => {
    if (!navigator.geolocation) {
      setDenied(true)
      return
    }
    setRequesting(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRequesting(false)
        onAllow?.({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        })
      },
      () => {
        setRequesting(false)
        setDenied(true)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  if (denied) {
    return (
      <div className="rounded-xl border border-amber/25 bg-amber/5 p-4">
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-amber flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-mono text-[10px] text-amber uppercase mb-1">Location Unavailable</p>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              Location permission was denied. You can type your starting location manually below — autocomplete will help.
            </p>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-sky/25 bg-sky/5 p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-sky/15 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-sky" />
        </div>
        <div className="flex-1">
          <p className="font-mono text-[11px] text-sky uppercase tracking-wide mb-1">{copy.title}</p>
          <p className="font-sans text-xs text-muted-foreground leading-relaxed">{copy.body}</p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleAllow}
          disabled={requesting}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-sky/15 border border-sky/30 text-sky font-mono text-[10px] uppercase tracking-wider hover:bg-sky/25 transition-colors disabled:opacity-60"
        >
          {requesting ? (
            <span className="animate-pulse">Requesting...</span>
          ) : (
            <>
              <Shield className="w-3.5 h-3.5" />
              {copy.allow}
            </>
          )}
        </button>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-lg border border-border text-muted-foreground font-mono text-[10px] uppercase hover:border-border/80 transition-colors"
          >
            Manual
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <Shield className="w-3 h-3 text-muted-foreground/40" />
        <span className="font-mono text-[8px] text-muted-foreground/40">
          Location data never leaves your device · No account required
        </span>
      </div>
    </div>
  )
}