import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { GlassPanel } from "@/components/glass-panel"
import { MapBackground } from "@/components/map-background"
import { useSafety } from "@/context/SafetyContext"
import {
    CheckCircle, MapPin, ShieldCheck,
    Star, Clock, Navigation, ArrowRight,
} from "lucide-react"
 
// Strings that mean "no real location was set"
const PLACEHOLDER_STRINGS = new Set([
  "Current Location", "Your GPS position", "Destination",
  "Origin", "Unknown", "",
])
 
function isRealLocation(str) {
  return str && !PLACEHOLDER_STRINGS.has(str)
}
 
export default function ArrivalPage() {
    const navigate = useNavigate()
    const { selectedRoute, setJourneyPlan, cancelJourney } = useSafety()
 
    const from     = selectedRoute?.from     || null
    const to       = selectedRoute?.to       || null
    const duration = selectedRoute?.duration || null
    const distance = selectedRoute?.distance || null
    const routeId  = selectedRoute?.id       || null
 
    const [feeling,      setFeeling]      = useState(null)   // "safe" | "uneasy" | "unsafe"
    const [feelingNote,  setFeelingNote]  = useState("")
    const [feelingSaved, setFeeelingSaved] = useState(false)
 
    // ── Save to history — only if both locations are real named places
    useEffect(() => {
        try {
            if (!isRealLocation(from) || !isRealLocation(to)) return
            const history = JSON.parse(localStorage.getItem("saferoute_journeys") || "[]")
            history.unshift({
                from,
                fromCoords: selectedRoute?.fromCoords || null,
                to,
                destCoords: selectedRoute?.toCoords   || null,
                date:     new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                duration: duration || "-- min",
                distance: distance || "-- mi",
                route:    selectedRoute?.name || "Safest Route",
                outcome:  "SAFE",
            })
            localStorage.setItem("saferoute_journeys", JSON.stringify(history.slice(0, 20)))
        } catch {}
        // Clear journey plan now that journey is complete
        try { setJourneyPlan?.(null) } catch {}
    }, [])
 
    const canShowRoute = isRealLocation(from) && isRealLocation(to)
 
    const saveFeeling = (f) => {
        setFeeling(f)
        if (!routeId) return
        try {
            const log = JSON.parse(localStorage.getItem("saferoute_route_feelings") || "[]")
            log.unshift({ routeId, feeling: f, note: feelingNote, timestamp: Date.now(), from, to })
            localStorage.setItem("saferoute_route_feelings", JSON.stringify(log.slice(0, 100)))
            setFeeelingSaved(true)
        } catch {}
    }
 
    return (
        <div className="h-full overflow-y-auto bg-bg">
            <div className="fixed inset-0 pointer-events-none z-0">
              <MapBackground dimmed showHeatmap={false} className="opacity-30" />
            </div>
 
            <div className="relative z-10 min-h-full flex flex-col items-center justify-center p-6">
                {/* Success icon */}
                <div className="relative mb-8">
                    <div className="absolute inset-0 rounded-full bg-mint/20 animate-ripple" />
                    <div className="relative w-24 h-24 rounded-full bg-mint/10 border border-mint flex items-center justify-center">
                        <CheckCircle className="w-12 h-12 text-mint" />
                    </div>
                </div>
 
                <div className="text-center max-w-md mx-auto space-y-3 mb-10">
                    <h1 className="font-serif italic text-4xl text-foreground">
                        You've Arrived Safely
                    </h1>
                    <p className="font-sans text-muted-foreground leading-relaxed">
                        {canShowRoute
                            ? `Journey from ${from} to ${to} completed. All systems deactivated.`
                            : "Your journey has been completed. All systems deactivated."
                        }
                    </p>
                </div>
 
                {/* Stats — real data from selectedRoute */}
                <div className="grid grid-cols-2 gap-4 w-full max-w-md mb-8">
                    <GlassPanel className="p-4 text-center">
                        <Clock className="w-5 h-5 text-sky mx-auto mb-2" />
                        <div className="font-serif italic text-2xl text-foreground">
                            {duration || "--"}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground uppercase">Duration</div>
                    </GlassPanel>
                    <GlassPanel className="p-4 text-center">
                        <Navigation className="w-5 h-5 text-mint mx-auto mb-2" />
                        <div className="font-serif italic text-2xl text-foreground">
                            {distance || "--"}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground uppercase">Distance</div>
                    </GlassPanel>
                </div>
 
                <div className="w-full max-w-md space-y-4">
                    <GlassPanel className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-amber2" />
                            <span className="font-sans text-sm text-foreground">Guardians Confirmed Safe</span>
                        </div>
                        <div className="flex -space-x-2">
                            {[1, 2].map(i => (
                                <div key={i} className="w-6 h-6 rounded-full bg-bg3 border border-border flex items-center justify-center text-[11px] text-muted-foreground">
                                    G{i}
                                </div>
                            ))}
                        </div>
                    </GlassPanel>
 
                    <GlassPanel className="p-4">
                        <div className="font-mono text-xs text-muted-foreground uppercase mb-3">How did the route feel?</div>
                        {!feelingSaved ? (
                            <div className="flex justify-between gap-2">
                                {[
                                    { id:"safe",   emoji:"😌", label:"Safe",   color:"text-mint",  active:"bg-mint/10 border-mint/30"  },
                                    { id:"uneasy", emoji:"😐", label:"Uneasy", color:"text-amber", active:"bg-amber/10 border-amber/30" },
                                    { id:"unsafe", emoji:"😨", label:"Unsafe", color:"text-coral", active:"bg-coral/10 border-coral/30" },
                                ].map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => saveFeeling(opt.id)}
                                        className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                                            feeling === opt.id
                                                ? `${opt.active} ${opt.color}`
                                                : "border-border/40 hover:border-border/70"
                                        }`}
                                    >
                                        <span className="text-2xl">{opt.emoji}</span>
                                        <span className={`font-mono text-[10px] uppercase ${feeling===opt.id?opt.color:"text-muted-foreground"}`}>{opt.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 py-2 text-mint">
                                <CheckCircle className="w-4 h-4"/>
                                <span className="font-mono text-xs">Feeling saved · Route intelligence updated</span>
                            </div>
                        )}
                        {feeling && !feelingSaved && (
                            <p className="font-mono text-[10px] text-muted-foreground/50 text-center mt-2">Tap to confirm · Helps SafeRoute AI+ personalise future routes</p>
                        )}
                    </GlassPanel>
 
                    <button
                        onClick={() => { cancelJourney(true); navigate("/dashboard") }}
                        className="btn-mint-gradient w-full py-4 rounded-xl font-mono text-sm text-bg font-bold flex items-center justify-center gap-2 mt-4"
                    >
                        RETURN TO DASHBOARD
                        <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
 
            <div className="fixed top-6 left-6 z-20 pointer-events-none">
                <div className="px-3 py-1.5 rounded-full glass border border-border flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-mint" />
                    <span className="font-mono text-xs text-foreground uppercase">Montgomery, AL</span>
                </div>
            </div>
        </div>
    )
}
