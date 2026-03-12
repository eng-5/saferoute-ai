import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { MapBackground } from "@/components/map-background"
import { GlassPanel } from "@/components/glass-panel"
import { UserLocationMarker } from "@/components/user-location-marker"
import { VoiceBar } from "@/components/voice-bar"
import { useSafety } from "@/context/SafetyContext"
import { useMontgomeryData } from "@/hooks/useMontgomeryData"
import { cn } from "@/lib/utils"  // ← FIXED: this import was missing
import {
    Map as MapIcon,
    Thermometer,
    FileText,
    AlertTriangle,
    Shield,
    Clock,
    Activity,
    Cpu,
    Eye,
    RefreshCw,
    Phone,
    Check,
    MapPin
} from "lucide-react"

const navTabs = [
    { id: "map", label: "Live Route Map", icon: MapIcon },
    { id: "heatmap", label: "Safety Heatmap", icon: Thermometer },
    { id: "logs", label: "Check-in Logs", icon: FileText },
    { id: "alerts", label: "Risk Alerts", icon: AlertTriangle },
]

const predefinedLocations = [
    { name: "Montgomery City Center", lat: 32.3792, lng: -86.3077 },
    { name: "Downtown District", lat: 32.3769, lng: -86.3012 },
    { name: "Oak Park", lat: 32.3901, lng: -86.3198 },
    { name: "Cloverdale", lat: 32.3654, lng: -86.2891 },
    { name: "Montgomery Regional Airport", lat: 32.4600, lng: -86.3722 },
]

export default function ActivePage() {
    const navigate = useNavigate()
    const { userPos, setUserPos, selectedRoute, currentRisk, confidenceScore } = useSafety()
    const { fireIncidents, neighborhoods } = useMontgomeryData()

    const [checkInTime, setCheckInTime] = useState(180)
    const [progress, setProgress] = useState(0)
    const [showAlert, setShowAlert] = useState(false)
    const [activeTab, setActiveTab] = useState("map")
    const [useRealGeo, setUseRealGeo] = useState(false)
    const [manualLocation, setManualLocation] = useState("")
    const [panelExpanded, setPanelExpanded] = useState(false)  // mobile: expand stats drawer

    // Get real geolocation (one-time permission request)
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setUserPos([pos.coords.longitude, pos.coords.latitude])
                    setUseRealGeo(true)
                },
                (err) => {
                    console.log("Geolocation denied:", err.message)
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            )
        }
    }, [setUserPos])

    // Risk factor from current position
    const riskFactor = Math.max(0.5, currentRisk.score / 100)

    // Check-in countdown — faster in high-risk zones
    useEffect(() => {
        const interval = setInterval(() => {
            setCheckInTime((prev) => {
                const decrement = Math.round(1 * riskFactor)
                if (prev <= decrement) {
                    setShowAlert(true)
                    return 180
                }
                return prev - decrement
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [riskFactor])

    // Simulate journey progress + movement
    useEffect(() => {
        if (!selectedRoute) return

        const interval = setInterval(() => {
            setProgress((prev) => {
                const next = Math.min(prev + 1.5, 100)
                if (next >= 100) navigate("/arrival")
                return next
            })

            // Move toward safe area
            const safeTarget = neighborhoods.find(n => n.risk_level === "LOW") || neighborhoods[0]
            setUserPos(prev => [
                prev[0] + (safeTarget.lng - prev[0]) * 0.004,
                prev[1] + (safeTarget.lat - prev[1]) * 0.004
            ])
        }, 700)

        return () => clearInterval(interval)
    }, [selectedRoute, neighborhoods, navigate])

    // Auto-trigger alert near high-risk incident
    useEffect(() => {
        const nearHighRisk = fireIncidents.some(inc =>
            Math.hypot(inc.lat - userPos[1], inc.lng - userPos[0]) < 0.018
        )
        if (nearHighRisk && !showAlert) {
            setShowAlert(true)
        }
    }, [userPos, fireIncidents, showAlert])

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    const handleSafeCheckIn = () => {
        setCheckInTime(180)
        setShowAlert(false)
    }

    const handleManualLocation = (locName) => {
        const loc = predefinedLocations.find(l => l.name === locName)
        if (loc) setUserPos([loc.lng, loc.lat])
    }

    return (
        <div className="h-full flex flex-col md:flex-row relative">
            {/* Alert Modal */}
            {showAlert && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
                    <GlassPanel className="max-w-md w-full mx-4 p-8 border-coral animate-pulse-slow">
                        <div className="text-center">
                            <div className="relative w-28 h-28 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full bg-coral/40 animate-ping-marker" />
                                <div className="relative w-28 h-28 rounded-full bg-coral/25 flex items-center justify-center">
                                    <AlertTriangle className="w-14 h-14 text-coral" />
                                </div>
                            </div>

                            <h2 className="font-serif italic text-3xl text-foreground mb-4">
                                Movement Irregularity Detected
                            </h2>

                            <p className="font-sans text-lg text-muted-foreground mb-8">
                                Near {currentRisk.name} (risk score {currentRisk.score}/99). Confirm status.
                            </p>

                            <div className="font-mono text-6xl text-coral mb-10 font-bold tracking-tight">
                                {formatTime(checkInTime)}
                            </div>

                            <div className="flex flex-col gap-5">
                                <button
                                    onClick={handleSafeCheckIn}
                                    className="btn-mint-gradient w-full py-6 rounded-xl font-mono text-xl text-bg font-bold flex items-center justify-center gap-4 animate-glow shadow-xl"
                                >
                                    <Check className="w-8 h-8" />
                                    I'M SAFE
                                </button>
                                <button className="w-full py-6 rounded-xl font-mono text-xl text-bg bg-coral hover:bg-coral/90 transition-colors flex items-center justify-center gap-4 shadow-xl">
                                    <Phone className="w-8 h-8" />
                                    NEED ASSISTANCE
                                </button>
                            </div>
                        </div>
                    </GlassPanel>
                </div>
            )}

            {/* Map Area */}
            <div className="flex-1 relative">
                <MapBackground showHeatmap showGrid>
                    <UserLocationMarker lat={userPos[1]} lng={userPos[0]} />

                    {/* Simulated real road path */}
                    {selectedRoute && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                            <path
                                d="M 50% 88% Q 45% 75%, 48% 62%, 52% 50%, 58% 38%, 62% 25%, 68% 15%, 72% 5%"
                                fill="none"
                                stroke={currentRisk.level === "HIGH" ? "#FF6B4A" : currentRisk.level === "MEDIUM" ? "#FBBF24" : "#00E5A0"}
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray="15 8"
                                className="animate-flow"
                            />
                        </svg>
                    )}

                    {/* Bottom Panel — collapsible on mobile */}
                    <GlassPanel className="absolute bottom-4 left-4 right-16 md:right-auto md:max-w-xl z-20 shadow-2xl border-t-4 border-mint/30 overflow-hidden">

                        {/* Mobile drag handle */}
                        <button
                            className="md:hidden flex justify-center w-full pt-2.5 pb-1"
                            onClick={() => setPanelExpanded(e => !e)}
                        >
                            <div className="w-8 h-1 rounded-full bg-border" />
                        </button>

                        <div className="p-4 md:p-6">
                            {/* Always visible: status + countdown + I'm Safe */}
                            <div className="flex items-center justify-between mb-3 md:mb-5">
                                <div className="flex items-center gap-3 md:gap-5">
                                    <Shield className="w-6 h-6 md:w-8 md:h-8 text-mint" />
                                    <div>
                                        <div className="font-sans text-base md:text-xl text-foreground">Journey Active</div>
                                        <div className="font-mono text-[10px] md:text-sm text-muted-foreground mt-0.5 md:mt-1 truncate max-w-[140px] md:max-w-none">
                                            {currentRisk.name} · {currentRisk.level} ({currentRisk.score}/99)
                                        </div>
                                    </div>
                                </div>
                                <div className="font-mono text-3xl md:text-5xl text-foreground font-bold">
                                    {formatTime(checkInTime)}
                                </div>
                            </div>

                            <button
                                onClick={handleSafeCheckIn}
                                className="btn-mint-gradient w-full py-3.5 md:py-5 rounded-xl font-mono text-base md:text-xl text-bg font-bold flex items-center justify-center gap-3 md:gap-4 animate-glow shadow-xl mb-3 md:mb-5"
                            >
                                <Check className="w-5 h-5 md:w-7 md:h-7" />
                                I'M SAFE
                            </button>

                            {/* Expandable stats — always shown on desktop, toggle on mobile */}
                            <div className={`md:block transition-all duration-300 ${panelExpanded ? "block" : "hidden"}`}>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-4 md:mb-6">
                                    <div className="bg-bg3 rounded-xl p-3 md:p-4 text-center shadow-inner">
                                        <Activity className="w-5 h-5 md:w-6 md:h-6 text-mint mx-auto mb-1.5 md:mb-2" />
                                        <div className="font-mono text-[9px] md:text-xs text-muted-foreground">Movement</div>
                                        <div className="font-sans text-sm md:text-base text-mint font-medium">Active</div>
                                    </div>
                                    <div className="bg-bg3 rounded-xl p-3 md:p-4 text-center shadow-inner">
                                        <Cpu className="w-5 h-5 md:w-6 md:h-6 text-sky mx-auto mb-1.5 md:mb-2" />
                                        <div className="font-mono text-[9px] md:text-xs text-muted-foreground">AI Confidence</div>
                                        <div className="font-sans text-sm md:text-base text-sky font-medium">{Math.round(confidenceScore)}%</div>
                                    </div>
                                    <div className="bg-bg3 rounded-xl p-3 md:p-4 text-center shadow-inner">
                                        <Eye className="w-5 h-5 md:w-6 md:h-6 text-amber2 mx-auto mb-1.5 md:mb-2" />
                                        <div className="font-mono text-[9px] md:text-xs text-muted-foreground">Monitoring</div>
                                        <div className="font-sans text-sm md:text-base text-amber2 font-medium">Active</div>
                                    </div>
                                    <div className="bg-bg3 rounded-xl p-3 md:p-4 text-center shadow-inner">
                                        <RefreshCw className="w-5 h-5 md:w-6 md:h-6 text-muted-foreground mx-auto mb-1.5 md:mb-2" />
                                        <div className="font-mono text-[9px] md:text-xs text-muted-foreground">Last Check</div>
                                        <div className="font-sans text-sm md:text-base text-foreground">Now</div>
                                    </div>
                                </div>
                                <VoiceBar
                                    placeholder="Ask during travel (e.g. 'How safe is this area?')"
                                    variant="navigation"
                                />
                            </div>
                        </div>
                    </GlassPanel>

                    {/* SOS — positioned so it doesn't overlap panel */}
                    <button className="absolute bottom-4 right-4 w-14 h-14 md:w-20 md:h-20 rounded-full bg-coral flex items-center justify-center z-30 shadow-2xl hover:bg-coral/90 transition-all ring-4 ring-coral/30">
                        <span className="font-mono text-sm md:text-xl text-white font-bold">SOS</span>
                    </button>

                    {/* Manual location fallback */}
                    {!useRealGeo && (
                        <GlassPanel className="absolute top-5 left-5 z-20 p-5 max-w-sm shadow-xl">
                            <div className="font-sans text-base text-foreground mb-3">
                                Using simulated location (demo mode)
                            </div>
                            <select
                                value={manualLocation}
                                onChange={e => handleManualLocation(e.target.value)}
                                className="w-full bg-bg3 border border-border rounded-lg p-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-mint"
                            >
                                <option value="">Select starting point</option>
                                {predefinedLocations.map(loc => (
                                    <option key={loc.name} value={loc.name}>
                                        {loc.name}
                                    </option>
                                ))}
                            </select>
                        </GlassPanel>
                    )}
                </MapBackground>
            </div>

            {/* Sidebar */}
            <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-bg2 border-l border-border hidden md:flex flex-col z-30">
                <div className="p-6 border-b border-border">
                    <h3 className="font-serif italic text-xl text-foreground">Active Journey</h3>
                </div>

                <div className="flex border-b border-border">
                    {navTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex-1 py-5 font-mono text-sm uppercase tracking-wider transition-colors",
                                activeTab === tab.id
                                    ? "text-amber2 bg-bg3 border-b-2 border-amber2"
                                    : "text-muted-foreground hover:text-foreground hover:bg-bg3/50"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                    {activeTab === "map" && (
                        <div className="space-y-5">
                            <div className="flex items-center gap-4">
                                <MapPin className="w-6 h-6 text-sky" />
                                <div>
                                    <div className="font-sans text-base text-foreground">Current Position</div>
                                    <div className="font-mono text-sm text-muted-foreground mt-1">
                                        {userPos[1].toFixed(5)}, {userPos[0].toFixed(5)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Shield className="w-6 h-6 text-mint" />
                                <div>
                                    <div className="font-sans text-base text-foreground">Guardians Notified</div>
                                    <div className="font-mono text-sm text-mint mt-1">2 contacts • Active</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "heatmap" && (
                        <div className="text-muted-foreground text-base">
                            Safety heatmap active — darker areas indicate higher risk.
                        </div>
                    )}

                    {activeTab === "logs" && (
                        <div className="space-y-4">
                            <div className="bg-bg3 rounded-xl p-4">
                                <div className="font-mono text-sm text-muted-foreground">Check-in</div>
                                <div className="font-sans text-base text-foreground mt-1">
                                    Confirmed at {new Date().toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "alerts" && (
                        <div className="text-muted-foreground text-base">
                            Monitoring {fireIncidents.length} live incidents — no active alerts.
                        </div>
                    )}
                </div>
            </aside>
        </div>
    )
}