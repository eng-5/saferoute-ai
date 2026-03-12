import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { createPortal } from "react-dom"
import { GlassPanel } from "@/components/glass-panel"
import { LocationPermissionCard } from "@/components/location-permission"
import { useSafety, TRANSPORT_MODES } from "@/context/SafetyContext"
import { loadGuardianContacts, fireAllAlerts, copyGuardianLink, generateGuardianLink } from "@/lib/useNotifications"
import { playCrisisAlert } from "@/lib/audio"
import DistressBroadcast from "@/components/distress-broadcast"
import CoverMe from "@/components/fake-call"
import {
  Shield, Clock, Volume2, VolumeX, AlertTriangle, Check, Phone,
  MapPin, Activity, Cpu, Eye, Navigation, X, RotateCcw,
  Map as MapIcon, FileText, Zap, Link2, ChevronUp, ChevronDown,
  AlertCircle, UserCheck, Radio, PhoneCall, Siren
} from "lucide-react"
 
const TABS = [
  { id:"route", label:"Live Route",   icon:MapIcon       },
  { id:"intel", label:"Safety Intel", icon:AlertTriangle },
  { id:"ai",    label:"AI Brief",     icon:Cpu           },
  { id:"logs",  label:"Check-ins",    icon:FileText      },
]
 
function fmt(s) {
  const m = Math.floor(s/60), sc = s%60
  return `${m}:${sc.toString().padStart(2,"0")}`
}
 
// ── NO JOURNEY SCREEN ─────────────────────────────────────────
// Renders as a portal overlay into the persistent map — no separate MapBackground needed.
function NoJourneyOverlay({ mapOverlayEl }) {
  const navigate = useNavigate()
  if (!mapOverlayEl) return null
 
  return createPortal(
    <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto z-40">
      <div className="max-w-sm w-full">
        <GlassPanel className="p-8 text-center border-amber2/25 shadow-2xl">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-amber2/20 animate-ping opacity-60"/>
            <div className="relative w-20 h-20 rounded-full bg-amber2/10 border border-amber2/30 flex items-center justify-center">
              <Navigation className="w-9 h-9 text-amber2"/>
            </div>
          </div>
          <h2 className="font-serif italic text-2xl text-foreground mb-2">No Active Journey</h2>
          <p className="font-sans text-sm text-muted-foreground mb-8 leading-relaxed">
            Set your origin and destination to calculate your safest route before starting navigation.
          </p>
          <button onClick={()=>navigate("/journey")}
            className="w-full py-4 rounded-xl bg-mint text-bg font-mono text-sm font-bold flex items-center justify-center gap-3 hover:bg-mint/90 shadow-[0_0_20px_rgba(0,229,160,0.2)] transition-all mb-3">
            <MapPin className="w-5 h-5"/> Plan a Journey
          </button>
          <button onClick={()=>navigate("/")}
            className="w-full py-3 rounded-xl border border-border text-muted-foreground font-mono text-xs uppercase hover:border-border/70 hover:text-foreground transition-colors">
            Back to Dashboard
          </button>
        </GlassPanel>
      </div>
    </div>,
    mapOverlayEl
  )
}
 
// ── ALERT LEVEL MODAL ─────────────────────────────────────────
function AlertModal({ level, trigger, route, userPos, checkInTime, onSafe, onHelp, onCancel }) {
  const contacts = loadGuardianContacts()
  const [alertStatus, setAlertStatus] = useState([])
  const [fired, setFired] = useState(false)
 
  const triggerMessages = {
    eta:      "You have exceeded your estimated arrival time.",
    stopped:  `You have been stationary for longer than expected for ${route?.transportMode||"your transport mode"}.`,
    offroute: "You appear to have left your planned route.",
    speed:    "Your movement pattern changed unexpectedly.",
    checkin:  "Your check-in timer has expired.",
  }
 
  const fireEmergency = useCallback(async () => {
    if (fired) return
    setFired(true)
    playCrisisAlert()
    const results = await fireAllAlerts(contacts, route, userPos, level)
    setAlertStatus(results)
    const linkResult = await copyGuardianLink(route, userPos)
    if (linkResult.success) setAlertStatus(p=>[...p,{channel:"link",success:true}])
  }, [contacts, route, userPos, level, fired])
 
  useEffect(() => {
    if (level === 3) fireEmergency()
  }, [level])
 
  if (level === 1) {
    return (
      <div className="absolute top-4 left-4 right-16 z-40 max-w-sm pointer-events-auto">
        <GlassPanel className="p-4 border-amber/40 border-l-4 border-l-amber">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber flex-shrink-0 mt-0.5"/>
            <div className="flex-1">
              <p className="font-sans text-sm text-foreground font-medium mb-1">Are you still safe?</p>
              <p className="font-sans text-[11px] text-muted-foreground">{triggerMessages[trigger]||"Safety check."}</p>
            </div>
            <button onClick={onSafe} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4"/></button>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={onSafe}
              className="flex-1 py-2 rounded-lg bg-mint/15 border border-mint/30 text-mint font-mono text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-mint/25">
              <Check className="w-3 h-3"/> I'm Fine
            </button>
            <button onClick={onHelp}
              className="px-3 py-2 rounded-lg bg-coral/15 border border-coral/30 text-coral font-mono text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-coral/25">
              <Phone className="w-3 h-3"/> Help
            </button>
          </div>
        </GlassPanel>
      </div>
    )
  }
 
  if (level === 2) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/85 backdrop-blur-sm p-4 pointer-events-auto">
        <GlassPanel className="max-w-sm w-full p-7 border-coral/40 text-center">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full bg-coral/25 animate-ping"/>
            <div className="relative w-20 h-20 rounded-full bg-coral/15 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-coral"/>
            </div>
          </div>
          <h2 className="font-serif italic text-2xl text-foreground mb-2">Safety Check</h2>
          <p className="font-sans text-sm text-muted-foreground mb-2">{triggerMessages[trigger]||"Please confirm you are safe."}</p>
          <div className="font-mono text-5xl text-coral font-bold mb-6">{fmt(checkInTime)}</div>
          <p className="font-mono text-xs text-muted-foreground/60 mb-4">
            No response = contacting your guardians automatically
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={onSafe}
              className="w-full py-4 rounded-xl bg-mint text-bg font-mono text-base font-bold flex items-center justify-center gap-3 hover:bg-mint/90">
              <Check className="w-6 h-6"/> I'M SAFE
            </button>
            <button onClick={onHelp}
              className="w-full py-4 rounded-xl bg-coral text-white font-mono text-base font-bold flex items-center justify-center gap-3 hover:bg-coral/90">
              <Phone className="w-6 h-6"/> GET HELP NOW
            </button>
          </div>
        </GlassPanel>
      </div>
    )
  }
 
  // Level 3 — Emergency
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto" style={{background:"rgba(255,107,74,0.12)",backdropFilter:"blur(8px)"}}>
      <GlassPanel className="max-w-sm w-full p-7 border-coral text-center">
        <div className="relative w-24 h-24 mx-auto mb-5">
          <div className="absolute inset-0 rounded-full bg-coral/40 animate-ping"/>
          <div className="absolute inset-2 rounded-full bg-coral/30 animate-ping" style={{animationDelay:"0.3s"}}/>
          <div className="relative w-24 h-24 rounded-full bg-coral/20 border-2 border-coral flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-coral"/>
          </div>
        </div>
        <h2 className="font-mono text-xl font-bold text-coral uppercase tracking-wider mb-2">EMERGENCY ALERT</h2>
        <p className="font-sans text-sm text-foreground mb-4">Alerting your guardian contacts now.</p>
 
        <div className="space-y-1.5 mb-5 text-left">
          {contacts.length===0 ? (
            <p className="font-mono text-xs text-amber text-center">No guardian contacts configured. Add contacts in Settings.</p>
          ) : alertStatus.map((r,i)=>(
            <div key={i} className={`flex items-center gap-2 p-2 rounded-lg font-mono text-xs ${r.success?"bg-mint/10 text-mint":"bg-amber/10 text-amber"}`}>
              {r.success ? <Check className="w-3 h-3"/> : <AlertCircle className="w-3 h-3"/>}
              {r.channel==="whatsapp"  && `WhatsApp sent to ${r.contact}`}
              {r.channel==="email"     && (r.success?`Email sent to ${r.contact}`:`Email: ${r.reason||"check config"}`)}
              {r.channel==="guardian_link" && (r.success?"Guardian link copied to clipboard":"Guardian link ready")}
              {r.channel==="link"      && "Guardian watch link copied"}
            </div>
          ))}
          {fired && alertStatus.length===0 && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-2 h-2 rounded-full bg-coral animate-pulse"/>
              <span className="font-mono text-xs text-muted-foreground">Sending alerts...</span>
            </div>
          )}
        </div>
 
        <button onClick={onCancel}
          className="w-full py-4 rounded-xl bg-mint text-bg font-mono text-sm font-bold flex items-center justify-center gap-3 hover:bg-mint/90 mb-3">
          <Check className="w-5 h-5"/> I'M SAFE — CANCEL
        </button>
        <p className="font-mono text-xs text-muted-foreground/60">
          Pressing cancel notifies your contacts that you are safe.
        </p>
      </GlassPanel>
    </div>
  )
}
 
// ── CHANGE NAVIGATION CONFIRMATION MODAL ─────────────────────
// Shown when user presses "Change Route" in NavigationPage.
// YES → cancelJourney(true) saves to history, then navigate("/journey") — clean slate.
// NO  → close modal, navigation continues unchanged.
function ChangeNavModal({ route, onConfirm, onDeny }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div className="max-w-sm w-full bg-bg2 border border-amber/40 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber/15 border border-amber/30 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-5 h-5 text-amber"/>
          </div>
          <div>
            <h3 className="font-serif italic text-lg text-foreground">Change Navigation?</h3>
            <p className="font-mono text-xs text-muted-foreground">This will end your current journey</p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-bg3 border border-border/50 mb-4">
          <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Currently navigating to</div>
          <div className="font-sans text-sm text-foreground font-medium truncate">{route?.to || "Destination"}</div>
          {route?.from && (
            <div className="font-mono text-xs text-muted-foreground/60 mt-0.5 truncate">from {route.from}</div>
          )}
        </div>
        <p className="font-sans text-sm text-muted-foreground mb-5 leading-relaxed">
          Cancelling saves this journey to your history and notifies your guardians. You can then plan a completely new route.
        </p>
        <div className="flex flex-col gap-2.5">
          <button onClick={onConfirm}
            className="w-full py-3.5 rounded-xl bg-coral/15 border border-coral/40 text-coral font-mono text-sm font-bold flex items-center justify-center gap-2 hover:bg-coral/25 transition-all">
            <X className="w-4 h-4"/> Yes, cancel navigation
          </button>
          <button onClick={onDeny}
            className="w-full py-3 rounded-xl border border-border text-muted-foreground font-mono text-xs uppercase hover:border-border/70 hover:text-foreground transition-colors">
            No, keep navigating
          </button>
        </div>
      </div>
    </div>
  )
}
 
// ── MAIN NAVIGATION PAGE ──────────────────────────────────────
export default function NavigationPage() {
  const navigate = useNavigate()
  // mapOverlayEl — DOM node inside AppShell's persistent MapBackground.
  // We portal all map-layer UI (banners, panels, SOS, alerts) into it.
  const { mapOverlayEl } = useOutletContext() || {}
 
  const {
    userPos, setUserPos, selectedRoute,
    cancelJourney,
    currentRisk, confidenceScore, fireIncidents = [],
    journeyProgress, setJourneyProgress,
    sharedMapRef,
    arrivalDeadline,
    aiContext,
  } = useSafety()
 
  const modeConfig = TRANSPORT_MODES[selectedRoute?.transportMode || "walking"]
 
  // Page-level state
  const [isMuted,       setIsMuted]       = useState(false)
  const [activeTab,     setActiveTab]     = useState("route")
  const [showOverlay,   setShowOverlay]   = useState(false)
  const [showGpsCard,   setShowGpsCard]   = useState(false)
  const [panelOpen,     setPanelOpen]     = useState(true)
 
  // Journey progress — initialise from context (survives page navigation)
  const [progress,  setProgress]  = useState(journeyProgress.percent   || 0)
  const [checkIns,  setCheckIns]  = useState(journeyProgress.checkIns  || [])
  const [startedAt]               = useState(journeyProgress.startedAt || Date.now())
 
  // Alert system
  const [alertLevel,   setAlertLevel]   = useState(0)
  const [alertTrigger, setAlertTrigger] = useState("checkin")
  const [checkInTime,  setCheckInTime]  = useState(180)
 
  // Smart trigger refs
  const posHistoryRef    = useRef([])
  const offRouteRef      = useRef(0)
  const lastAlertRef     = useRef(0)
  const mountedAtRef     = useRef(Date.now())
  const pageVisibleRef   = useRef(true)
  const level2IntervalRef = useRef(null)
 
  // ── New feature state ────────────────────────────────────
  const [showDistress,    setShowDistress]    = useState(false)
  const [showCoverMe,     setShowCoverMe]     = useState(false)
  const [guardianLink,    setGuardianLink]    = useState(null)
  const [showLinkCopied,  setShowLinkCopied]  = useState(false)
  const [aiBrief,         setAiBrief]         = useState("")
  const [aiBriefLoading,  setAiBriefLoading]  = useState(false)
  const [aiBriefTime,     setAiBriefTime]     = useState(null)
  const [arrivalMinsLeft, setArrivalMinsLeft] = useState(null)
  const [arrivalFired,    setArrivalFired]    = useState(false)
  const sosLongPressRef  = useRef(null)       // setTimeout handle for long-press detection
  const shakeCountRef    = useRef(0)
  const shakeTimeRef     = useRef(0)
  const aiBriefIntervalRef = useRef(null)
 
  // Page visibility — pause timers when user switches tabs
  useEffect(() => {
    const h = () => { pageVisibleRef.current = !document.hidden }
    document.addEventListener("visibilitychange", h)
    return () => document.removeEventListener("visibilitychange", h)
  }, [])
 
  const hasRoute = !!selectedRoute
 
  // NOTE: We intentionally do NOT call setActiveJourney here.
  // SafetyContext.startJourney() already sets activeJourney before navigate("/navigation")
  // is called from JourneyPage. Calling setActiveJourney again here would overwrite it
  // with a new id and startTime (Bug 5), causing the journey start time to reset to
  // mount time and re-triggering any effects that depend on activeJourney.id.
 
  // Draw selected route on the shared map.
  // Because the map is persistent (owned by AppShell), it's already initialised —
  // no startup timeout needed. setRoutes is called immediately on mount.
  // The 150ms retry covers the case where the user returns from a non-map page:
  // AppShell fires a resize rAF, and we redraw once it settles to make sure
  // the route layer repaints at the correct canvas size.
  useEffect(() => {
    if (!hasRoute || !sharedMapRef.current) return
    const draw = () => {
      if (!sharedMapRef.current) return
      sharedMapRef.current.setRoutes([selectedRoute], selectedRoute.id)
      if (selectedRoute.geometry) sharedMapRef.current.fitRouteBounds(selectedRoute.geometry)
    }
    draw()
    const t = setTimeout(draw, 150)
    return () => clearTimeout(t)
  }, [hasRoute])
 
  // GPS tracking
  useEffect(() => {
    if (!hasRoute || !navigator.geolocation) { setShowGpsCard(!hasRoute); return }
    const wid = navigator.geolocation.watchPosition(
      pos => {
        const coords = [pos.coords.longitude, pos.coords.latitude]
        setUserPos(coords)
        setShowGpsCard(false)
        posHistoryRef.current = [
          ...posHistoryRef.current.slice(-20),
          { pos: coords, time: Date.now(), speed: pos.coords.speed || 0 }
        ]
      },
      () => setShowGpsCard(true),
      { enableHighAccuracy:true, timeout:10000, maximumAge:5000 }
    )
    return () => navigator.geolocation.clearWatch(wid)
  }, [hasRoute])
 
  // Journey progress simulation — scaled to real route duration
  useEffect(() => {
    if (!hasRoute) return
    const increment = 100 / (selectedRoute?.durationSecs || 900)
    const iv = setInterval(() => {
      if (!pageVisibleRef.current) return
      setProgress(p => {
        const next = Math.min(p + increment, 100)
        if (next >= 100) { setTimeout(()=>navigate("/arrival"), 1500); return 100 }
        return next
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [hasRoute])
 
  // Sync progress to context so it survives navigation
  useEffect(() => {
    setJourneyProgress(prev => ({ ...prev, percent: progress, checkIns, startedAt }))
  }, [progress, checkIns])
 
  // ── SMART TRIGGERS ─────────────────────────────────────────
  const GRACE_PERIOD = 30000
 
  // Check-in countdown
  useEffect(() => {
    if (!hasRoute) return
    const iv = setInterval(() => {
      if (!pageVisibleRef.current) return
      if (Date.now() - mountedAtRef.current < GRACE_PERIOD) return
      if (alertLevel > 0) return
      setCheckInTime(prev => {
        if (prev <= 1) { triggerAlert("checkin", 2); return 180 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [hasRoute, alertLevel])
 
  // Stopped-too-long detection
  useEffect(() => {
    if (!hasRoute) return
    const iv = setInterval(() => {
      if (!pageVisibleRef.current) return
      if (Date.now() - mountedAtRef.current < GRACE_PERIOD) return
      if (alertLevel > 0) return
      const history = posHistoryRef.current
      if (history.length < 3) return
      const recent  = history.slice(-6)
      const maxMove = recent.reduce((max, h, i) => {
        if (i===0) return max
        const dist = Math.hypot(h.pos[0]-recent[i-1].pos[0], h.pos[1]-recent[i-1].pos[1]) * 111000
        return Math.max(max, dist)
      }, 0)
      const dwellSecs = modeConfig.dwellMins * 60
      const allStopped = maxMove < modeConfig.minSpeed * 0.3
      if (allStopped) {
        const stopped = (Date.now() - (recent[0]?.time||Date.now())) / 1000
        if (stopped >= dwellSecs) triggerAlert("stopped", 2)
      }
    }, 10000)
    return () => clearInterval(iv)
  }, [hasRoute, modeConfig, alertLevel])
 
  // Off-route detection
  useEffect(() => {
    if (!hasRoute || !selectedRoute?.geometry?.coordinates) return
    const iv = setInterval(() => {
      if (!pageVisibleRef.current) return
      if (Date.now() - mountedAtRef.current < GRACE_PERIOD) return
      if (alertLevel > 0) return
      const routeCoords = selectedRoute.geometry.coordinates
      const corridorKm  = selectedRoute.transportMode==="driving"?0.15:0.08
      const minDist = routeCoords.reduce((min, coord) => {
        const d = Math.hypot(userPos[0]-coord[0], userPos[1]-coord[1]) * 111
        return Math.min(min, d)
      }, Infinity)
      if (minDist > corridorKm) {
        offRouteRef.current += 15
        if (offRouteRef.current >= 60) { triggerAlert("offroute", 1); offRouteRef.current = 0 }
      } else {
        offRouteRef.current = 0
      }
    }, 15000)
    return () => clearInterval(iv)
  }, [hasRoute, selectedRoute, userPos, alertLevel])
 
  // Speed anomaly detection
  useEffect(() => {
    if (!hasRoute) return
    const iv = setInterval(() => {
      if (!pageVisibleRef.current) return
      if (Date.now() - mountedAtRef.current < GRACE_PERIOD) return
      if (alertLevel > 0) return
      const history = posHistoryRef.current
      if (history.length < 2) return
      const last2 = history.slice(-2)
      const distKm = Math.hypot(last2[1].pos[0]-last2[0].pos[0], last2[1].pos[1]-last2[0].pos[1]) * 111
      const timeSec = (last2[1].time - last2[0].time) / 1000
      if (timeSec < 1) return
      const speedKmh = (distKm / timeSec) * 3600
      if (speedKmh > modeConfig.maxSpeed * 1.5 || (speedKmh > 2 && speedKmh < modeConfig.minSpeed * 0.3)) {
        triggerAlert("speed", 1)
      }
    }, 20000)
    return () => clearInterval(iv)
  }, [hasRoute, modeConfig, alertLevel])
 
  // Auto-escalate Level 1 → 2
  useEffect(() => {
    if (alertLevel !== 1) return
    const t = setTimeout(() => setAlertLevel(prev => prev===1?2:prev), 120000)
    return () => clearTimeout(t)
  }, [alertLevel])
 
  // Auto-escalate Level 2 → 3 — stored in ref so handleSafe cancels it immediately
  useEffect(() => {
    if (alertLevel !== 2) return
    level2IntervalRef.current = setInterval(() => {
      setCheckInTime(prev => {
        if (prev <= 1) { setAlertLevel(3); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => {
      clearInterval(level2IntervalRef.current)
      level2IntervalRef.current = null
    }
  }, [alertLevel])
 
  function triggerAlert(trigger, level) {
    if (Date.now() - lastAlertRef.current < 60000) return
    if (alertLevel >= level) return
    lastAlertRef.current = Date.now()
    setAlertTrigger(trigger)
    setAlertLevel(level)
    setCheckInTime(level===2?60:180)
    if (level >= 2) playCrisisAlert()
  }
 
  // ── SHAKE DETECTION — opens distress broadcast silently ──
  useEffect(() => {
    if (!hasRoute) return
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity
      if (!a) return
      const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2 + (a.z||0)**2)
      if (mag > 25) {
        const now = Date.now()
        if (now - shakeTimeRef.current > 1500) {
          shakeCountRef.current = 0
        }
        shakeCountRef.current++
        shakeTimeRef.current = now
        if (shakeCountRef.current >= 3) {
          shakeCountRef.current = 0
          setShowDistress(true)
        }
      }
    }
    window.addEventListener("devicemotion", onMotion)
    return () => window.removeEventListener("devicemotion", onMotion)
  }, [hasRoute])
 
  // ── ARRIVAL TIMER — dead man's switch ────────────────────
  useEffect(() => {
    if (!hasRoute || !arrivalDeadline) return
    const iv = setInterval(() => {
      const msLeft = arrivalDeadline - Date.now()
      const minsLeft = Math.ceil(msLeft / 60000)
      setArrivalMinsLeft(minsLeft > 0 ? minsLeft : 0)
      // Grace period: 3 minutes past deadline
      if (msLeft < -180000 && !arrivalFired) {
        setArrivalFired(true)
        triggerAlert("arrive_timer", 2)
      }
    }, 30000)
    // Run immediately
    const msLeft = arrivalDeadline - Date.now()
    setArrivalMinsLeft(Math.max(0, Math.ceil(msLeft / 60000)))
    return () => clearInterval(iv)
  }, [hasRoute, arrivalDeadline, arrivalFired])
 
  // ── GUARDIAN WATCH LINK — generate once on mount ─────────
  useEffect(() => {
    if (!hasRoute || !selectedRoute) return
    const link = generateGuardianLink(selectedRoute, userPos)
    setGuardianLink(link)
  }, [hasRoute])
 
  // ── AI SITUATIONAL BRIEF — fetch every 2 minutes ─────────
  const fetchAIBrief = useCallback(async () => {
    if (!hasRoute || !selectedRoute) return
    const KEY = import.meta.env.VITE_GROQ_API_KEY
    if (!KEY) {
      setAiBrief("AI briefing requires a Groq API key configured in your environment.")
      return
    }
    setAiBriefLoading(true)
    try {
      const neighbourhood = currentRisk?.name || "Montgomery"
      const risk          = currentRisk?.score || 28
      const incidents     = fireIncidents.slice(0, 3).map(i => i.type || "Incident").join(", ") || "None"
      const prompt = `You are a concise safety briefing AI for SafeRoute AI+.
Current position: ${neighbourhood}, risk score ${risk}/99.
Active incidents nearby: ${incidents}.
Journey: ${selectedRoute.from || "Origin"} → ${selectedRoute.to || "Destination"}, ${Math.round(progress || 0)}% complete.
Context: ${aiContext?.slice(0, 400) || "Montgomery, AL"}
 
Give a 3-sentence safety briefing. Be specific, direct, and actionable. No preamble.`
 
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile", max_tokens: 120, temperature: 0.4,
          messages: [{ role: "user", content: prompt }]
        })
      })
      const d = await res.json()
      setAiBrief(d.choices?.[0]?.message?.content?.trim() || "Briefing unavailable.")
      setAiBriefTime(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }))
    } catch {
      setAiBrief("Could not fetch AI briefing — check your connection.")
    } finally {
      setAiBriefLoading(false)
    }
  }, [hasRoute, selectedRoute, currentRisk, fireIncidents, aiContext])
 
  useEffect(() => {
    if (!hasRoute) return
    fetchAIBrief()
    aiBriefIntervalRef.current = setInterval(fetchAIBrief, 120000)
    return () => clearInterval(aiBriefIntervalRef.current)
  }, [hasRoute])
 
  const handleSafe = useCallback(() => {
    clearInterval(level2IntervalRef.current)
    level2IntervalRef.current = null
    setAlertLevel(0)
    setCheckInTime(180)
    offRouteRef.current = 0
    lastAlertRef.current = Date.now()
    const time = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})
    setCheckIns(prev=>[...prev,{time,trigger:alertTrigger||"manual",level:alertLevel}])
  },[alertTrigger, alertLevel])
 
  const handleHelp = useCallback(() => { setAlertLevel(3) }, [])
 
  const handleCancelEmergency = useCallback(() => {
    setAlertLevel(0); setCheckInTime(180)
    const time = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})
    setCheckIns(prev=>[...prev,{time,trigger:"emergency_cancelled",level:3}])
  },[])
 
  // "Change Route" — show modal before doing anything destructive
  const [showChangeConfirm, setShowChangeConfirm] = useState(false)
 
  const handleChangeRoute = useCallback(() => {
    setShowChangeConfirm(true)
  }, [])
 
  const handleConfirmChange = useCallback(() => {
    setShowChangeConfirm(false)
    // Belt-and-suspenders: clear map lines here before cancelJourney is called.
    // cancelJourney in SafetyContext also calls clearRoutes(), but doing it here
    // first ensures the canvas is clean before any React re-renders fire.
    sharedMapRef.current?.clearRoutes?.()
    cancelJourney(true)   // saves to journey history as CANCELLED, clears selectedRoute + journeyPlan
    navigate("/journey")  // selectedRoute is now null → JourneyPage renders blank form
  }, [cancelJourney, navigate, sharedMapRef])
 
  const handleDenyChange = useCallback(() => {
    setShowChangeConfirm(false)
    // nothing changes — navigation continues as-is
  }, [])
 
  const handleCompleteJourney = useCallback(() => {
    const time = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})
    setCheckIns(prev=>[...prev,{time,trigger:"arrival",level:0}])
    navigate("/arrival")
  },[])
 
  const distRemaining = selectedRoute?.distanceM
    ? ((selectedRoute.distanceM * (1-progress/100)) / 1609.34).toFixed(1) + " mi"
    : selectedRoute?.distance || "--"
  const etaMins = selectedRoute?.durationSecs
    ? Math.max(0, Math.round(selectedRoute.durationSecs*(1-progress/100)/60))
    : null
 
  // ── NO ROUTE — show overlay on persistent map ─────────────
  if (!hasRoute) {
    return (
      <>
        <NoJourneyOverlay mapOverlayEl={mapOverlayEl} />
        {/* Render an empty aside so the flex layout in AppShell isn't broken */}
        <aside className="hidden md:block md:w-0" />
      </>
    )
  }
 
  // ── MAP OVERLAYS (portaled into the persistent map) ───────
  const mapContent = mapOverlayEl ? createPortal(
    <div className="absolute inset-0 pointer-events-none">
 
      {/* Alert modals */}
      {alertLevel > 0 && (
        <AlertModal
          level={alertLevel} trigger={alertTrigger}
          route={selectedRoute} userPos={userPos}
          checkInTime={checkInTime}
          onSafe={handleSafe} onHelp={handleHelp}
          onCancel={handleCancelEmergency}
        />
      )}
 
      {/* GPS permission card */}
      {showGpsCard && (
        <div className="absolute top-3 left-3 right-16 z-20 max-w-xs pointer-events-auto">
          <LocationPermissionCard context="monitor"
            onAllow={pos=>{setUserPos([pos.lng,pos.lat]);setShowGpsCard(false)}}
            onDismiss={()=>setShowGpsCard(false)}/>
        </div>
      )}
 
      {/* Destination banner */}
      {!showGpsCard && (
        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[260px] pointer-events-none">
          <GlassPanel className="p-3 flex items-center gap-3 border-l-4 border-l-mint">
            <Navigation className="w-4 h-4 text-mint flex-shrink-0"/>
            <div className="min-w-0">
              <div className="font-serif italic text-sm text-foreground truncate">{selectedRoute.to||"Destination"}</div>
              <div className="font-mono text-xs text-muted-foreground">{selectedRoute.name} · {TRANSPORT_MODES[selectedRoute.transportMode]?.icon}</div>
            </div>
          </GlassPanel>
        </div>
      )}
 
      {/* Top-right controls */}
      <div className="absolute top-3 right-14 z-20 flex flex-col gap-2 pointer-events-auto">
        <button onClick={()=>setIsMuted(!isMuted)}
          className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-bg2 transition-colors">
          {isMuted?<VolumeX className="w-4 h-4 text-muted-foreground"/>:<Volume2 className="w-4 h-4 text-foreground"/>}
        </button>
        <button onClick={handleChangeRoute}
          className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-amber/10 transition-colors" title="Change route">
          <RotateCcw className="w-4 h-4 text-amber"/>
        </button>
      </div>
 
      {/* Bottom status panel */}
      <div className="absolute bottom-4 left-4 right-16 md:right-auto md:max-w-lg z-20 pointer-events-auto">
        <GlassPanel className="shadow-2xl border-t-4 border-mint/30 overflow-hidden">
          <button className="md:hidden flex justify-center w-full pt-2.5 pb-1" onClick={()=>setPanelOpen(o=>!o)}>
            <div className="w-8 h-1 rounded-full bg-border"/>
          </button>
          <div className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Shield className={`w-5 h-5 ${currentRisk.level==="HIGH"?"text-coral":currentRisk.level==="MEDIUM"?"text-amber":"text-mint"}`}/>
                <div>
                  <div className="font-sans text-sm font-medium text-foreground">Journey Active</div>
                  <div className="font-mono text-xs text-muted-foreground">{currentRisk.name} · {currentRisk.level}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl text-foreground font-bold">{fmt(checkInTime)}</div>
                <div className="font-mono text-[11px] text-muted-foreground">NEXT CHECK-IN</div>
              </div>
            </div>
            <button onClick={handleSafe}
              className="w-full py-3 rounded-xl bg-mint text-bg font-mono text-sm font-bold flex items-center justify-center gap-2 hover:bg-mint/90 shadow-lg mb-3">
              <Check className="w-5 h-5"/> I'M SAFE
            </button>
            <div className={`md:block transition-all ${panelOpen?"block":"hidden"}`}>
              <div className="grid grid-cols-4 gap-1.5 mb-3">
                {[
                  {icon:Activity, label:"Mode",   value:TRANSPORT_MODES[selectedRoute.transportMode]?.icon||"🚶", color:"text-mint"},
                  {icon:Cpu,      label:"Safety", value:`${Math.max(1,Math.round(100-(currentRisk.score||28)))}%`, color:"text-sky"},
                  {icon:Eye,      label:"Risk",   value:`${currentRisk.score||28}/99`, color:currentRisk.level==="HIGH"?"text-coral":currentRisk.level==="MEDIUM"?"text-amber":"text-mint"},
                  {icon:Clock,    label:"ETA",    value:etaMins!==null?`${etaMins}m`:"--", color:"text-foreground"},
                ].map(({icon:Icon,label,value,color})=>(
                  <div key={label} className="bg-bg3 rounded-xl p-2 text-center">
                    <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color}`}/>
                    <div className="font-mono text-[7px] text-muted-foreground">{label}</div>
                    <div className={`font-sans text-xs font-medium ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between font-mono text-xs text-muted-foreground">
                  <span>{distRemaining} remaining</span>
                  <span>{Math.round(progress)}% complete</span>
                </div>
                <div className="h-1.5 bg-bg3 rounded-full overflow-hidden">
                  <div className="h-full bg-mint rounded-full transition-all duration-500" style={{width:`${progress}%`}}/>
                </div>
                {/* Arrival timer chip */}
                {arrivalDeadline && arrivalMinsLeft !== null && (
                  <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border font-mono text-[10px] mt-1 ${
                    arrivalMinsLeft <= 2
                      ? "bg-coral/10 border-coral/30 text-coral"
                      : arrivalMinsLeft <= 5
                      ? "bg-amber/10 border-amber/30 text-amber"
                      : "bg-amber2/8 border-amber2/20 text-amber2"
                  }`}>
                    <Clock className="w-3 h-3 flex-shrink-0"/>
                    {arrivalMinsLeft > 0
                      ? `Arrival timer: ${arrivalMinsLeft} min`
                      : "Arrival timer: OVERDUE"
                    }
                  </div>
                )}
              </div>
              {progress > 90 && (
                <button onClick={handleCompleteJourney}
                  className="mt-3 w-full py-2.5 rounded-xl bg-amber2/15 border border-amber2/30 text-amber2 font-mono text-xs uppercase flex items-center justify-center gap-2 hover:bg-amber2/25 transition-colors">
                  <UserCheck className="w-3.5 h-3.5"/> Mark as Arrived
                </button>
              )}
            </div>
          </div>
        </GlassPanel>
      </div>
 
      {/* Journey Info button — mobile only, visible when sidebar is closed */}
      {!showOverlay && (
        <button onClick={()=>setShowOverlay(true)}
          className="md:hidden absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl glass border border-sky/30 text-sky font-mono text-xs uppercase tracking-wider flex items-center gap-2 pointer-events-auto">
          <MapPin className="w-3.5 h-3.5"/> Journey Info
        </button>
      )}
 
      {/* Cover Me button — bottom-left */}
      <button
        onClick={()=>setShowCoverMe(true)}
        className="absolute bottom-4 left-4 z-30 px-3 py-2.5 rounded-xl glass border border-sky/30 text-sky font-mono text-xs uppercase tracking-wider flex items-center gap-2 pointer-events-auto hover:border-sky/60 hover:bg-sky/8 transition-all"
      >
        <PhoneCall className="w-3.5 h-3.5"/> Cover Me
      </button>
 
      {/* SOS button — long-press (2s) opens distress broadcast, tap fires emergency */}
      <button
        onMouseDown={()=>{ sosLongPressRef.current = setTimeout(()=>{ setShowDistress(true) }, 2000) }}
        onMouseUp={()=>{ clearTimeout(sosLongPressRef.current) }}
        onMouseLeave={()=>{ clearTimeout(sosLongPressRef.current) }}
        onTouchStart={()=>{ sosLongPressRef.current = setTimeout(()=>{ setShowDistress(true) }, 2000) }}
        onTouchEnd={()=>{ clearTimeout(sosLongPressRef.current) }}
        onClick={handleHelp}
        className="absolute bottom-4 right-4 w-14 h-14 md:w-16 md:h-16 rounded-full bg-coral flex flex-col items-center justify-center z-30 shadow-2xl hover:bg-coral/90 active:scale-95 transition-all ring-4 ring-coral/30 pointer-events-auto select-none"
        title="Tap: Emergency Alert · Long-press: Silent Distress Broadcast"
      >
        <span className="font-mono text-sm font-bold text-white leading-none">SOS</span>
        <span className="font-mono text-[7px] text-white/60 leading-none mt-0.5">HOLD:SILENT</span>
      </button>
 
    </div>,
    mapOverlayEl
  ) : null
 
  return (
    <>
      {/* Change navigation confirmation — portaled to document.body */}
      {showChangeConfirm && createPortal(
        <ChangeNavModal
          route={selectedRoute}
          onConfirm={handleConfirmChange}
          onDeny={handleDenyChange}
        />,
        document.body
      )}
 
      {/* Silent Distress Broadcast — portaled to document.body */}
      {showDistress && (
        <DistressBroadcast
          journey={selectedRoute}
          userPos={userPos}
          onClose={()=>setShowDistress(false)}
        />
      )}
 
      {/* Cover Me / Fake Call — portaled to document.body */}
      {showCoverMe && (
        <CoverMe
          onClose={()=>setShowCoverMe(false)}
          onSOS={handleHelp}
        />
      )}
 
      {/* Map-layer UI portaled into the persistent map */}
      {mapContent}
 
      {/* Sidebar — rendered in the Outlet slot (right of the map in AppShell's flex row) */}
      <aside className={`bg-bg2 border-l border-border flex flex-col z-30 md:w-[300px] md:flex-shrink-0 md:relative md:translate-y-0 md:opacity-100 md:h-full fixed inset-x-0 bottom-0 max-h-[72vh] rounded-t-2xl shadow-2xl transition-all duration-300 ${showOverlay?"translate-y-0 opacity-100":"translate-y-full opacity-0 pointer-events-none md:opacity-100 md:translate-y-0 md:pointer-events-auto"}`}>
        <button className="md:hidden flex justify-center w-full pt-3 pb-1 flex-shrink-0" onClick={()=>setShowOverlay(false)}>
          <div className="w-10 h-1 rounded-full bg-border"/>
        </button>
 
        <div className="flex border-b border-border flex-shrink-0">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              className={`flex-1 py-3 font-mono text-xs uppercase tracking-wider transition-colors ${activeTab===t.id?"text-amber2 bg-bg3 border-b-2 border-amber2":"text-muted-foreground hover:text-foreground hover:bg-bg3/50"}`}>
              {t.label}
            </button>
          ))}
        </div>
 
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
 
          {activeTab==="route" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-serif italic text-2xl text-foreground">{distRemaining}</div>
                  <div className="font-mono text-xs text-muted-foreground">Remaining</div>
                </div>
                <div className="text-right">
                  <div className="font-serif italic text-2xl text-foreground">{etaMins!==null?`${etaMins} min`:"--"}</div>
                  <div className="font-mono text-xs text-muted-foreground">ETA</div>
                </div>
              </div>
              <div className="h-1.5 bg-bg3 rounded-full overflow-hidden">
                <div className="h-full bg-sky rounded-full transition-all" style={{width:`${progress}%`}}/>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-2.5 bg-bg3 rounded-xl">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky flex-shrink-0"/>
                  <span className="font-sans text-xs text-foreground truncate">{selectedRoute?.from||"Start"}</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 bg-bg3 rounded-xl">
                  <div className="w-2.5 h-2.5 rounded-full bg-mint flex-shrink-0"/>
                  <span className="font-sans text-xs text-foreground truncate">{selectedRoute?.to||"Destination"}</span>
                </div>
              </div>
              <GlassPanel className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-sans text-xs text-foreground">Area Risk</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${currentRisk.level==="HIGH"?"bg-coral/15 text-coral":currentRisk.level==="MEDIUM"?"bg-amber/15 text-amber":"bg-mint/15 text-mint"}`}>
                    {currentRisk.level}
                  </span>
                </div>
                <p className="font-sans text-[11px] text-muted-foreground">{currentRisk.name} · Score {currentRisk.score}/99</p>
              </GlassPanel>
            </>
          )}
 
          {activeTab==="intel" && (
            <>
              <GlassPanel className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-sans text-xs text-foreground">Live Incidents</span>
                  <span className="font-mono text-xs text-coral font-bold">{fireIncidents.length}</span>
                </div>
                <p className="font-sans text-[11px] text-muted-foreground">
                  Safety: {Math.max(1,Math.round(100-currentRisk.score))}% · Risk: {currentRisk.score}/99
                </p>
              </GlassPanel>
              {fireIncidents.slice(0,4).map((inc,i)=>(
                <GlassPanel key={i} className="p-3 border-l-2 border-l-coral">
                  <div className="font-sans text-xs text-foreground">{inc.type||"Incident"}</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">
                    {inc.address||inc.district||"Montgomery, AL"}
                  </div>
                </GlassPanel>
              ))}
              {!fireIncidents.length && (
                <div className="text-center py-6">
                  <Shield className="w-8 h-8 text-mint/40 mx-auto mb-2"/>
                  <p className="font-mono text-xs text-muted-foreground">No active alerts on your route</p>
                </div>
              )}
            </>
          )}
 
          {activeTab==="ai" && (
            <>
              <div className="flex items-center gap-2 text-purple border-b border-purple/20 pb-2">
                <Cpu className="w-4 h-4"/>
                <span className="font-mono text-xs uppercase">AI Situational Brief</span>
                {aiBriefTime && (
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{aiBriefTime}</span>
                )}
              </div>
 
              {aiBriefLoading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-purple/30 border-t-purple animate-spin"/>
                  <span className="font-mono text-xs text-muted-foreground">Analysing live conditions…</span>
                </div>
              ) : aiBrief ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-purple/8 border border-purple/20">
                    <p className="font-sans text-sm text-foreground leading-relaxed">{aiBrief}</p>
                  </div>
                  <button
                    onClick={fetchAIBrief}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/70 transition-colors font-mono text-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5"/> Refresh Brief
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Cpu className="w-8 h-8 text-muted-foreground/30"/>
                  <span className="font-mono text-xs text-muted-foreground text-center">
                    AI brief updates every 2 minutes while navigating
                  </span>
                  <button onClick={fetchAIBrief} className="px-4 py-2 rounded-lg bg-purple/10 border border-purple/30 text-purple font-mono text-xs hover:bg-purple/20 transition-colors">
                    Generate Now
                  </button>
                </div>
              )}
 
              {/* Guardian Watch Link */}
              {guardianLink && (
                <div className="mt-3 pt-3 border-t border-border/20 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Link2 className="w-3.5 h-3.5"/>
                    <span className="font-mono text-[10px] uppercase">Guardian Watch Link</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-2.5 py-2 rounded-lg bg-bg3 border border-border/30 font-mono text-[10px] text-muted-foreground truncate">
                      {guardianLink.replace(window.location.origin, "…")}
                    </div>
                    <button
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(guardianLink); setShowLinkCopied(true); setTimeout(()=>setShowLinkCopied(false), 2000) } catch {}
                      }}
                      className={`px-3 py-2 rounded-lg border font-mono text-xs transition-all flex-shrink-0 ${
                        showLinkCopied
                          ? "bg-mint/10 border-mint/30 text-mint"
                          : "border-border/40 text-muted-foreground hover:border-border/70 hover:text-foreground"
                      }`}
                    >
                      {showLinkCopied ? <><Check className="w-3 h-3 inline"/> Copied</> : "Copy"}
                    </button>
                  </div>
                  <p className="font-mono text-[9px] text-muted-foreground/40">
                    Share with a guardian — they can see your route start point and journey details
                  </p>
                </div>
              )}
            </>
          )}
 
          {activeTab==="logs" && (
            <>
              <div className="flex items-center gap-2 text-mint border-b border-mint/20 pb-2">
                <Zap className="w-4 h-4"/>
                <span className="font-mono text-xs uppercase">Check-in Log</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{checkIns.length} total</span>
              </div>
              {checkIns.length===0 ? (
                <p className="font-mono text-xs text-muted-foreground text-center py-4">
                  No check-ins yet -- press I'M SAFE to log one
                </p>
              ) : [...checkIns].reverse().map((c,i)=>(
                <div key={i} className="flex items-center gap-3 p-2.5 bg-bg3 rounded-xl">
                  <Check className="w-3.5 h-3.5 text-mint flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-foreground">Safe check-in</span>
                    <div className="font-mono text-xs text-muted-foreground/60 capitalize">{c.trigger?.replace("_"," ")||"manual"}</div>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{c.time}</span>
                </div>
              ))}
            </>
          )}
        </div>
 
        <div className="p-3 border-t border-border bg-bg3 flex gap-2 flex-shrink-0 flex-wrap">
          <button onClick={handleChangeRoute}
            className="flex-1 py-3 rounded-xl border border-amber/30 text-amber font-mono text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-amber/10 transition-colors">
            <RotateCcw className="w-3.5 h-3.5"/> Change
          </button>
          <button onClick={()=>setShowDistress(true)}
            className="flex-1 py-3 rounded-xl border border-coral/30 text-coral font-mono text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-coral/10 transition-colors">
            <Radio className="w-3.5 h-3.5"/> Distress
          </button>
          <button onClick={handleHelp}
            className="flex-1 py-3 rounded-xl bg-coral text-white font-mono text-xs uppercase flex items-center justify-center gap-1.5 hover:bg-coral/90 transition-colors">
            <Phone className="w-3.5 h-3.5"/> SOS
          </button>
        </div>
      </aside>
    </>
  )
}