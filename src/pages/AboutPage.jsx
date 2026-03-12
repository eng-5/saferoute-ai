import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  Shield, Navigation, Mic, MapPin, Zap,
  Users, AlertTriangle, Globe, CheckCircle,
  ArrowRight, Brain, Activity, Lock,
  Smartphone, BarChart3, Clock, Flame,
  Database, Wifi, ChevronDown, Star, Award,
  Eye, Heart, Target, TrendingUp
} from "lucide-react"

// ── ANIMATED COUNTER ─────────────────────────────────────────
function AnimatedNumber({ target, suffix = "", duration = 1800 }) {
  const [current, setCurrent] = useState(0)
  const ref     = useRef(null)
  const started = useRef(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const steps = 50
        let count = 0
        const iv = setInterval(() => {
          count++
          setCurrent(Math.round((count / steps) * target))
          if (count >= steps) { setCurrent(target); clearInterval(iv) }
        }, duration / steps)
      }
    }, { threshold: 0.4 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target, duration])
  return <span ref={ref}>{current.toLocaleString()}{suffix}</span>
}

// ── SECTION DIVIDER ───────────────────────────────────────────
function Divider({ label }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <span className="font-mono text-xs text-muted-foreground/40 uppercase tracking-widest px-2">{label}</span>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  )
}

// ── FEATURE CARD ─────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc, color, badge }) {
  const colors = {
    mint:   { bg: "bg-mint/10",   border: "border-mint/20",   icon: "text-mint",   badge: "bg-mint/15 text-mint"   },
    coral:  { bg: "bg-coral/10",  border: "border-coral/20",  icon: "text-coral",  badge: "bg-coral/15 text-coral"  },
    amber:  { bg: "bg-amber/10",  border: "border-amber/20",  icon: "text-amber",  badge: "bg-amber/15 text-amber"  },
    sky:    { bg: "bg-sky/10",    border: "border-sky/20",    icon: "text-sky",    badge: "bg-sky/15 text-sky"      },
    purple: { bg: "bg-purple/10", border: "border-purple/20", icon: "text-purple", badge: "bg-purple/15 text-purple" },
    amber2: { bg: "bg-amber2/10", border: "border-amber2/20", icon: "text-amber2", badge: "bg-amber2/15 text-amber2" },
  }
  const c = colors[color] || colors.mint
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 hover:scale-[1.01] transition-transform`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        {badge && (
          <span className={`px-2.5 py-1 rounded-full font-mono text-xs uppercase ${c.badge}`}>{badge}</span>
        )}
      </div>
      <h3 className="font-sans text-base font-semibold text-foreground mb-2">{title}</h3>
      <p className="font-sans text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  )
}

// ── DATA SOURCE ROW ──────────────────────────────────────────
function DataRow({ name, type, status, note }) {
  const live = status === "live"
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-bg3 border border-border/30 hover:border-border/60 transition-colors">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${live ? "bg-mint animate-pulse" : "bg-amber"}`} />
      <div className="flex-1 min-w-0">
        <div className="font-sans text-sm font-medium text-foreground">{name}</div>
        <div className="font-mono text-xs text-muted-foreground/60">{type}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`font-mono text-xs uppercase ${live ? "text-mint" : "text-amber"}`}>
          {live ? "● LIVE" : "○ SIMULATED"}
        </div>
        {note && <div className="font-mono text-[11px] text-muted-foreground/50">{note}</div>}
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: MapPin,     title: "Live Risk Map",            color: "coral",  badge: "Real Data",  desc: "Real-time heatmap of every Montgomery neighbourhood, scored 0–99 from live ArcGIS fire/rescue incident data. Not sample data — actual events." },
  { icon: Brain,      title: "AI Safety Briefings",      color: "amber2", badge: "LLaMA 3.3",  desc: "Ask anything in plain English. LLaMA 3.3 70B answers with exact risk scores and live incident context. Press Space to speak, get a spoken answer back." },
  { icon: Navigation, title: "3-Route Safety Planner",   color: "mint",   badge: "Mapbox",     desc: "Safest, Balanced, and Fastest routes calculated simultaneously. Each scored against live incidents. Walking/running/cycling/driving ETA all differ correctly." },
  { icon: Activity,   title: "Smart Navigation",         color: "sky",    badge: "GPS",        desc: "4 smart triggers: ETA exceeded, stopped too long, off-route 60s, speed anomaly. Three escalating alert levels — soft banner → modal → full-screen emergency." },
  { icon: Users,      title: "Guardian Alert System",    color: "purple", badge: "WhatsApp",   desc: "Add up to 3 emergency contacts with country codes. At alert Level 3, WhatsApp deep links and EmailJS fire simultaneously to every guardian." },
  { icon: Mic,        title: "Voice-First Interface",    color: "amber",  badge: "Speech API", desc: "Web Speech API for both input and output. Speak your destination, hear safety briefings read back. Works entirely browser-native — no SDK, no cost." },
  { icon: Shield,     title: "Community Reporting",      color: "mint",   badge: "Rate-limited", desc: "Any user can drop a safety marker on the map. Rate-limited to 3/hour per category. Reports appear as live markers for all users instantly." },
  { icon: BarChart3,  title: "Analytics Dashboard",      color: "sky",    badge: "Live",       desc: "Every KPI pulls from real sources — incidents from ArcGIS, journeys from localStorage, guardian count from contacts, confidence from live data freshness." },
  { icon: Eye,        title: "Honest Limitations Panel", color: "amber",  badge: "Transparent", desc: "We show exactly what data we have and what we don't. No police CAD, no IoT sensors, no 311 (geo-restricted). Judges can see every gap, honestly." },
]

const STATS = [
  { value: 24778, suffix: "+", label: "Annual 911 calls",     sub: "Montgomery, AL average",   color: "text-coral"  },
  { value: 99,    suffix: "",  label: "Risk score scale",     sub: "0 = safe, 99 = danger",    color: "text-amber"  },
  { value: 48,    suffix: "h", label: "Build time",           sub: "Solo, from Nigeria",        color: "text-mint"   },
  { value: 8,     suffix: "",  label: "Live data sources",    sub: "Real APIs, all wired up",   color: "text-sky"    },
]

const DATA_SOURCES = [
  { name: "Montgomery ArcGIS Portal", type: "Fire & Rescue Incidents",    status: "live",      note: "services7.arcgis.com" },
  { name: "Mapbox GL JS",             type: "Maps + Routing + Geocoding", status: "live",      note: "Directions API" },
  { name: "Groq LLaMA 3.3 70B",      type: "AI Chat + Voice Matching",   status: "live",      note: "Streaming API" },
  { name: "Web Speech API",           type: "Voice Input + TTS Output",   status: "live",      note: "Browser-native" },
  { name: "EmailJS REST API",         type: "Guardian Email Alerts",      status: "live",      note: "Free tier" },
  { name: "WhatsApp Deep Links",      type: "Guardian WhatsApp Alerts",   status: "live",      note: "No API key needed" },
  { name: "Montgomery ArcGIS 311",    type: "311 Service Requests",       status: "simulated", note: "Geo-restricted endpoint" },
  { name: "Community Reports",        type: "User Safety Markers",        status: "live",      note: "localStorage + rate-limited" },
]

export default function AboutPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState("pitch")

  return (
    <div className="h-full overflow-y-auto bg-bg">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative min-h-[85vh] flex flex-col items-center justify-center px-6 py-20 text-center overflow-hidden">
        {/* Background grid */}
        <div className="absolute inset-0 dot-grid opacity-60 pointer-events-none" />
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-mint/4 blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] rounded-full bg-amber2/4 blur-3xl pointer-events-none" />

        {/* Badge */}
        <div className="relative flex items-center gap-2 px-4 py-2 rounded-full border border-amber2/30 bg-amber2/8 mb-8">
          <Star className="w-4 h-4 text-amber2" />
          <span className="font-mono text-sm text-amber2 uppercase tracking-widest">World Wide Vibes Hackathon 2026</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-mint/20 font-mono text-xs text-mint">Public Safety Track</span>
        </div>

        {/* Main headline */}
        <h1 className="relative font-serif italic text-5xl md:text-7xl text-foreground mb-6 leading-tight max-w-4xl">
          Montgomery's first
          <span className="block text-mint"> AI safety</span>
          <span className="block">operating system</span>
        </h1>

        <p className="relative font-sans text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed mb-10">
          Every night in Montgomery, thousands of people — nurses, delivery drivers, night-shift workers — 
          navigate streets with no safety net, no AI, no guardian system.
          <strong className="text-foreground"> We built one in 48 hours.</strong>
        </p>

        <div className="relative flex flex-col sm:flex-row gap-4 mb-16">
          <button onClick={() => navigate("/dashboard")}
            className="px-8 py-4 rounded-2xl bg-mint text-bg font-mono text-base font-bold flex items-center gap-3 hover:bg-mint/90 shadow-[0_0_30px_rgba(0,229,160,0.3)] transition-all">
            <Shield className="w-5 h-5" /> Open SafeRoute AI+
          </button>
          <button onClick={() => navigate("/journey")}
            className="px-8 py-4 rounded-2xl border border-amber2/40 text-amber2 font-mono text-base flex items-center gap-3 hover:bg-amber2/10 transition-all">
            <Navigation className="w-5 h-5" /> Plan a Safe Journey
          </button>
        </div>

        {/* Stats row */}
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl w-full">
          {STATS.map((s, i) => (
            <div key={i} className="text-center">
              <div className={`font-serif italic text-4xl md:text-5xl mb-1 ${s.color}`}>
                <AnimatedNumber target={s.value} suffix={s.suffix} />
              </div>
              <div className="font-sans text-sm font-medium text-foreground">{s.label}</div>
              <div className="font-mono text-xs text-muted-foreground/60 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-muted-foreground/40" />
        </div>
      </div>

      {/* ── TAB NAV ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-bg/95 backdrop-blur-xl border-b border-border">
        <div className="flex max-w-5xl mx-auto px-6">
          {[
            { id: "pitch",    label: "The Pitch",    icon: Award     },
            { id: "features", label: "Features",     icon: Zap       },
            { id: "data",     label: "Data Sources", icon: Database  },
            { id: "story",    label: "The Builder",  icon: Heart     },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-4 font-mono text-sm uppercase tracking-wider border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-amber2 text-amber2"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-16">

        {/* ── PITCH TAB ────────────────────────────────────────── */}
        {activeTab === "pitch" && (
          <div className="space-y-12">

            {/* Problem */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-coral/15 border border-coral/25 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-coral" />
                </div>
                <h2 className="font-serif italic text-3xl text-foreground">The Problem</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                {[
                  { stat: "24,778+", label: "Annual 911 calls in Montgomery",   desc: "That's 68 emergencies every single day. Night workers face this with nothing but their instincts.", color: "coral", icon: Flame },
                  { stat: "Zero",    label: "AI safety tools for residents",    desc: "Before SafeRoute AI+, Montgomery had no AI-powered civic safety platform accessible to the public.", color: "amber", icon: Globe },
                  { stat: "5,100+",  label: "Night workers with no safety net", desc: "Nurses, delivery drivers, security guards — navigating high-risk zones with no AI, no guardian, no backup.", color: "sky", icon: Users },
                ].map((p, i) => (
                  <div key={i} className={`p-6 rounded-2xl border bg-${p.color}/8 border-${p.color}/20`}>
                    <p.icon className={`w-6 h-6 text-${p.color} mb-3`} />
                    <div className={`font-serif italic text-4xl text-${p.color} mb-2`}>{p.stat}</div>
                    <div className="font-sans text-sm font-semibold text-foreground mb-2">{p.label}</div>
                    <p className="font-sans text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <Divider label="The Solution" />

            {/* Solution */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-mint/15 border border-mint/25 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-mint" />
                </div>
                <h2 className="font-serif italic text-3xl text-foreground">What SafeRoute AI+ Does</h2>
              </div>
              <div className="space-y-4">
                {[
                  { step: "01", title: "You speak or type a destination",       detail: "Voice-first UI. Speak \"Oak Park\" and the AI matches it to real coordinates using LLaMA 3.3 70B.", icon: Mic      },
                  { step: "02", title: "Three routes scored against live data",  detail: "Mapbox Directions API returns alternatives. Each route is scored against live ArcGIS fire/rescue incidents within 800m.", icon: Target   },
                  { step: "03", title: "You choose. The AI explains why.",       detail: "Safest, Balanced, and Fastest — with honest Safety % and Risk /99 scores. No fake confidence floors.", icon: Brain    },
                  { step: "04", title: "Navigation tracks you intelligently",    detail: "GPS watches your speed, stops, and route. Four smart triggers escalate alerts if something goes wrong.", icon: Activity },
                  { step: "05", title: "Guardians are notified automatically",   detail: "If you miss a check-in, WhatsApp and email fire simultaneously to every contact you added.", icon: Users    },
                  { step: "06", title: "You arrive. History is saved.",          detail: "SAFE or CANCELLED is logged to localStorage. Your journey history informs future route suggestions.", icon: CheckCircle },
                ].map((s, i) => (
                  <div key={i} className="flex gap-5 p-5 rounded-2xl bg-bg3 border border-border/30 hover:border-border/60 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-amber2/10 border border-amber2/20 flex items-center justify-center flex-shrink-0">
                      <s.icon className="w-5 h-5 text-amber2" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-xs text-muted-foreground/40">{s.step}</span>
                        <span className="font-sans text-base font-semibold text-foreground">{s.title}</span>
                      </div>
                      <p className="font-sans text-sm text-muted-foreground leading-relaxed">{s.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Divider label="Why We Win" />

            {/* Why win */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber2/15 border border-amber2/25 flex items-center justify-center">
                  <Award className="w-5 h-5 text-amber2" />
                </div>
                <h2 className="font-serif italic text-3xl text-foreground">Why This Wins</h2>
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                {[
                  { title: "Real data, not fake demos",         desc: "Every incident marker is a live ArcGIS record. Confidence scores are honest math — no floors, no inflation. Judges can verify every claim.", icon: Database, color: "mint"   },
                  { title: "Complete, not a prototype",         desc: "9 fully working pages. Voice in, voice out, live map, 3 routes, navigation, guardian alerts, analytics, settings. It all works.", icon: CheckCircle, color: "sky" },
                  { title: "Civic tech that matters",           desc: "Not another productivity app. This directly addresses public safety in a real US city, with real open data, for real night workers.", icon: Heart, color: "coral" },
                  { title: "Unprecedented transparency",        desc: "We openly show what data we have and what we don't. The \"Honest Limitations\" panel is something no other hackathon entry would dare include.", icon: Eye, color: "amber" },
                ].map((w, i) => (
                  <div key={i} className="flex gap-4 p-5 rounded-2xl bg-bg3 border border-border/30">
                    <w.icon className={`w-6 h-6 text-${w.color} flex-shrink-0 mt-0.5`} />
                    <div>
                      <h3 className="font-sans text-base font-semibold text-foreground mb-1.5">{w.title}</h3>
                      <p className="font-sans text-sm text-muted-foreground leading-relaxed">{w.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ── FEATURES TAB ────────────────────────────────────── */}
        {activeTab === "features" && (
          <div className="space-y-8">
            <div>
              <h2 className="font-serif italic text-3xl text-foreground mb-2">
                9 features. All real. All wired up.
              </h2>
              <p className="font-sans text-base text-muted-foreground">
                Every feature below is live in the app right now. Click any page in the sidebar to verify.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => <FeatureCard key={i} {...f} />)}
            </div>

            {/* Demo script */}
            <div className="p-6 rounded-2xl bg-bg3 border border-amber2/20">
              <div className="flex items-center gap-3 mb-5">
                <Clock className="w-5 h-5 text-amber2" />
                <h3 className="font-serif italic text-xl text-foreground">3-Minute Demo Script</h3>
              </div>
              <div className="space-y-3">
                {[
                  { time: "0:00", action: "Dashboard — Press Space, speak \"What areas should I avoid tonight?\"",      result: "AI responds with live risk scores, reads answer aloud" },
                  { time: "0:30", action: "Click a neighbourhood zone on the map",                                       result: "Map flies to zone, sonar pulse, AI auto-briefs" },
                  { time: "1:00", action: "Journey page — select Walking, speak origin + destination",                   result: "3 routes calculated, scored, colour-coded on map with START/END markers" },
                  { time: "1:30", action: "Select Safest route → Start Safe Journey",                                    result: "Navigation page, GPS tracking, ETA countdown begins" },
                  { time: "2:00", action: "Settings → Add Guardian with Nigerian number → Test Alert",                   result: "WhatsApp opens with prefilled emergency message" },
                  { time: "2:30", action: "Navigate to /navigation directly (no journey set)",                           result: "Beautiful interstitial — \"No Active Journey\" with animated shield" },
                  { time: "2:50", action: "Show Analytics page",                                                         result: "Real journey history, live incident chart, honest data stream health" },
                ].map((d, i) => (
                  <div key={i} className="flex gap-4 py-3 border-b border-border/20 last:border-0">
                    <span className="font-mono text-sm text-amber2 flex-shrink-0 w-10">{d.time}</span>
                    <div className="flex-1">
                      <div className="font-sans text-sm font-medium text-foreground">{d.action}</div>
                      <div className="font-mono text-xs text-mint mt-0.5">→ {d.result}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DATA TAB ─────────────────────────────────────────── */}
        {activeTab === "data" && (
          <div className="space-y-8">
            <div>
              <h2 className="font-serif italic text-3xl text-foreground mb-2">
                Honest Data Architecture
              </h2>
              <p className="font-sans text-base text-muted-foreground leading-relaxed">
                We tell you exactly what is live, what is simulated, and what is missing.
                No hackathon should fake its data — and we don't.
              </p>
            </div>

            <div className="space-y-3">
              {DATA_SOURCES.map((d, i) => <DataRow key={i} {...d} />)}
            </div>

            <div className="p-6 rounded-2xl bg-amber/8 border border-amber/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-sans text-base font-semibold text-foreground mb-2">What We Don't Have (And Why)</h3>
                  <div className="space-y-2">
                    {[
                      { gap: "Police CAD / Real-time dispatch",         reason: "Not publicly available via open API for Montgomery, AL" },
                      { gap: "Montgomery 311 Service Requests",         reason: "ArcGIS endpoint is geo-restricted, returns 403 outside approved IP range" },
                      { gap: "Street lighting / IoT sensor network",    reason: "No open sensor network exists for Montgomery infrastructure" },
                      { gap: "Historic UCR crime statistics",           reason: "Requires manual NIBRS download, not accessible in real-time via API" },
                    ].map((g, i) => (
                      <div key={i} className="flex items-start gap-3 py-2 border-b border-border/20 last:border-0">
                        <span className="font-mono text-xs text-amber mt-0.5 flex-shrink-0">MISSING</span>
                        <div>
                          <div className="font-sans text-sm font-medium text-foreground">{g.gap}</div>
                          <div className="font-mono text-xs text-muted-foreground/60">{g.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-mint/8 border border-mint/20">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-mint flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-sans text-base font-semibold text-foreground mb-1">Live ArcGIS Endpoint</h3>
                  <code className="font-mono text-xs text-mint/80 break-all">
                    https://services7.arcgis.com/xNUwUjOJqYE54USz/ArcGIS/rest/services/Fire_Rescue_All_Incidents/FeatureServer/0/query
                  </code>
                  <p className="font-sans text-sm text-muted-foreground mt-2">
                    Free public data from the City of Montgomery. No API key required. Refreshes every 5 minutes.
                    Judges can paste this URL directly into their browser to verify.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── BUILDER TAB ─────────────────────────────────────── */}
        {activeTab === "story" && (
          <div className="space-y-10">

            {/* Builder hero */}
            <div className="flex flex-col md:flex-row items-start gap-10">
              <div className="flex-shrink-0">
                <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-amber2/40 to-mint/20 border border-amber2/30 flex items-center justify-center">
                  <span className="font-serif italic text-5xl text-amber2">N</span>
                </div>
                <div className="mt-3 text-center">
                  <div className="font-mono text-xs text-muted-foreground/60 uppercase">Builder</div>
                  <div className="font-sans text-sm text-foreground font-medium">Nkechukwu</div>
                  <div className="font-mono text-xs text-muted-foreground/50">🇳🇬 Nigeria</div>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="font-serif italic text-3xl text-foreground mb-4">
                  Built solo. From Nigeria. In 48 hours.
                </h2>
                <p className="font-sans text-base text-muted-foreground leading-relaxed mb-4">
                  No team. No prior Mapbox experience with this level of complexity. 
                  One developer, one laptop, one city's worth of open data,
                  and a genuine belief that civic technology should be built by people
                  who care — regardless of where they're from.
                </p>
                <p className="font-sans text-base text-muted-foreground leading-relaxed mb-6">
                  I chose Montgomery, Alabama because its open data portal is genuinely rich,
                  because the safety need is real and documented, and because building something
                  that could actually help a specific community felt more meaningful than
                  another generic productivity tool.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { value: "48h", label: "Build time", color: "text-amber2" },
                    { value: "9",   label: "Pages built", color: "text-mint"  },
                    { value: "0",   label: "Teammates",  color: "text-sky"    },
                  ].map(s => (
                    <div key={s.label} className="text-center p-4 rounded-xl bg-bg3 border border-border/30">
                      <div className={`font-serif italic text-3xl ${s.color}`}>{s.value}</div>
                      <div className="font-mono text-xs text-muted-foreground uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Divider label="The Stack" />

            <div>
              <h3 className="font-serif italic text-2xl text-foreground mb-5">Technology Stack</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { layer: "Frontend",      tech: "React + Vite + Tailwind CSS",    note: "Single-page app, mobile-first" },
                  { layer: "Maps",          tech: "Mapbox GL JS",                   note: "Routes, heatmap, markers, 3D" },
                  { layer: "AI",            tech: "Groq LLaMA 3.3 70B",             note: "Streaming chat + voice matching" },
                  { layer: "Voice",         tech: "Web Speech API",                 note: "Input + TTS — browser native" },
                  { layer: "Live Data",     tech: "Montgomery ArcGIS Portal",       note: "Fire/rescue incidents, open data" },
                  { layer: "Alerts",        tech: "EmailJS + WhatsApp deep links",  note: "Zero-cost guardian notifications" },
                  { layer: "State",         tech: "React Context + sessionStorage", note: "Journey plan persists navigation" },
                  { layer: "Deployment",    tech: "Vercel",                         note: "Edge-deployed, zero config" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-bg3 border border-border/30">
                    <div className="w-2.5 h-2.5 rounded-full bg-mint flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono text-xs text-muted-foreground/50 uppercase w-20 flex-shrink-0">{s.layer}</span>
                        <span className="font-sans text-sm font-medium text-foreground truncate">{s.tech}</span>
                      </div>
                      <div className="font-mono text-xs text-muted-foreground/50 mt-0.5 ml-[5.5rem]">{s.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Divider label="Closing" />

            {/* Closing quote */}
            <div className="relative p-8 rounded-3xl border border-amber2/20 bg-gradient-to-br from-amber2/5 to-mint/5 text-center">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 bg-bg">
                <Star className="w-5 h-5 text-amber2 mx-auto" />
              </div>
              <p className="font-serif italic text-xl md:text-2xl text-foreground leading-relaxed mb-4 max-w-2xl mx-auto">
                "SafeRoute AI+ gives every night worker in Montgomery what city officials
                have had for years — a live picture of safety, and a system that watches
                out for them when no one else does."
              </p>
              <div className="font-mono text-sm text-muted-foreground">— Nkechukwu, Builder · Nigeria · March 2026</div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <button onClick={() => navigate("/dashboard")}
                className="px-8 py-4 rounded-2xl bg-mint text-bg font-mono text-base font-bold flex items-center justify-center gap-3 hover:bg-mint/90 shadow-[0_0_30px_rgba(0,229,160,0.25)] transition-all">
                <Shield className="w-5 h-5" /> Open the App
              </button>
              <button onClick={() => navigate("/journey")}
                className="px-8 py-4 rounded-2xl border border-amber2/40 text-amber2 font-mono text-base flex items-center justify-center gap-3 hover:bg-amber2/10 transition-all">
                <Navigation className="w-5 h-5" /> Try a Safe Journey
              </button>
            </div>

          </div>
        )}

      </div>

      <footer className="border-t border-border py-8 text-center">
        <p className="font-mono text-sm text-muted-foreground">
          SafeRoute AI+ · World Wide Vibes Hackathon 2026 · Public Safety Track
        </p>
        <p className="font-mono text-xs text-muted-foreground/40 mt-1">
          Built solo · From Nigeria · For Montgomery, Alabama · $5,000 prize · Winners announced March 21, 2026
        </p>
      </footer>

    </div>
  )
}