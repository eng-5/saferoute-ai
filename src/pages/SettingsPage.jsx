import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { GlassPanel } from "@/components/glass-panel"
import { GuardianContacts } from "@/components/guardian-contacts"
import { useSafety } from "@/context/SafetyContext"
import {
  Shield, Bell, Eye, User, Lock, ChevronRight, LogOut, Mic, Moon, Sun,
  Database, Wifi, WifiOff, MapPin, Activity, Check, AlertCircle,
  Volume2, VolumeX, Navigation, Clock, Flame, RefreshCw, Trash2,
  Info, Star, Globe, Key, Cpu, Phone, CheckCircle, Award, TrendingUp,
  ChevronDown, ExternalLink
} from "lucide-react"
 
// ── TOGGLE ────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} disabled={disabled}
      aria-checked={on} role="switch"
      className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber2/50 ${
        on ? "bg-mint shadow-[0_0_10px_rgba(0,229,160,0.3)]" : "bg-bg3 border border-border/40"
      } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
      <div className={`absolute top-1 w-4 h-4 rounded-full transition-transform ${
        on ? "translate-x-6 bg-bg" : "translate-x-1 bg-muted-foreground/60"
      }`}/>
    </button>
  )
}
 
// ── SECTION HEADER ────────────────────────────────────────────
function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 px-1 mb-3">
      <div className="w-7 h-7 rounded-lg bg-amber2/10 border border-amber2/20 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5 text-amber2"/>
      </div>
      <div>
        <h3 className="font-mono text-xs text-foreground uppercase tracking-wider">{title}</h3>
        {subtitle && <p className="font-mono text-[11px] text-muted-foreground/60">{subtitle}</p>}
      </div>
    </div>
  )
}
 
// ── SETTINGS ITEM ─────────────────────────────────────────────
function SettingItem({ label, description, on, onChange, badge, disabled }) {
  return (
    <GlassPanel className={`p-4 transition-all ${disabled ? "opacity-60" : "hover:border-border/60"}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-sans text-sm font-medium text-foreground">{label}</span>
            {badge && (
              <span className={`px-1.5 py-0.5 rounded-full font-mono text-[7px] uppercase ${
                badge === "Live" ? "bg-mint/15 text-mint" :
                badge === "Pro" ? "bg-amber2/15 text-amber2" : "bg-bg3 text-muted-foreground"
              }`}>{badge}</span>
            )}
          </div>
          <p className="font-sans text-[11px] text-muted-foreground leading-snug">{description}</p>
        </div>
        <Toggle on={on} onChange={onChange} disabled={disabled}/>
      </div>
    </GlassPanel>
  )
}
 
// ── ENV KEY ROW ───────────────────────────────────────────────
function EnvRow({ name, varName, present, description }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-bg3 border border-border/20">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
        present ? "bg-mint/15" : "bg-coral/10"
      }`}>
        <Key className={`w-3.5 h-3.5 ${present ? "text-mint" : "text-coral/60"}`}/>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-mono text-xs text-foreground">{varName}</span>
          {present
            ? <span className="px-1.5 py-0.5 rounded-full bg-mint/15 font-mono text-[7px] text-mint">SET ✓</span>
            : <span className="px-1.5 py-0.5 rounded-full bg-coral/10 font-mono text-[7px] text-coral/80">MISSING</span>
          }
        </div>
        <p className="font-mono text-xs text-muted-foreground/60">{name} · {description}</p>
      </div>
    </div>
  )
}
 
const SETTING_GROUPS = [
  {
    id: "safety", title: "Safety Intelligence", icon: Shield,
    subtitle: "Controls AI-powered protection features",
    items: [
      { id: "guardian",  label: "Guardian Auto-Notify",     description: "Notify trusted contacts when you start a trip", badge: "Live"  },
      { id: "voice",     label: "Voice Guidance",           description: "AI reads route safety alerts aloud during navigation" },
      { id: "risk",      label: "Aggressive Risk Detection",description: "Alert on subtle GPS pattern irregularities (speed anomaly, dwell)" },
      { id: "checkin",   label: "Smart Check-ins",          description: "AI prompts safety confirmation when you exceed ETA or stop unexpectedly" },
    ]
  },
  {
    id: "alerts", title: "Notifications & Alerts", icon: Bell,
    subtitle: "When and how SafeRoute contacts you",
    items: [
      { id: "anomalies", label: "Street Anomaly Alerts",    description: "Real-time push when new fire/rescue incidents appear near your route" },
      { id: "sound",     label: "Alert Sound Effects",      description: "Audio cues for safety events (uses Web Audio API, no downloads)" },
      { id: "broadcast", label: "Broadcast Toasts",         description: "Slide-in notifications for high-risk community reports" },
    ]
  },
  {
    id: "privacy", title: "Privacy & Data", icon: Eye,
    subtitle: "What gets stored and where",
    items: [
      { id: "location",  label: "Journey History",          description: "Save completed journeys to localStorage for route suggestions" },
      { id: "anon",      label: "Anonymous Community Reports", description: "Submit safety reports without identifying information" },
      { id: "gps_watch", label: "Continuous GPS Tracking",  description: "Background watchPosition during active navigation", badge: "Live" },
    ]
  },
]
 
const DEFAULTS = {
  guardian: true, voice: true, risk: false, checkin: true,
  anomalies: true, sound: true, broadcast: true,
  location: true, anon: true, gps_watch: true,
}
 
export default function SettingsPage() {
  const navigate = useNavigate()
  const {
    neighborhoods = [], fireIncidents = [], hasLiveData, loading,
    confidenceScore, currentRisk, activeJourney, stats = {},
  } = useSafety()

  const [aboutOpen, setAboutOpen] = useState(false)
 
  const [toggles, setToggles] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("saferoute_settings") || "{}")
      return { ...DEFAULTS, ...saved }
    } catch { return DEFAULTS }
  })
  const [fakeCaller,    setFakeCaller]    = useState(() => {
    try { return localStorage.getItem("saferoute_fake_caller") || "Mom" } catch { return "Mom" }
  })
  const [offlineCached, setOfflineCached] = useState(false)
  const [cachingOffline, setCachingOffline] = useState(false)
 
  const journeyCount = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("saferoute_journeys") || "[]").length }
    catch { return 0 }
  }, [])
  const guardianCount = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("saferoute_contacts") || "[]").length }
    catch { return 0 }
  }, [])
  const communityCount = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("saferoute_community_reports") || "[]").length }
    catch { return 0 }
  }, [])
 
  const toggle = (id) => {
    const next = { ...toggles, [id]: !toggles[id] }
    setToggles(next)
    try { localStorage.setItem("saferoute_settings", JSON.stringify(next)) } catch {}
    if (id === "sound") {
      try { localStorage.setItem("saferoute_sound", next.sound ? "1" : "0") } catch {}
    }
  }
 
  const saveFakeCaller = (name) => {
    setFakeCaller(name)
    try { localStorage.setItem("saferoute_fake_caller", name) } catch {}
  }
 
  const cacheOfflinePack = async () => {
    setCachingOffline(true)
    try {
      const cache = await caches.open("saferoute-offline-v1")
      await cache.addAll([
        "/data/montgomery-data.json",
        "/",
      ])
      // Store emergency contacts snapshot
      const contacts = localStorage.getItem("saferoute_contacts") || "[]"
      const journeys = localStorage.getItem("saferoute_journeys") || "[]"
      localStorage.setItem("saferoute_offline_contacts", contacts)
      localStorage.setItem("saferoute_offline_journeys", journeys)
      localStorage.setItem("saferoute_offline_cached_at", Date.now().toString())
      setOfflineCached(true)
    } catch {
      setOfflineCached(false)
    }
    setCachingOffline(false)
  }
 
  const clearJourneyHistory = () => {
    try { localStorage.removeItem("saferoute_journeys"); window.location.reload() } catch {}
  }
  const clearCommunityReports = () => {
    try { localStorage.removeItem("saferoute_community_reports"); window.location.reload() } catch {}
  }
 
  const envKeys = [
    { name: "Mapbox",   varName: "VITE_MAPBOX_TOKEN",          present: !!import.meta.env.VITE_MAPBOX_TOKEN,          description: "Maps + routing + geocoding"        },
    { name: "Groq",     varName: "VITE_GROQ_API_KEY",          present: !!import.meta.env.VITE_GROQ_API_KEY,          description: "AI chat + voice interpretation"     },
    { name: "EmailJS",  varName: "VITE_EMAILJS_SERVICE_ID",    present: !!import.meta.env.VITE_EMAILJS_SERVICE_ID,    description: "Emergency email to guardians"       },
    { name: "EmailJS",  varName: "VITE_EMAILJS_TEMPLATE_ID",   present: !!import.meta.env.VITE_EMAILJS_TEMPLATE_ID,   description: "Email template for alerts"          },
    { name: "EmailJS",  varName: "VITE_EMAILJS_PUBLIC_KEY",    present: !!import.meta.env.VITE_EMAILJS_PUBLIC_KEY,    description: "EmailJS public key"                 },
  ]
  const keysSet = envKeys.filter(k => k.present).length
  const keysTotal = envKeys.length
 
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-8 pb-12">
 
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif italic text-3xl text-foreground">Settings</h1>
            <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-wider">
              SafeRoute AI+ · Your configuration
            </p>
          </div>
          {activeJourney && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-mint/15 border border-mint/25">
              <Navigation className="w-3.5 h-3.5 text-mint animate-pulse"/>
              <span className="font-mono text-xs text-mint uppercase">Journey Active</span>
            </div>
          )}
        </div>
 
        {/* System status card */}
        <GlassPanel className="p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionHeader icon={Activity} title="System Status" subtitle="Live data and API health" />
            <div className={`px-2.5 py-1 rounded-full font-mono text-xs uppercase ${
              hasLiveData ? "bg-mint/15 text-mint" : loading ? "bg-amber/15 text-amber" : "bg-coral/10 text-coral/80"
            }`}>
              {hasLiveData ? "● ALL SYSTEMS GO" : loading ? "● LOADING..." : "○ OFFLINE"}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Risk Level",    value: currentRisk?.level || "—",     color: currentRisk?.level === "HIGH" ? "text-coral" : currentRisk?.level === "MEDIUM" ? "text-amber" : "text-mint" },
              { label: "AI Confidence", value: `${Math.round(confidenceScore)}%`, color: "text-mint"   },
              { label: "Live Incidents",value: fireIncidents.length,           color: fireIncidents.length > 10 ? "text-coral" : "text-amber" },
              { label: "Zones Mapped",  value: neighborhoods.length,          color: "text-sky"    },
            ].map(s => (
              <div key={s.label} className="bg-bg3 rounded-xl p-3 text-center">
                <div className={`font-serif italic text-2xl ${s.color}`}>{s.value}</div>
                <div className="font-mono text-[11px] text-muted-foreground uppercase mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {/* API key mini status */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-bg3 border border-border/20">
            <div className="flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-muted-foreground"/>
              <span className="font-mono text-xs text-foreground">Environment Keys</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${keysSet === keysTotal ? "bg-mint animate-pulse" : "bg-amber"}`}/>
              <span className={`font-mono text-xs ${keysSet === keysTotal ? "text-mint" : "text-amber"}`}>
                {keysSet}/{keysTotal} configured
              </span>
            </div>
          </div>
        </GlassPanel>
 
        {/* Profile */}
        <GlassPanel className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber2/30 to-mint/20 border border-amber2/25 flex items-center justify-center">
                <User className="w-7 h-7 text-amber2"/>
              </div>
              {hasLiveData && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-mint border-2 border-bg flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-bg"/>
                </div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="font-sans text-base font-semibold text-foreground">SafeRoute Traveller</h2>
              <p className="font-mono text-xs text-muted-foreground">Montgomery, Alabama</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="font-mono text-xs text-muted-foreground/60">
                  <span className="text-mint">{journeyCount}</span> journeys
                </span>
                <span className="text-border">·</span>
                <span className="font-mono text-xs text-muted-foreground/60">
                  <span className="text-amber2">{guardianCount}</span> guardians
                </span>
                <span className="text-border">·</span>
                <span className="font-mono text-xs text-muted-foreground/60">
                  <span className="text-sky">{communityCount}</span> reports
                </span>
              </div>
            </div>
          </div>
        </GlassPanel>
 
        {/* Guardian Contacts */}
        <div>
          <SectionHeader icon={Shield} title="Guardian Contacts"
            subtitle="Emergency contacts notified if you don't check in" />
          <GlassPanel className="p-5">
            <GuardianContacts/>
          </GlassPanel>
        </div>
 
        {/* Settings toggles */}
        {SETTING_GROUPS.map(group => (
          <div key={group.id}>
            <SectionHeader icon={group.icon} title={group.title} subtitle={group.subtitle}/>
            <div className="space-y-2">
              {group.items.map(item => (
                <SettingItem key={item.id}
                  label={item.label} description={item.description}
                  badge={item.badge} on={toggles[item.id]}
                  onChange={() => toggle(item.id)}/>
              ))}
            </div>
          </div>
        ))}
 
        {/* Environment keys */}
        <div>
          <SectionHeader icon={Key} title="Environment Keys"
            subtitle="Required .env variables — check your .env file" />
          <div className="space-y-2">
            {envKeys.map((k, i) => <EnvRow key={i} {...k}/>)}
          </div>
          <div className="mt-3 p-4 rounded-xl bg-bg3 border border-border/30">
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Create a <span className="text-amber2">.env</span> file in your project root. Keys prefixed with{" "}
              <span className="text-amber2">VITE_</span> are exposed to the browser bundle. Never commit this file.
              Copy <span className="text-sky">.env.example</span> to get started.
            </p>
          </div>
        </div>
 
        {/* Data management */}
        <div>
          <SectionHeader icon={Database} title="Local Data"
            subtitle="Data stored in your browser's localStorage" />
          <div className="space-y-2">
            {[
              { label: "Journey History",      count: journeyCount,    key: "journeys",  onClear: clearJourneyHistory    },
              { label: "Community Reports",    count: communityCount,  key: "reports",   onClear: clearCommunityReports  },
            ].map(d => (
              <GlassPanel key={d.key} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-sans text-sm font-medium text-foreground">{d.label}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {d.count} {d.count === 1 ? "entry" : "entries"} · localStorage
                    </div>
                  </div>
                  {d.count > 0 && (
                    <button onClick={d.onClear}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted-foreground font-mono text-xs uppercase hover:border-coral/40 hover:text-coral transition-colors">
                      <Trash2 className="w-3 h-3"/> Clear
                    </button>
                  )}
                </div>
              </GlassPanel>
            ))}
          </div>
        </div>
 
        {/* ── About This App — full pitch panel ── */}
        <GlassPanel className="overflow-hidden">
          {/* Collapsible header */}
          <button
            onClick={() => setAboutOpen(o => !o)}
            className="w-full flex items-center justify-between p-5 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber2/15 border border-amber2/25 flex items-center justify-center flex-shrink-0">
                <Award className="w-4 h-4 text-amber2"/>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-foreground uppercase tracking-wider">About SafeRoute AI+</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber2/10 border border-amber2/20 font-mono text-[10px] text-amber2">WWV 2026</span>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">Built solo from Nigeria · Public Safety Track</p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${aboutOpen ? "rotate-180" : ""}`}/>
          </button>

          {aboutOpen && (
            <div className="px-5 pb-5 space-y-5 border-t border-border/20">

              {/* Tagline */}
              <div className="pt-4">
                <p className="font-serif italic text-base text-foreground leading-relaxed">
                  "Real-time AI safety intelligence for every journey — powered by live fire/rescue data, Groq LLaMA 3.3, and a three-layer guardian system."
                </p>
              </div>

              {/* Tech stack grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  ["Version",      "2.0.0",            "text-foreground"],
                  ["Framework",    "React + Vite",     "text-sky"],
                  ["AI Engine",    "LLaMA 3.3 70B",    "text-amber2"],
                  ["Live Data",    "ArcGIS Open Data", "text-mint"],
                  ["Maps",         "Mapbox GL JS",      "text-sky"],
                  ["Alerts",       "EmailJS + SMS",    "text-amber2"],
                ].map(([label, val, col]) => (
                  <div key={label} className="bg-bg3 rounded-xl p-3">
                    <div className="font-mono text-[10px] text-muted-foreground uppercase mb-1">{label}</div>
                    <div className={`font-mono text-xs ${col}`}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Features list */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-mint"/>
                  <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">Key Features</span>
                </div>
                <div className="space-y-2">
                  {[
                    ["🗺",  "AI Route Scoring",         "3 colour-coded routes ranked by live fire/rescue incidents"],
                    ["🤖",  "AI Situational Brief",      "Groq LLaMA streams a 3-sentence real-time area briefing"],
                    ["📡",  "Silent Distress Broadcast", "6 one-tap presets → WhatsApp + email + clipboard with GPS"],
                    ["📞",  "Fake Call / Cover Me",      "Simulated incoming call from a named contact for safety cover"],
                    ["🛡",  "Guardian Live Watch",       "Share /watch link — guardian sees your route start & ETA"],
                    ["⏱",  "Arrive Safe Timer",          "Alert guardians if you don't arrive within your set window"],
                    ["🧠",  "Safe Corridor Learning",    "Post-journey feeling saved → personalises future route risk"],
                    ["🔴",  "Long-press SOS",            "2s hold → silent distress; tap → immediate emergency alert"],
                  ].map(([icon, title, desc]) => (
                    <div key={title} className="flex items-start gap-3 p-2.5 bg-bg3/50 rounded-xl">
                      <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
                      <div>
                        <div className="font-mono text-xs text-foreground">{title}</div>
                        <div className="font-mono text-[10px] text-muted-foreground/70 mt-0.5 leading-relaxed">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data sources */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-3.5 h-3.5 text-sky"/>
                  <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">Data Sources</span>
                </div>
                <div className="space-y-2">
                  {[
                    ["Montgomery Fire/Rescue", "ArcGIS Open Data", "Live", "text-mint"],
                    ["Risk Scoring",           "AI composite model","Derived","text-amber2"],
                    ["Route Geometry",         "Mapbox Directions","Live", "text-sky"],
                    ["311 Reports",            "Community sourced", "Simulated","text-muted-foreground"],
                  ].map(([src, detail, status, col]) => (
                    <div key={src} className="flex items-center justify-between p-2.5 bg-bg3/50 rounded-xl">
                      <div>
                        <div className="font-mono text-xs text-foreground">{src}</div>
                        <div className="font-mono text-[10px] text-muted-foreground/60">{detail}</div>
                      </div>
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded-full bg-bg3 border border-border/30 ${col}`}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Builder note */}
              <div className="p-3 rounded-xl bg-mint/6 border border-mint/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield className="w-3.5 h-3.5 text-mint"/>
                  <span className="font-mono text-[11px] text-mint uppercase tracking-wider">The Builder</span>
                </div>
                <p className="font-mono text-xs text-foreground/80 leading-relaxed">
                  Nkechukwu — solo developer, Nigeria. Built SafeRoute AI+ for the World Wide Vibes Hackathon 2026 Public Safety track. Full-stack from scratch: React, Mapbox GL, Groq LLaMA, live ArcGIS data, and EmailJS guardian alerts.
                </p>
              </div>

              {/* Full pitch link */}
              <button
                onClick={() => navigate("/about")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-amber2/30 text-amber2 font-mono text-xs uppercase tracking-wider hover:bg-amber2/8 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5"/>
                View Full Pitch Deck
              </button>
            </div>
          )}
        </GlassPanel>
 
        {/* Cover Me / Fake Call settings */}
        <GlassPanel className="p-5 space-y-4">
          <SectionHeader icon={Phone} title="Cover Me" subtitle="Fake incoming call for safety cover" />
          <div className="space-y-3">
            <div>
              <div className="font-mono text-xs text-muted-foreground uppercase mb-2">Fake Caller Name</div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {["Mom","Dad","Work","Partner"].map(name => (
                  <button
                    key={name}
                    onClick={() => saveFakeCaller(name)}
                    className={`py-2 rounded-xl font-mono text-xs border transition-all ${
                      fakeCaller === name
                        ? "bg-sky/10 border-sky/30 text-sky"
                        : "border-border/40 text-muted-foreground hover:border-border/70"
                    }`}
                  >{name}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={fakeCaller}
                  onChange={e => saveFakeCaller(e.target.value)}
                  placeholder="Or type a custom name…"
                  maxLength={20}
                  className="flex-1 bg-bg3 border border-border/40 rounded-xl px-3 py-2.5 font-mono text-sm text-foreground focus:outline-none focus:border-sky/40 placeholder:text-muted-foreground/40"
                />
                <div className="px-3 py-2.5 rounded-xl bg-sky/8 border border-sky/20 font-mono text-xs text-sky whitespace-nowrap">
                  📞 {fakeCaller || "Mom"}
                </div>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground/40 mt-1.5">
                Shown on the fake incoming call screen · Tip: "Mom" or "Work" are most believable
              </p>
            </div>
          </div>
        </GlassPanel>
 
        {/* Offline Emergency Pack */}
        <GlassPanel className="p-5 space-y-4">
          <SectionHeader icon={WifiOff} title="Offline Emergency Pack" subtitle="Save critical data for no-signal situations" />
          <div className="space-y-3">
            <p className="font-sans text-sm text-muted-foreground leading-relaxed">
              Cache Montgomery emergency contacts, live risk data, and your guardian list so SafeRoute AI+ works without a network connection.
            </p>
            {(() => {
              const cachedAt = localStorage.getItem("saferoute_offline_cached_at")
              const timeStr  = cachedAt
                ? new Date(parseInt(cachedAt)).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : null
              return timeStr ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-mint/8 border border-mint/20">
                  <CheckCircle className="w-3.5 h-3.5 text-mint flex-shrink-0"/>
                  <span className="font-mono text-xs text-mint">Cached {timeStr}</span>
                </div>
              ) : null
            })()}
            <div className="grid grid-cols-1 gap-2 text-sm">
              {[
                ["Montgomery emergency contacts",  "📞"],
                ["Guardian contact list snapshot", "👥"],
                ["Risk zone data (ArcGIS)",        "🗺"],
                ["App shell + core assets",        "📱"],
              ].map(([label, icon]) => (
                <div key={label} className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <span>{icon}</span>{label}
                </div>
              ))}
            </div>
            <button
              onClick={cacheOfflinePack}
              disabled={cachingOffline}
              className={`w-full py-3 rounded-xl font-mono text-sm uppercase font-bold flex items-center justify-center gap-2 transition-all ${
                offlineCached
                  ? "bg-mint/10 border border-mint/30 text-mint"
                  : "bg-amber2/10 border border-amber2/30 text-amber2 hover:bg-amber2/15"
              } disabled:opacity-60`}
            >
              {cachingOffline ? (
                <><RefreshCw className="w-4 h-4 animate-spin"/> Caching…</>
              ) : offlineCached ? (
                <><Check className="w-4 h-4"/> Emergency Pack Saved</>
              ) : (
                <><Database className="w-4 h-4"/> Cache Emergency Pack</>
              )}
            </button>
            <p className="font-mono text-[10px] text-muted-foreground/40 text-center">
              Montgomery Non-Emergency Police: (334) 241-2651 · Baptist Medical Center: (334) 301-1000
            </p>
          </div>
        </GlassPanel>
 
        {/* Account actions */}
        <div className="space-y-2">
          {[
            { icon: Lock, label: "Change Password", color: "text-sky" },
          ].map(a => (
            <button key={a.label} className="w-full p-4 glass rounded-xl flex items-center justify-between group hover:bg-bg3/50 transition-all">
              <div className="flex items-center gap-3">
                <a.icon className={`w-4 h-4 ${a.color}`}/>
                <span className="font-sans text-sm text-foreground">{a.label}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform"/>
            </button>
          ))}
          <button className="w-full p-4 glass rounded-xl flex items-center justify-between group hover:bg-coral/5 transition-all text-coral border border-transparent hover:border-coral/20">
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4"/>
              <span className="font-sans text-sm font-medium">Log Out</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"/>
          </button>
        </div>
 
      </div>
    </div>
  )
}