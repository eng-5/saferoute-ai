import { useMemo } from "react"
import { GlassPanel } from "@/components/glass-panel"
import { useSafety } from "@/context/SafetyContext"
import {
  Navigation, AlertTriangle, Target, Users, TrendingUp, TrendingDown,
  Database, Wifi, WifiOff, CheckCircle, Clock, Shield, Flame,
  Activity, MapPin, BarChart2, Zap, AlertCircle, RefreshCw
} from "lucide-react"

// Placeholder strings that should never be in real journey history
const PHANTOM = new Set(["Current Location","Your GPS position","Destination","Origin","Unknown",""])

// Compute total journey stats from localStorage + live data
// Automatically scrubs phantom entries left over from dev/testing sessions
function useJourneyStats() {
  return useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("saferoute_journeys") || "[]")
      const h   = raw.filter(j =>
        j.from && j.to &&
        !PHANTOM.has(j.from) && !PHANTOM.has(j.to)
      )
      // Persist scrubbed list so it stays clean
      if (h.length !== raw.length) {
        try { localStorage.setItem("saferoute_journeys", JSON.stringify(h)) } catch {}
      }
      const safe      = h.filter(j => j.outcome === "SAFE").length
      const cancelled = h.filter(j => j.outcome === "CANCELLED").length
      return { total: h.length, safe, cancelled, history: h.slice(0, 5) }
    } catch { return { total: 0, safe: 0, cancelled: 0, history: [] } }
  }, [])
}

function useGuardianCount() {
  return useMemo(() => {
    try { return JSON.parse(localStorage.getItem("saferoute_contacts") || "[]").length }
    catch { return 0 }
  }, [])
}

// Mini sparkline bar (pure CSS, no chart lib)
function MiniBar({ value, max, color = "bg-amber", label, sublabel }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="flex justify-between items-baseline mb-1">
          <span className="font-sans text-xs text-foreground">{label}</span>
          <span className="font-mono text-xs text-muted-foreground">{sublabel}</span>
        </div>
        <div className="h-1.5 bg-bg3 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="font-mono text-sm text-foreground w-10 text-right flex-shrink-0">{value}</span>
    </div>
  )
}

// Dot chart — 7 bars representing incidents by neighbourhood
function IncidentChart({ neighborhoods, maxVal }) {
  const max = maxVal || Math.max(...neighborhoods.map(n => n.live_fire || 0), 1)
  return (
    <div className="flex items-end gap-1.5 h-20">
      {neighborhoods.slice(0, 7).map((n, i) => {
        const fires = n.live_fire || 0
        const pct   = (fires / max) * 100
        const col   = n.risk_level === "HIGH" ? "bg-coral" : n.risk_level === "MEDIUM" ? "bg-amber" : "bg-mint"
        return (
          <div key={n.id || i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className={`w-full rounded-t ${col} transition-all cursor-pointer hover:opacity-80`}
              style={{ height: `${Math.max(4, pct)}%` }} />
            <span className="font-mono text-[11px] text-muted-foreground truncate w-full text-center">
              {n.name?.split(" ")[0]}
            </span>
            {/* tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-bg2 border border-border rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
              <span className="font-mono text-xs text-foreground">{n.name}: {fires} fires · {n.risk_score}/99</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Live stream health rows — honest about what we actually connect to
const REAL_STREAMS = [
  { name: "ArcGIS Fire/Rescue",  key: "arcgis",   note: "Montgomery open data portal" },
  { name: "Mapbox Directions",   key: "mapbox",   note: "Route geometry + turn-by-turn" },
  { name: "Mapbox Geocoding",    key: "mapbox",   note: "Address search + landmarks"    },
  { name: "Groq LLaMA 3.3 70B", key: "groq",     note: "AI voice + safety analysis"   },
  { name: "Web Speech API",      key: "speech",   note: "Browser-native voice input"   },
  { name: "Community Reports",   key: "local",    note: "User-submitted, rate-limited" },
  { name: "EmailJS (Alerts)",    key: "emailjs",  note: "Guardian emergency emails"    },
  { name: "WhatsApp Deep Links", key: "whatsapp", note: "Guardian WhatsApp messages"   },
]

export default function AnalyticsPage() {
  const {
    neighborhoods = [], fireIncidents = [], hasLiveData,
    loading, confidenceScore, stats = {}, currentRisk,
  } = useSafety()

  const journeyStats = useJourneyStats()
  const guardianCount = useGuardianCount()

  // KPIs — all real data
  const totalIncidents  = fireIncidents.length
  const highRiskCount   = neighborhoods.filter(n => n.risk_level === "HIGH").length
  const safeRoutePct    = journeyStats.total > 0
    ? Math.round((journeyStats.safe / journeyStats.total) * 100) : 100
  const avgRisk         = neighborhoods.length
    ? Math.round(neighborhoods.reduce((s, n) => s + n.risk_score, 0) / neighborhoods.length) : 0

  const kpis = [
    {
      label: "Journeys Completed", value: journeyStats.total || 0,
      sub: `${journeyStats.safe} safe · ${journeyStats.cancelled} cancelled`,
      trend: "up", color: "mint", icon: Navigation,
    },
    {
      label: "Live Fire Incidents", value: totalIncidents,
      sub: `${highRiskCount} high-risk zones active`,
      trend: totalIncidents > 10 ? "up" : "down", color: "coral", icon: Flame,
    },
    {
      label: "AI Confidence", value: `${Math.round(confidenceScore)}%`,
      sub: hasLiveData ? "Live ArcGIS data" : "Cached data",
      trend: "up", color: "amber", icon: Target,
    },
    {
      label: "Guardians Configured", value: guardianCount,
      sub: guardianCount > 0 ? "Emergency alerts ready" : "Add contacts in Settings",
      trend: guardianCount > 0 ? "up" : "down", color: "sky", icon: Users,
    },
  ]

  const colorMap = { mint:"text-mint", coral:"text-coral", amber:"text-amber", sky:"text-sky", purple:"text-purple" }
  const bgMap    = { mint:"bg-mint/15", coral:"bg-coral/15", amber:"bg-amber/15", sky:"bg-sky/15", purple:"bg-purple/15" }
  const barMap   = { mint:"bg-mint", coral:"bg-coral", amber:"bg-amber", sky:"bg-sky" }

  const hasEnvMailjs    = !!import.meta.env.VITE_EMAILJS_SERVICE_ID
  const hasEnvMapbox    = !!import.meta.env.VITE_MAPBOX_TOKEN
  const hasEnvGroq      = !!import.meta.env.VITE_GROQ_API_KEY

  const streamStatus = (key) => {
    if (key === "arcgis")   return hasLiveData ? "live" : loading ? "loading" : "degraded"
    if (key === "mapbox")   return hasEnvMapbox ? "live" : "not_configured"
    if (key === "groq")     return hasEnvGroq   ? "live" : "not_configured"
    if (key === "emailjs")  return hasEnvMailjs ? "live" : "not_configured"
    if (key === "speech")   return (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) ? "live" : "degraded"
    return "live"
  }

  const statusColor = (s) => s === "live" ? "text-mint" : s === "loading" ? "text-amber" : s === "not_configured" ? "text-muted-foreground" : "text-coral"
  const statusDot   = (s) => s === "live" ? "bg-mint animate-pulse" : s === "loading" ? "bg-amber animate-pulse" : s === "not_configured" ? "bg-muted-foreground/40" : "bg-coral"
  const statusLabel = (s) => s === "live" ? "LIVE" : s === "loading" ? "LOADING" : s === "not_configured" ? "NOT SET" : "ISSUE"

  const liveCount = REAL_STREAMS.filter(s => streamStatus(s.key) === "live").length

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif italic text-2xl text-foreground">Analytics & Metrics</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1">
              SafeRoute AI+ · Real data · Montgomery, AL
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg3 border border-border">
            <div className={`w-2 h-2 rounded-full ${hasLiveData ? "bg-mint animate-pulse" : "bg-amber"}`} />
            <span className="font-mono text-xs text-muted-foreground uppercase">
              {hasLiveData ? "Live" : loading ? "Loading..." : "Cached"}
            </span>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k, i) => (
            <GlassPanel key={i} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgMap[k.color]}`}>
                  <k.icon className={`w-4 h-4 ${colorMap[k.color]}`} />
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${
                  k.trend === "up" && k.color !== "coral" ? "bg-mint/15 text-mint" :
                  k.trend === "down" && k.color === "coral" ? "bg-mint/15 text-mint" :
                  "bg-coral/15 text-coral"
                }`}>
                  {k.trend === "up" ? <TrendingUp className="w-2.5 h-2.5"/> : <TrendingDown className="w-2.5 h-2.5"/>}
                </div>
              </div>
              <div className={`font-serif italic text-3xl mb-0.5 ${colorMap[k.color]}`}>{k.value}</div>
              <div className="font-mono text-xs text-muted-foreground uppercase mb-1">{k.label}</div>
              <div className="font-mono text-[11px] text-muted-foreground/50">{k.sub}</div>
            </GlassPanel>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-5">

          {/* Neighbourhood incident chart */}
          <GlassPanel className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif italic text-lg text-foreground">Live Incident Map</h2>
                <p className="font-mono text-xs text-muted-foreground">
                  Fire/rescue incidents per neighbourhood · ArcGIS
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className={`w-3.5 h-3.5 ${hasLiveData ? "text-mint" : "text-amber"}`}/>
                <span className={`font-mono text-xs ${hasLiveData ? "text-mint" : "text-amber"}`}>
                  {totalIncidents} total
                </span>
              </div>
            </div>
            {neighborhoods.length > 0 ? (
              <>
                <IncidentChart neighborhoods={neighborhoods} />
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
                  {[["bg-coral","HIGH"],["bg-amber","MEDIUM"],["bg-mint","LOW"]].map(([c,l]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-sm ${c}`}/>
                      <span className="font-mono text-[11px] text-muted-foreground">{l}</span>
                    </div>
                  ))}
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground/50">
                    Hover bars for details
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-20 gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground/40 animate-spin"/>
                <span className="font-mono text-xs text-muted-foreground">Loading neighbourhood data...</span>
              </div>
            )}
          </GlassPanel>

          {/* Neighbourhood risk ranking */}
          <GlassPanel className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif italic text-lg text-foreground">Risk Rankings</h2>
                <p className="font-mono text-xs text-muted-foreground">All {neighborhoods.length} areas · live scores</p>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber2"/>
                <span className="font-mono text-xs text-amber2">{highRiskCount} high risk</span>
              </div>
            </div>
            <div className="space-y-2.5 max-h-52 overflow-y-auto">
              {[...neighborhoods].sort((a,b) => b.risk_score - a.risk_score).map((n,i) => (
                <MiniBar key={n.id || i}
                  value={n.risk_score} max={99}
                  color={n.risk_level === "HIGH" ? "bg-coral" : n.risk_level === "MEDIUM" ? "bg-amber" : "bg-mint"}
                  label={n.name}
                  sublabel={`${n.risk_level} · ${n.live_fire || 0} fires`}
                />
              ))}
              {!neighborhoods.length && (
                <div className="text-center py-4">
                  <span className="font-mono text-xs text-muted-foreground">Loading...</span>
                </div>
              )}
            </div>
          </GlassPanel>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">

          {/* Journey history */}
          <GlassPanel className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif italic text-lg text-foreground">Your Journey Log</h2>
                <p className="font-mono text-xs text-muted-foreground">
                  From localStorage · {journeyStats.total} total journeys
                </p>
              </div>
              {journeyStats.total > 0 && (
                <div className="text-right">
                  <div className={`font-serif italic text-2xl ${safeRoutePct >= 80 ? "text-mint" : "text-amber"}`}>
                    {safeRoutePct}%
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">SAFE ARRIVAL RATE</div>
                </div>
              )}
            </div>
            {journeyStats.history.length > 0 ? (
              <div className="space-y-2">
                {journeyStats.history.map((j, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-bg3 border border-border/30">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${j.outcome === "SAFE" ? "bg-mint" : "bg-amber"}`}/>
                    <div className="flex-1 min-w-0">
                      <div className="font-sans text-xs text-foreground truncate">
                        {j.from} <span className="text-muted-foreground/40 mx-1">→</span> {j.to}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {j.date} · {j.duration} · {j.distance}
                      </div>
                    </div>
                    <span className={`font-mono text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                      j.outcome === "SAFE" ? "bg-mint/15 text-mint" : "bg-amber/15 text-amber"
                    }`}>{j.outcome}</span>
                  </div>
                ))}
                {journeyStats.total > 5 && (
                  <p className="font-mono text-[11px] text-muted-foreground/50 text-center pt-1">
                    +{journeyStats.total - 5} more journeys in history
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Navigation className="w-8 h-8 text-muted-foreground/20"/>
                <p className="font-mono text-xs text-muted-foreground">No journeys yet</p>
                <p className="font-mono text-xs text-muted-foreground/50">
                  Complete a journey to see your history here
                </p>
              </div>
            )}
          </GlassPanel>

          {/* Honest error log — what we DON'T have */}
          <GlassPanel className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-amber"/>
              <h2 className="font-serif italic text-lg text-foreground">Honest Limitations</h2>
            </div>
            <p className="font-sans text-[11px] text-muted-foreground mb-4 leading-relaxed">
              Full transparency on what this app can and can't do.
            </p>
            <div className="space-y-2.5">
              {[
                {
                  label: "311 Data — removed",
                  detail: "Montgomery ArcGIS 311 endpoint is geo-restricted. Complaint data is simulated near fire clusters.",
                  status: "known"
                },
                {
                  label: "Police CAD — not integrated",
                  detail: "Real-time police dispatch data is not publicly available via open API for Montgomery, AL.",
                  status: "known"
                },
                {
                  label: "IoT / lighting sensors — N/A",
                  detail: "No open sensor network exists for Montgomery street lighting or environmental hazards.",
                  status: "known"
                },
                {
                  label: "Historic crime data — not fetched",
                  detail: "UCR/NIBRS crime statistics require manual downloads. Not integrated in real-time.",
                  status: "known"
                },
              ].map((e, i) => (
                <div key={i} className="p-3 rounded-xl bg-bg3 border border-border/30">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-mono text-xs text-amber">{e.label}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-amber/15 text-amber font-mono text-[11px] uppercase flex-shrink-0">
                      Acknowledged
                    </span>
                  </div>
                  <p className="font-sans text-[11px] text-muted-foreground leading-snug">{e.detail}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* Data stream health */}
        <GlassPanel className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-sky"/>
              <h2 className="font-serif italic text-lg text-foreground">Data Stream Health</h2>
            </div>
            <div className={`px-3 py-1 rounded-full font-mono text-xs uppercase ${
              liveCount >= 5 ? "bg-mint/15 text-mint" : "bg-amber/15 text-amber"
            }`}>
              {liveCount}/{REAL_STREAMS.length} streams live
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {REAL_STREAMS.map((stream, i) => {
              const st = streamStatus(stream.key)
              return (
                <div key={i} className="flex items-center justify-between p-3 bg-bg3 rounded-xl border border-border/20">
                  <div className="flex items-center gap-3">
                    {st === "live"
                      ? <Wifi className="w-4 h-4 text-mint flex-shrink-0"/>
                      : st === "not_configured"
                        ? <WifiOff className="w-4 h-4 text-muted-foreground/40 flex-shrink-0"/>
                        : <Activity className="w-4 h-4 text-amber flex-shrink-0"/>
                    }
                    <div>
                      <div className="font-sans text-xs text-foreground">{stream.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground/60">{stream.note}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`w-1.5 h-1.5 rounded-full ${statusDot(st)}`}/>
                    <span className={`font-mono text-[11px] uppercase ${statusColor(st)}`}>
                      {statusLabel(st)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          {!hasEnvMapbox && (
            <div className="mt-3 p-3 rounded-xl bg-amber/8 border border-amber/20">
              <p className="font-mono text-xs text-amber">
                ⚠ Some .env keys not set — check the .env file. See Settings → Environment Status for details.
              </p>
            </div>
          )}
        </GlassPanel>

        <p className="font-mono text-[11px] text-muted-foreground/40 text-center pb-2">
          SafeRoute AI+ · World Wide Vibes Hackathon 2026 · Built solo from Nigeria
        </p>
      </div>
    </div>
  )
}