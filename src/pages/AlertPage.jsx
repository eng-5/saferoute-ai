import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { GlassPanel } from "@/components/glass-panel"
import { MapBackground } from "@/components/map-background"
import {
    AlertTriangle,
    Check,
    Phone,
    Shield,
    ShieldAlert,
    ArrowRight,
    Navigation,
    Headphones
} from "lucide-react"

export default function AlertPage() {
    const navigate = useNavigate()
    const [countdown, setCountdown] = useState(60)

    useEffect(() => {
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <div className="h-full relative overflow-hidden bg-bg">
            <MapBackground dimmed showHeatmap={false} className="opacity-40" />

            {/* Hero Alert Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 z-20">
                <div className="relative w-32 h-32 mb-8">
                    <div className="absolute inset-0 rounded-full bg-coral/20 animate-ping-marker" />
                    <div className="absolute inset-0 rounded-full bg-coral/20 animate-ping-marker" style={{ animationDelay: "1s" }} />
                    <div className="relative w-32 h-32 rounded-full glass border border-coral flex items-center justify-center">
                        <ShieldAlert className="w-16 h-16 text-coral" />
                    </div>
                </div>

                <div className="text-center max-w-md mx-auto space-y-4">
                    <h1 className="font-serif italic text-4xl text-foreground">
                        Movement Irregularity Detected
                    </h1>
                    <p className="font-sans text-muted-foreground">
                        Our AI noticed you've been stationary for an unusual amount of time on Perry St. Are you safe?
                    </p>
                </div>

                {/* Visual Countdown */}
                <div className="mt-12 mb-12 flex flex-col items-center">
                    <div className="font-mono text-7xl text-coral mb-2">
                        0:{countdown.toString().padStart(2, "0")}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
                        Time to Auto-Dispatch
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="w-full max-w-sm space-y-4">
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="btn-mint-gradient w-full py-5 rounded-2xl font-mono text-sm text-bg font-bold flex items-center justify-center gap-3 animate-glow"
                    >
                        <Check className="w-6 h-6" />
                        I AM SAFE
                    </button>

                    <div className="grid grid-cols-2 gap-4">
                        <button className="py-4 glass rounded-2xl font-mono text-xs text-foreground flex flex-col items-center justify-center gap-2 border border-border hover:bg-bg3 transition-all">
                            <Headphones className="w-5 h-5 text-sky" />
                            TALK TO AI
                        </button>
                        <button className="py-4 glass rounded-2xl font-mono text-xs text-coral flex flex-col items-center justify-center gap-2 border border-coral/50 hover:bg-coral/10 transition-all">
                            <Phone className="w-5 h-5" />
                            ASSISTANCE
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer Info */}
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between z-20">
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        {[1, 2].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full bg-bg3 border border-border flex items-center justify-center font-mono text-[10px] text-muted-foreground">
                                SM
                            </div>
                        ))}
                    </div>
                    <span className="font-mono text-[10px] text-amber2 uppercase">Guardians Notified</span>
                </div>

                <GlassPanel className="p-2 px-3 flex items-center gap-2">
                    <Navigation className="w-3 h-3 text-sky" />
                    <span className="font-mono text-[10px] text-foreground">Perry St Area</span>
                </GlassPanel>
            </div>
        </div>
    )
}
