import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { createPortal } from "react-dom"
import { GlassPanel } from "@/components/glass-panel"
import { RiskBadge } from "@/components/risk-badge"
import { LocationPermissionCard } from "@/components/location-permission"
import { useSafety, TRANSPORT_MODES } from "@/context/SafetyContext"
import { useLocationSearch, MONTGOMERY_LANDMARKS } from "@/lib/useLocationSearch"
import { useRouteCalculation } from "@/lib/useRouteCalculation"
import {
  MapPin, Navigation, ChevronDown, ChevronUp, Database,
  CheckCircle, X, Mic, MicOff, AlertTriangle, Loader2,
  RotateCcw, Zap, Sparkles, Edit3, Check, RefreshCw,
  TrendingUp, TrendingDown, Shield, Clock
} from "lucide-react"
 
// ── GEOCODE ──────────────────────────────────────────────────
async function geocodeText(text, token) {
  if (!text) return []
  if (!token) {
    const q = text.toLowerCase()
    return MONTGOMERY_LANDMARKS.filter(l =>
      l.text.toLowerCase().includes(q) || l.place_name.toLowerCase().includes(q)
    ).slice(0, 5)
  }
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?bbox=-86.45,32.28,-86.18,32.50&proximity=-86.3006,32.3668&types=address,poi,neighborhood,locality,place&country=US&limit=5&access_token=${token}`
    const r = await fetch(url)
    const d = await r.json()
    return (d.features||[]).map(f=>({id:f.id,text:f.text,place_name:f.place_name,center:f.center}))
  } catch {
    const q = text.toLowerCase()
    return MONTGOMERY_LANDMARKS.filter(l =>
      l.text.toLowerCase().includes(q) || l.place_name.toLowerCase().includes(q)
    ).slice(0,5)
  }
}
 
async function interpretWithAI(rawText, candidates) {
  const KEY = import.meta.env.VITE_GROQ_API_KEY
  if (!KEY || !candidates.length) return candidates[0] || null
  try {
    const list = candidates.slice(0,5).map((r,i)=>`${i+1}. ${r.text} -- ${r.place_name}`).join("\n")
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${KEY}`},
      body:JSON.stringify({model:"llama-3.3-70b-versatile",max_tokens:5,temperature:0,
        messages:[{role:"user",content:`User said: "${rawText}"\nMontgomery AL locations:\n${list}\nReply with ONLY the number (1-${candidates.length}) of the best match. If none fit, reply 0.`}]})
    })
    const d = await res.json()
    const idx = parseInt(d.choices?.[0]?.message?.content?.trim()) - 1
    if (idx >= 0 && idx < candidates.length) return candidates[idx]
    return candidates[0]
  } catch { return candidates[0] || null }
}
 
// ── ROUTE LEGEND ─────────────────────────────────────────────
function RouteLegend() {
  return (
    <GlassPanel className="px-3 py-2 flex flex-col gap-1.5">
      <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Route Key</span>
      {[
        { color:"#00E5A0", label:"Safest",   dash:false },
        { color:"#FBBF24", label:"Balanced", dash:[6,3] },
        { color:"#FF6B4A", label:"Fastest",  dash:[2,3] },
      ].map(({color,label,dash})=>(
        <div key={label} className="flex items-center gap-2">
          <svg width="24" height="6">
            <line x1="0" y1="3" x2="24" y2="3" stroke={color} strokeWidth="3"
              strokeDasharray={dash ? dash.join(" ") : "none"} strokeLinecap="round"/>
          </svg>
          <span className="font-mono text-xs text-muted-foreground">{label}</span>
        </div>
      ))}
    </GlassPanel>
  )
}
 
// ── TRANSPORT MODE SELECTOR ───────────────────────────────────
function TransportSelector({ mode, onChange }) {
  const modes = Object.entries(TRANSPORT_MODES)
  return (
    <div className="space-y-2">
      <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Transport Mode</span>
      <div className="grid grid-cols-4 gap-1.5">
        {modes.map(([key, m]) => (
          <button key={key} onClick={() => onChange(key)}
            className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border transition-all ${
              mode === key
                ? "border-amber2/50 bg-amber2/10 shadow-[0_0_10px_rgba(251,146,60,0.15)]"
                : "border-border/40 hover:border-border/70 hover:bg-bg3/50"
            }`}>
            <span className="text-xl leading-none">{m.icon}</span>
            <span className={`font-mono text-[11px] uppercase ${mode===key?"text-amber2":"text-muted-foreground"}`}>{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
 
// ── AUTOCOMPLETE DROPDOWN ─────────────────────────────────────
// Rendered via createPortal so it escapes any overflow-y-auto ancestor.
function LocationDropdown({ results, loading, onSelect, showLandmarks, anchorRef }) {
  if (!results.length && !loading) return null
 
  const rect = anchorRef?.current?.getBoundingClientRect()
  const style = rect
    ? { position: "fixed", top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }
    : { position: "fixed", top: 0, left: 0, width: 320, zIndex: 9999 }
 
  return createPortal(
    <div
      className="bg-bg2 border border-border rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto"
      style={style}
      // BOTH calls are required to fix the portal click bug:
      // stopPropagation — stops the document mousedown listener (on LocationInput's
      //   wrapper ref) from seeing this event and calling setOpen(false), which would
      //   unmount the dropdown before the button's onClick fires.
      // preventDefault  — keeps focus on the text input so the user can keep typing.
      onMouseDown={e => { e.preventDefault(); e.stopPropagation() }}
    >
      {loading && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
          <Loader2 className="w-3 h-3 text-muted-foreground animate-spin"/>
          <span className="font-mono text-xs text-muted-foreground">Searching...</span>
        </div>
      )}
      {showLandmarks && !loading && (
        <div className="px-3 py-1.5 border-b border-border/30">
          <span className="font-mono text-[11px] text-muted-foreground/50 uppercase tracking-wider">Suggested locations</span>
        </div>
      )}
      {results.map((r,i) => (
        <button key={r.id||i} onClick={()=>onSelect(r)}
          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-bg3 transition-colors text-left border-b border-border/20 last:border-0">
          <MapPin className="w-3.5 h-3.5 text-sky flex-shrink-0 mt-0.5"/>
          <div className="min-w-0">
            <div className="font-sans text-xs text-foreground font-medium truncate">{r.text}</div>
            <div className="font-mono text-xs text-muted-foreground/60 truncate">{r.place_name}</div>
          </div>
        </button>
      ))}
    </div>,
    document.body
  )
}
 
// ── LOCATION INPUT ────────────────────────────────────────────
function LocationInput({ label, icon: Icon, colorClass, search, placeholder }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${open?"border-border/70 bg-bg3/50":"border-border/40 hover:border-border/70"}`}>
        <Icon className={`w-4 h-4 flex-shrink-0 ${colorClass}`}/>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[11px] uppercase tracking-wider mb-0.5 text-muted-foreground/60">{label}</div>
          <input value={search.query}
            onChange={e=>{search.setQuery(e.target.value);setOpen(true)}}
            onFocus={()=>setOpen(true)}
            onKeyDown={e=>{
              if (e.key==="Enter" && search.results.length>0) {
                search.select(search.results[0]); setOpen(false)
              } else if (e.key==="Escape") {
                setOpen(false)
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground focus:outline-none"/>
        </div>
        {search.selected && (
          <button onClick={()=>{search.clear();setOpen(true)}} className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-3.5 h-3.5"/>
          </button>
        )}
      </div>
      {open && <LocationDropdown anchorRef={ref} results={search.results} loading={search.loading}
        showLandmarks={search.showLandmarks} onSelect={r=>{search.select(r);setOpen(false)}}/>}
    </div>
  )
}
 
// ── VOICE MIC BUTTON ─────────────────────────────────────────
function VoiceMicButton({ field, voiceField, isListening, interim, onStart, onStop }) {
  const active = isListening && voiceField === field
  return (
    <div className="relative">
      <button onClick={()=>active?onStop():onStart(field)}
        title={active?"Stop recording":"Speak location"}
        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
          active
            ? "bg-coral/20 border-coral/50 text-coral shadow-[0_0_10px_rgba(255,107,74,0.3)]"
            : "border-border/40 text-muted-foreground hover:text-amber2 hover:border-amber2/30"
        }`}>
        {active?<MicOff className="w-4 h-4"/>:<Mic className="w-4 h-4"/>}
      </button>
      {active && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap z-40">
          <div className="bg-bg2 border border-coral/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-lg max-w-[180px]">
            <span className="w-1.5 h-1.5 rounded-full bg-coral animate-pulse flex-shrink-0"/>
            <span className="font-sans text-[11px] text-foreground italic truncate">{interim||"Listening..."}</span>
          </div>
        </div>
      )}
    </div>
  )
}
 
// ── AI VOICE CONFIRM CARD ─────────────────────────────────────
function VoiceConfirmCard({ rawText, aiSuggestion, aiLoading, onConfirm, onEdit, onDismiss }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(rawText)
  if (editing) {
    return (
      <div className="mt-2 p-3 rounded-xl bg-bg3 border border-sky/30">
        <p className="font-mono text-xs text-sky uppercase mb-2">Edit your spoken text</p>
        <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&onEdit(editVal)}
          className="w-full bg-bg2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-sky/50 mb-2"/>
        <div className="flex gap-2">
          <button onClick={()=>onEdit(editVal)}
            className="flex-1 py-2 rounded-lg bg-sky/15 border border-sky/30 text-sky font-mono text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-sky/25">
            <Check className="w-3 h-3"/> Use This
          </button>
          <button onClick={()=>setEditing(false)}
            className="px-3 py-2 rounded-lg border border-border text-muted-foreground font-mono text-xs">Back</button>
        </div>
      </div>
    )
  }
  return (
    <div className="mt-2 p-3 rounded-xl bg-bg3 border border-amber2/30 shadow-lg">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-amber2 flex-shrink-0"/>
        <span className="font-mono text-xs text-amber2 uppercase">You said</span>
        <span className="ml-auto font-mono text-xs text-muted-foreground/60 italic truncate max-w-[130px]">"{rawText}"</span>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0"><X className="w-3.5 h-3.5"/></button>
      </div>
      {aiLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="w-3.5 h-3.5 text-amber2 animate-spin"/>
          <span className="font-mono text-xs text-muted-foreground">AI matching location...</span>
        </div>
      ) : aiSuggestion ? (
        <>
          <div className="flex items-start gap-2 mb-1">
            <MapPin className="w-3.5 h-3.5 text-mint flex-shrink-0 mt-0.5"/>
            <div className="min-w-0">
              <div className="font-sans text-sm text-foreground font-medium truncate">{aiSuggestion.text}</div>
              <div className="font-mono text-xs text-muted-foreground/60 truncate">{aiSuggestion.place_name}</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={()=>onConfirm(aiSuggestion)}
              className="flex-1 py-2.5 rounded-lg bg-mint/15 border border-mint/30 text-mint font-mono text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-mint/25">
              <Check className="w-3 h-3"/> Yes, use this
            </button>
            <button onClick={()=>setEditing(true)}
              className="px-3 py-2.5 rounded-lg border border-border text-muted-foreground font-mono text-xs flex items-center gap-1 hover:border-border/70">
              <Edit3 className="w-3 h-3"/> Edit
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button onClick={()=>setEditing(true)}
            className="flex-1 py-2 rounded-lg bg-sky/10 border border-sky/25 text-sky font-mono text-xs uppercase flex items-center justify-center gap-1.5">
            <Edit3 className="w-3 h-3"/> Type manually
          </button>
          <button onClick={onDismiss} className="px-3 py-2 rounded-lg border border-border text-muted-foreground font-mono text-xs">Retry</button>
        </div>
      )}
    </div>
  )
}
 
// ── ROUTE CARD ────────────────────────────────────────────────
function RouteCard({ route, isSelected, onSelect, onExpand, isExpanded }) {
  const safetyPct = Math.max(1, Math.round(100 - route.riskScore))
  const riskPct   = Math.round(route.riskScore)
  const safeColor = safetyPct >= 70 ? "text-mint" : safetyPct >= 50 ? "text-amber" : "text-coral"
  const riskColor = riskPct  <= 30 ? "text-mint" : riskPct  <= 60 ? "text-amber" : "text-coral"
  return (
    <div onClick={onSelect} className={`rounded-xl border cursor-pointer transition-all ${
      isSelected
        ? "border-amber2/50 shadow-[0_0_16px_rgba(251,146,60,0.12)] bg-amber2/5"
        : "border-border/40 hover:border-border/70"
    }`}>
      <div className="p-3">
        <div className="flex items-center gap-2.5 mb-2.5">
          <svg width="20" height="6" className="flex-shrink-0">
            <line x1="0" y1="3" x2="20" y2="3" stroke={route.color} strokeWidth="3"
              strokeDasharray={route.dashArray?route.dashArray.join(" "):"none"} strokeLinecap="round"/>
          </svg>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-sans text-sm font-medium text-foreground">{route.name}</span>
              {route.recommended && (
                <span className="px-1.5 py-0.5 rounded-full bg-mint/15 border border-mint/25 font-mono text-[7px] text-mint uppercase">Recommended</span>
              )}
            </div>
            <div className="font-mono text-sm text-muted-foreground">{route.duration} · {route.distance}</div>
          </div>
          {isSelected && <CheckCircle className="w-4 h-4 text-amber2 flex-shrink-0"/>}
        </div>
 
        <div className="flex items-stretch gap-2 mb-2">
          <div className="flex-1 bg-bg3 rounded-lg p-2 flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-2.5 h-2.5 text-muted-foreground/50"/>
              <span className="font-mono text-[7px] text-muted-foreground uppercase">Safety</span>
            </div>
            <span className={`font-mono text-base font-bold ${safeColor}`}>{safetyPct}%</span>
            <span className={`font-mono text-[7px] uppercase mt-0.5 ${safeColor}`}>
              {safetyPct>=70?"HIGH SAFETY":safetyPct>=50?"MED SAFETY":"LOW SAFETY"}
            </span>
          </div>
          <div className="flex-1 bg-bg3 rounded-lg p-2 flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingDown className="w-2.5 h-2.5 text-muted-foreground/50"/>
              <span className="font-mono text-[7px] text-muted-foreground uppercase">Risk</span>
            </div>
            <span className={`font-mono text-base font-bold ${riskColor}`}>{riskPct}/99</span>
            <span className={`font-mono text-[7px] uppercase mt-0.5 ${riskColor}`}>
              {riskPct<=30?"LOW RISK":riskPct<=60?"MED RISK":"HIGH RISK"}
            </span>
          </div>
          <div className="flex-1 bg-bg3 rounded-lg p-2 flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <Shield className="w-2.5 h-2.5 text-muted-foreground/50"/>
              <span className="font-mono text-[7px] text-muted-foreground uppercase">Incidents</span>
            </div>
            <span className={`font-mono text-base font-bold ${route.incidentsNear>0?"text-coral":"text-mint"}`}>{route.incidentsNear}</span>
            <span className={`font-mono text-[7px] uppercase mt-0.5 ${route.incidentsNear>0?"text-coral":"text-mint"}`}>
              {route.incidentsNear===0?"CLEAR":route.incidentsNear<3?"NEAR":"DANGER"}
            </span>
          </div>
        </div>
 
        <div className="flex items-center justify-between">
          <RiskBadge level={route.riskLevel}/>
          <button onClick={e=>{e.stopPropagation();onExpand()}}
            className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground">
            Why? {isExpanded?<ChevronUp className="w-3 h-3"/>:<ChevronDown className="w-3 h-3"/>}
          </button>
        </div>
 
        {/* Context-aware risk chips */}
        {route.contextChips?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/20">
            {route.contextChips.map((chip, i) => (
              <span key={i} className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg3 border border-border/30 font-mono text-[10px] ${chip.color}`}>
                <span>{chip.icon}</span>{chip.label}
              </span>
            ))}
          </div>
        )}
      </div>
 
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-border/30 pt-2 space-y-2">
          <p className="font-sans text-[11px] text-muted-foreground">
            Scored against {route.incidentsNear} fire/rescue incidents within 800m of this road corridor.
            Safety score = 100 minus risk score — no artificial adjustment.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {["Live ArcGIS","Fire/Rescue","AI Scoring"].map(s=>(
              <span key={s} className="px-2 py-1 bg-bg3 rounded-full text-xs font-mono flex items-center gap-1">
                <Database className="w-2.5 h-2.5 text-sky"/>{s}
              </span>
            ))}
          </div>
          {route.riskLevel==="high" && (
            <div className="p-2 bg-coral/8 rounded-lg border border-coral/25 text-coral font-mono text-xs">
              Passes near recent safety events -- consider the safer option.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
 
// ── CONFIRM CANCEL ACTIVE NAVIGATION MODAL ───────────────────
function ConfirmCancelModal({ activeJourney, onConfirm, onDeny }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div className="max-w-sm w-full bg-bg2 border border-amber/40 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber/15 border border-amber/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber"/>
          </div>
          <div>
            <h3 className="font-serif italic text-lg text-foreground">Active Navigation</h3>
            <p className="font-mono text-xs text-muted-foreground">Journey in progress</p>
          </div>
        </div>
 
        <div className="p-3 rounded-xl bg-bg3 border border-border/50 mb-4">
          <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Currently navigating to</div>
          <div className="font-sans text-sm text-foreground font-medium truncate">
            {activeJourney?.to || "Destination"}
          </div>
          {activeJourney?.from && (
            <div className="font-mono text-xs text-muted-foreground/60 mt-0.5 truncate">
              from {activeJourney.from}
            </div>
          )}
        </div>
 
        <p className="font-sans text-sm text-muted-foreground mb-5 leading-relaxed">
          Starting a new journey will cancel your current navigation and alert your guardians that the route has changed. Are you sure?
        </p>
 
        <div className="flex flex-col gap-2.5">
          <button onClick={onConfirm}
            className="w-full py-3.5 rounded-xl bg-mint text-bg font-mono text-sm font-bold flex items-center justify-center gap-2 hover:bg-mint/90 transition-all shadow-[0_0_16px_rgba(0,229,160,0.15)]">
            <Check className="w-4 h-4"/> Yes, start new journey
          </button>
          <button onClick={onDeny}
            className="w-full py-3 rounded-xl border border-border text-muted-foreground font-mono text-xs uppercase hover:border-border/70 hover:text-foreground transition-colors">
            No, keep current navigation
          </button>
        </div>
      </div>
    </div>
  )
}
 
// ── ACTIVE NAVIGATION BANNER ──────────────────────────────────
function ActiveNavBanner({ activeJourney, onGoBack }) {
  if (!activeJourney) return null
  return (
    <div className="mx-0 px-4 py-2.5 bg-amber/8 border-b border-amber/20 flex items-center gap-3 flex-shrink-0">
      <div className="w-2 h-2 rounded-full bg-amber animate-pulse flex-shrink-0"/>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-[11px] text-amber uppercase tracking-wider">Navigation Active · </span>
        <span className="font-sans text-xs text-foreground truncate">{activeJourney.to}</span>
      </div>
      <button onClick={onGoBack}
        className="font-mono text-[11px] text-amber uppercase tracking-wider hover:text-amber/80 flex-shrink-0 flex items-center gap-1">
        <Navigation className="w-3 h-3"/> Resume
      </button>
    </div>
  )
}
 
// ── MAIN COMPONENT ────────────────────────────────────────────
export default function JourneyPage() {
  const navigate     = useNavigate()
  // mapOverlayEl comes from AppShell via useOutletContext — it's the DOM node
  // inside the persistent MapBackground that we portal overlays into.
  const { mapOverlayEl } = useOutletContext() || {}
  const MAPBOX_TOKEN  = import.meta.env.VITE_MAPBOX_TOKEN
 
  const {
    userPos, setUserPos,
    journeyPlan, setJourneyPlan,
    transportMode, setTransportMode,
    startJourney, cancelJourney,
    activeJourney,
    fireIncidents = [],
    sharedMapRef,
  } = useSafety()
 
  const origin      = useLocationSearch()
  const destination = useLocationSearch()
  const { routes, loading: routeLoading, error: routeError, calculate } = useRouteCalculation()
 
  const [selectedRouteId, setSelectedRouteId] = useState(null)
  const [expandedRoute,   setExpandedRoute]   = useState(null)
  const [showRoutes,      setShowRoutes]      = useState(false)
  const [showGpsCard,     setShowGpsCard]     = useState(false)
  const [launching,       setLaunching]       = useState(false)
  const [arrivalMins,     setArrivalMins]     = useState("")   // arrive-safe timer
 
  // Voice
  const [voice, setVoice] = useState({
    field:null,listening:false,interim:"",rawText:"",aiLoading:false,aiSuggestion:null,showCard:false
  })
  const recRef = useRef(null)
  const rawRef = useRef("")
 
  // Journey history — real entries only
  const [journeyHistory] = useState(() => {
    try {
      const h = JSON.parse(localStorage.getItem("saferoute_journeys")||"[]")
      return Array.isArray(h)?h.filter(j=>j.from&&j.to&&j.from!=="Current Location"&&j.to!=="Destination"):[]
    } catch { return [] }
  })
 
  // ── RESTORE journeyPlan on mount ──────────────────────────
  useEffect(() => {
    if (!journeyPlan) return
    if (journeyPlan.transportMode) setTransportMode(journeyPlan.transportMode)
    if (journeyPlan.origin)      origin.select(journeyPlan.origin)
    if (journeyPlan.destination) destination.select(journeyPlan.destination)
    if (journeyPlan.selectedRouteId) setSelectedRouteId(journeyPlan.selectedRouteId)
  }, []) // intentionally run once on mount only
 
  // GPS on mount (non-blocking if already have journeyPlan origin)
  useEffect(() => {
    if (journeyPlan?.origin) return
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const coords = [pos.coords.longitude, pos.coords.latitude]
        setUserPos(coords)
        origin.select({ text:"Current Location", place_name:"Your GPS position", center:coords })
        setShowGpsCard(false)
      },
      () => setShowGpsCard(true),
      { enableHighAccuracy:true, timeout:8000, maximumAge:30000 }
    )
  }, [])
 
  // Recalculate when both endpoints set
  useEffect(() => {
    if (origin.selected?.center && destination.selected?.center) {
      calculate(origin.selected.center, destination.selected.center, fireIncidents, transportMode)
    }
  }, [
    origin.selected?.center?.join(","),
    destination.selected?.center?.join(","),
    fireIncidents.length,
    transportMode
  ])
 
  // Draw routes on map — map is already initialised (persistent), so draw immediately.
  // 150ms retry covers the resize-settle race when returning from a non-map page.
  useEffect(() => {
    if (!routes.length || !sharedMapRef.current) return
    const initId = selectedRouteId || routes.find(r=>r.recommended)?.id || routes[0]?.id
    if (!selectedRouteId) setSelectedRouteId(initId)
    const draw = () => {
      if (!sharedMapRef.current) return
      sharedMapRef.current.setRoutes(routes, initId)
      const sel = routes.find(r=>r.id===initId)||routes[0]
      if (sel?.geometry) sharedMapRef.current.fitRouteBounds(sel.geometry)
    }
    draw()
    const t = setTimeout(draw, 150)
    return () => clearTimeout(t)
  }, [routes])
 
  // Update highlight when selected route changes
  useEffect(() => {
    if (!selectedRouteId || !sharedMapRef.current || !routes.length) return
    sharedMapRef.current.selectRoute(selectedRouteId)
    const sel = routes.find(r=>r.id===selectedRouteId)
    if (sel?.geometry) sharedMapRef.current.fitRouteBounds(sel.geometry)
  }, [selectedRouteId])
 
  // Redraw saved routes from journeyPlan on mount (map is persistent, no timer needed).
  // 150ms retry handles the resize-settle race when returning from non-map pages.
  useEffect(() => {
    if (!journeyPlan?.routes?.length || !sharedMapRef.current) return
    const draw = () => {
      if (!sharedMapRef.current) return
      sharedMapRef.current.setRoutes(journeyPlan.routes, journeyPlan.selectedRouteId)
      const sel = journeyPlan.routes.find(r=>r.id===journeyPlan.selectedRouteId)
      if (sel?.geometry) sharedMapRef.current.fitRouteBounds(sel.geometry)
    }
    draw()
    const t = setTimeout(draw, 150)
    return () => clearTimeout(t)
  }, [])
 
  // Ref mirror of journeyPlan — lets the persist effect read the current value
  // without adding journeyPlan to the dep array (which would cause a save loop).
  const journeyPlanRef = useRef(journeyPlan)
  useEffect(() => { journeyPlanRef.current = journeyPlan }, [journeyPlan])
 
  // Persist journeyPlan — only save when at least origin is set to avoid
  // writing sessionStorage on every keystroke in the search boxes.
  useEffect(() => {
    if (!origin.selected && !destination.selected) return   // nothing worth saving yet
    setJourneyPlan({
      origin:          origin.selected    || null,
      destination:     destination.selected || null,
      routes:          routes.length ? routes : (journeyPlanRef.current?.routes || []),
      selectedRouteId: selectedRouteId   || journeyPlanRef.current?.selectedRouteId || null,
      transportMode,
    })
  }, [origin.selected, destination.selected, routes, selectedRouteId, transportMode])
 
  // On unmount, don't clear routes — NavigationPage will take over the same map
  // (clearRoutes was previously called here; removed so the map stays intact)
 
  // ── VOICE ──────────────────────────────────────────────────
  const startVoice = useCallback(field => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert("Voice input requires Chrome or Edge."); return }
    rawRef.current = ""
    const rec = new SR()
    rec.continuous=false; rec.interimResults=true; rec.lang="en-US"
    rec.onresult = e => {
      for (let i=e.resultIndex;i<e.results.length;i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) { rawRef.current=t; setVoice(v=>({...v,rawText:t,interim:""})) }
        else setVoice(v=>({...v,interim:t}))
      }
    }
    rec.onend = async () => {
      const raw = rawRef.current
      if (!raw.trim()) { setVoice({field:null,listening:false,interim:"",rawText:"",aiLoading:false,aiSuggestion:null,showCard:false}); return }
      setVoice(v=>({...v,listening:false,interim:"",aiLoading:true,showCard:true}))
      const candidates = await geocodeText(raw, MAPBOX_TOKEN)
      const aiSuggestion = candidates.length ? await interpretWithAI(raw, candidates) : null
      setVoice(v=>({...v,aiLoading:false,aiSuggestion}))
    }
    rec.onerror = () => setVoice({field:null,listening:false,interim:"",rawText:"",aiLoading:false,aiSuggestion:null,showCard:false})
    recRef.current=rec; rec.start()
    setVoice({field,listening:true,interim:"",rawText:"",aiLoading:false,aiSuggestion:null,showCard:false})
  }, [MAPBOX_TOKEN])
 
  const stopVoice  = useCallback(()=>{ recRef.current?.stop(); setVoice(v=>({...v,listening:false})) },[])
 
  const confirmVoice = useCallback(suggestion=>{
    const s = voice.field==="origin"?origin:destination
    s.select(suggestion)
    setVoice({field:null,listening:false,interim:"",rawText:"",aiLoading:false,aiSuggestion:null,showCard:false})
  },[voice.field,origin,destination])
 
  const editVoice = useCallback(async text=>{
    const s = voice.field==="origin"?origin:destination
    const c = await geocodeText(text,MAPBOX_TOKEN)
    if (c.length) s.select(c[0]); else s.setQuery(text)
    setVoice({field:null,listening:false,interim:"",rawText:"",aiLoading:false,aiSuggestion:null,showCard:false})
  },[voice.field,origin,destination,MAPBOX_TOKEN])
 
  const dismissVoice = useCallback(()=>setVoice({field:null,listening:false,interim:"",rawText:"",aiLoading:false,aiSuggestion:null,showCard:false}),[])
 
  // ── RESET JOURNEY ─────────────────────────────────────────
  // Clears the form and map preview routes. Does NOT cancel an active navigation —
  // that requires explicit confirmation via handleStart.
  const resetJourney = useCallback(()=>{
    origin.clear(); destination.clear()
    setSelectedRouteId(null); setExpandedRoute(null)
    setJourneyPlan(null)
    // clearRoutes() is the public API — it removes GL layers AND clears lastRoutesRef
    // so a subsequent style toggle doesn't ghost-redraw the reset route.
    // (removeAllRoutes is internal to map-background and not exposed on mapControlRef)
    sharedMapRef.current?.clearRoutes?.()
  },[origin, destination])
 
  // ── CANCEL CONFIRMATION STATE ─────────────────────────────
  // When the user hits Start Journey while a navigation is already live,
  // we stash the intended route and ask for confirmation instead of acting immediately.
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const pendingStartRef = useRef(null) // holds the route object until confirmed/denied
 
  // ── START JOURNEY ─────────────────────────────────────────
  const doStartJourney = useCallback((sel) => {
    setLaunching(true)
    startJourney({
      ...sel,
      from:        origin.selected?.text    || "Current Location",
      fromCoords:  origin.selected?.center  || userPos,
      to:          destination.selected?.text,
      toCoords:    destination.selected?.center,
      arrivalMins: arrivalMins ? parseInt(arrivalMins) : null,
    })
    setTimeout(()=>navigate("/navigation"), 700)
  }, [origin, destination, userPos, startJourney, navigate, arrivalMins])
 
  const handleStart = useCallback(()=>{
    const sel = routes.find(r=>r.id===selectedRouteId)||routes[0]
    if (!sel) return
    if (activeJourney) {
      // Active navigation running — ask before cancelling it
      pendingStartRef.current = sel
      setShowCancelConfirm(true)
      return
    }
    doStartJourney(sel)
  },[routes, selectedRouteId, activeJourney, doStartJourney])
 
  const handleConfirmCancel = useCallback(()=>{
    const sel = pendingStartRef.current
    pendingStartRef.current = null
    setShowCancelConfirm(false)
    // Clear map lines before starting the new journey so old GL layers are
    // fully removed before doStartJourney → NavigationPage draws the new route.
    sharedMapRef.current?.clearRoutes?.()
    cancelJourney(true)   // save the old journey to history as CANCELLED
    doStartJourney(sel)
  },[cancelJourney, doStartJourney, sharedMapRef])
 
  const handleDenyCancel = useCallback(()=>{
    pendingStartRef.current = null
    setShowCancelConfirm(false)
    // Nothing changes — current navigation lives on, journey page resets to preview
  },[])
 
  const reuseHistory = j => {
    if (j.fromCoords) origin.select({text:j.from,place_name:j.from,center:j.fromCoords})
    if (j.destCoords) destination.select({text:j.to,place_name:j.to,center:j.destCoords})
  }
 
  const canStart = !!selectedRouteId && !!destination.selected && routes.length>0 && !routeLoading
 
  // ── MAP OVERLAYS (portaled into the persistent map) ───────
  const mapOverlays = mapOverlayEl ? createPortal(
    <div className="absolute inset-0 pointer-events-none">
      {/* Route legend */}
      {routes.length > 0 && (
        <div className="absolute bottom-16 left-3 z-20 pointer-events-auto">
          <RouteLegend/>
        </div>
      )}
      {/* Route calculating spinner */}
      {routeLoading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <GlassPanel className="px-4 py-2 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 text-amber animate-spin"/>
            <span className="font-mono text-xs text-amber uppercase">Calculating routes...</span>
          </GlassPanel>
        </div>
      )}
      {/* Mobile "Show Routes" button — only when sidebar is hidden */}
      {!showRoutes && (
        <button onClick={()=>setShowRoutes(true)}
          className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-full glass border border-amber2/40 text-amber2 font-mono text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg pointer-events-auto">
          <Navigation className="w-3.5 h-3.5"/>
          {routes.length?"Show Routes":"Plan Journey"}
        </button>
      )}
    </div>,
    mapOverlayEl
  ) : null
 
  return (
    <>
      {/* Confirmation modal — shown when Start Journey is pressed while navigation is active */}
      {showCancelConfirm && (
        <ConfirmCancelModal
          activeJourney={activeJourney}
          onConfirm={handleConfirmCancel}
          onDeny={handleDenyCancel}
        />
      )}
 
      {/* Map overlays rendered into the persistent map via portal */}
      {mapOverlays}
 
      {/* Sidebar — rendered directly in the Outlet slot (right of the map in AppShell's flex row) */}
      <aside className={`w-full md:w-[380px] lg:w-[420px] flex-shrink-0 bg-bg2 border-l border-border flex flex-col z-30 transition-all duration-300 md:translate-y-0 md:opacity-100 md:relative md:pointer-events-auto md:h-full ${showRoutes?"fixed inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-2xl shadow-2xl":"fixed inset-x-0 bottom-0 max-h-[88vh] translate-y-full opacity-0 pointer-events-none md:opacity-100 md:translate-y-0 md:pointer-events-auto"}`}>
        <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border"/>
        </div>
        <button onClick={()=>setShowRoutes(false)} className="md:hidden absolute top-3 right-4 text-muted-foreground hover:text-foreground z-10">
          <X className="w-5 h-5"/>
        </button>
 
        {/* Active navigation banner — visible when user is previewing routes while nav is live */}
        <ActiveNavBanner activeJourney={activeJourney} onGoBack={()=>navigate("/navigation")}/>
 
        <div className="px-4 md:px-6 pt-2 md:pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-serif italic text-xl md:text-2xl text-foreground">Safe Journey Planner</h2>
              <p className="font-sans text-xs text-muted-foreground mt-0.5">Montgomery, Alabama</p>
            </div>
            {(origin.selected||destination.selected||routes.length>0) && (
              <button onClick={resetJourney}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground font-mono text-xs uppercase hover:border-coral/40 hover:text-coral transition-colors">
                <RefreshCw className="w-3 h-3"/> Reset
              </button>
            )}
          </div>
        </div>
 
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4">
 
          {showGpsCard && (
            <LocationPermissionCard context="journey"
              onAllow={pos=>{const c=[pos.lng,pos.lat];setUserPos(c);origin.select({text:"Current Location",place_name:"Your GPS position",center:c});setShowGpsCard(false)}}
              onDismiss={()=>setShowGpsCard(false)}/>
          )}
 
          {/* INPUTS */}
          <GlassPanel className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 relative">
                <LocationInput label="From" icon={MapPin} colorClass="text-sky" search={origin} placeholder="Current location or type address..."/>
              </div>
              <div className="pt-1">
                <VoiceMicButton field="origin" voiceField={voice.field} isListening={voice.listening}
                  interim={voice.interim} onStart={startVoice} onStop={stopVoice}/>
              </div>
            </div>
            {voice.showCard && voice.field==="origin" && (
              <VoiceConfirmCard rawText={voice.rawText} aiSuggestion={voice.aiSuggestion}
                aiLoading={voice.aiLoading} onConfirm={confirmVoice} onEdit={editVoice} onDismiss={dismissVoice}/>
            )}
            <div className="flex items-center gap-3 px-2">
              <div className="w-px h-3 bg-border ml-2"/>
              <span className="font-mono text-[11px] text-muted-foreground/40">TO</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex-1 relative">
                <LocationInput label="Destination" icon={Navigation} colorClass="text-mint" search={destination} placeholder="Where are you going?"/>
              </div>
              <div className="pt-1">
                <VoiceMicButton field="destination" voiceField={voice.field} isListening={voice.listening}
                  interim={voice.interim} onStart={startVoice} onStop={stopVoice}/>
              </div>
            </div>
            {voice.showCard && voice.field==="destination" && (
              <VoiceConfirmCard rawText={voice.rawText} aiSuggestion={voice.aiSuggestion}
                aiLoading={voice.aiLoading} onConfirm={confirmVoice} onEdit={editVoice} onDismiss={dismissVoice}/>
            )}
            {routeError && (
              <div className="px-3 py-2 rounded-lg bg-amber/8 border border-amber/25">
                <span className="font-mono text-xs text-amber">{routeError}</span>
              </div>
            )}
          </GlassPanel>
 
          {/* TRANSPORT MODE */}
          <GlassPanel className="p-4">
            <TransportSelector mode={transportMode} onChange={m=>{setTransportMode(m);setSelectedRouteId(null)}}/>
          </GlassPanel>
 
          {/* ARRIVE SAFE TIMER */}
          <GlassPanel className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs text-foreground uppercase tracking-wider">Arrive Safe Timer</span>
                <p className="font-mono text-[11px] text-muted-foreground/60 mt-0.5">Optional · Alert guardians if you don't arrive</p>
              </div>
              {arrivalMins && (
                <button onClick={()=>setArrivalMins("")} className="text-muted-foreground hover:text-coral">
                  <X className="w-3.5 h-3.5"/>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>setArrivalMins(v=>String(Math.max(0,(parseInt(v)||0)-5)))}
                className="w-9 h-9 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 font-mono text-sm flex items-center justify-center">−</button>
              <div className="flex-1 relative">
                <input
                  type="number" min="0" max="480"
                  value={arrivalMins}
                  onChange={e=>setArrivalMins(e.target.value)}
                  placeholder="mins"
                  className="w-full bg-bg3 border border-border/40 rounded-xl px-3 py-2 text-center font-mono text-sm text-foreground focus:outline-none focus:border-amber2/40 placeholder:text-muted-foreground/40"
                />
              </div>
              <button onClick={()=>setArrivalMins(v=>String((parseInt(v)||0)+5))}
                className="w-9 h-9 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 font-mono text-sm flex items-center justify-center">+</button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[10,20,30,45,60].map(m=>(
                <button key={m} onClick={()=>setArrivalMins(String(m))}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs border transition-all ${
                    arrivalMins===String(m)?"bg-amber2/10 border-amber2/30 text-amber2":"border-border/30 text-muted-foreground hover:border-border/60"
                  }`}>{m}m</button>
              ))}
            </div>
            {arrivalMins && parseInt(arrivalMins) > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber2/8 border border-amber2/20">
                <Clock className="w-3.5 h-3.5 text-amber2 flex-shrink-0"/>
                <span className="font-mono text-[11px] text-amber2">Guardian alert if not arrived in {arrivalMins} min</span>
              </div>
            )}
          </GlassPanel>
 
          {/* ROUTES */}
          {routeLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i=>(
                <div key={i} className="rounded-xl bg-bg3 border border-border/30 p-3 animate-pulse">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-1.5 bg-bg2 rounded"/>
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-bg2 rounded w-2/3"/>
                      <div className="h-2 bg-bg2 rounded w-1/3"/>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1,2,3].map(j=><div key={j} className="h-14 bg-bg2 rounded-lg"/>)}
                  </div>
                </div>
              ))}
              <p className="text-center font-mono text-xs text-muted-foreground animate-pulse pt-1">
                Scoring against {fireIncidents.length} live incidents...
              </p>
            </div>
          ) : routes.length>0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-muted-foreground uppercase">Available Routes</span>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-mint"/>
                  <span className="font-mono text-xs text-mint">Live scored · {TRANSPORT_MODES[transportMode]?.icon} {TRANSPORT_MODES[transportMode]?.label}</span>
                </div>
              </div>
              {routes.map(route=>(
                <RouteCard key={route.id} route={route}
                  isSelected={selectedRouteId===route.id}
                  isExpanded={expandedRoute===route.id}
                  onSelect={()=>setSelectedRouteId(route.id)}
                  onExpand={()=>setExpandedRoute(expandedRoute===route.id?null:route.id)}/>
              ))}
            </div>
          ) : destination.selected ? (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2 animate-spin"/>
              <p className="font-mono text-xs text-muted-foreground">Calculating safest routes...</p>
            </div>
          ) : null}
 
          {/* RECENT JOURNEYS */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 h-px bg-border/40"/>
              <span className="font-mono text-xs text-muted-foreground/50 uppercase px-2">Recent Journeys</span>
              <div className="flex-1 h-px bg-border/40"/>
            </div>
            {journeyHistory.length > 0 ? journeyHistory.slice(0,4).map((j,i)=>(
              <button key={i} onClick={()=>reuseHistory(j)}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-bg3 border border-border/30 hover:border-amber2/30 hover:bg-amber2/5 transition-all text-left group">
                <div className="min-w-0 flex-1">
                  <div className="font-sans text-sm text-foreground truncate">{j.from} <span className="text-muted-foreground/40 mx-1">→</span> {j.to}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-0.5">{j.date} · {j.duration}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className={`font-mono text-xs ${j.outcome==="SAFE"?"text-mint":"text-amber"}`}>{j.outcome}</span>
                  <RotateCcw className="w-3 h-3 text-muted-foreground/40 group-hover:text-amber2"/>
                </div>
              </button>
            )) : (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <Navigation className="w-8 h-8 text-muted-foreground/15"/>
                <p className="font-sans text-sm text-muted-foreground/50 text-center">No journeys taken yet</p>
                <p className="font-mono text-xs text-muted-foreground/30 text-center">Complete a trip to see your history here</p>
              </div>
            )}
          </div>
        </div>
 
        {/* START BUTTON */}
        <div className="p-4 border-t border-border bg-bg3 flex-shrink-0">
          <button onClick={handleStart} disabled={!canStart||launching}
            className={`w-full py-4 rounded-xl font-mono text-sm font-bold flex items-center justify-center gap-3 transition-all ${
              canStart&&!launching
                ? activeJourney
                  ? "bg-amber2 text-bg hover:bg-amber2/90 shadow-[0_0_20px_rgba(251,146,60,0.2)]"
                  : "bg-mint text-bg hover:bg-mint/90 shadow-[0_0_20px_rgba(0,229,160,0.2)]"
                : "bg-bg2 text-muted-foreground cursor-not-allowed"
            }`}>
            {launching
              ? <><Loader2 className="w-5 h-5 animate-spin"/> Starting...</>
              : activeJourney
                ? <><AlertTriangle className="w-5 h-5"/> CHANGE NAVIGATION</>
                : <><Navigation className="w-5 h-5"/> START SAFE JOURNEY</>
            }
          </button>
          <p className="mt-2 text-center font-mono text-xs text-muted-foreground/50">
            {activeJourney
              ? "Will ask to confirm before cancelling current navigation"
              : routes.length>0
                ? `Scored against ${fireIncidents.length} live incidents · ${TRANSPORT_MODES[transportMode]?.label}`
                : "Enter origin & destination to plan your route"
            }
          </p>
        </div>
      </aside>
    </>
  )
}