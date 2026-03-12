import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useMontgomeryData } from '@/hooks/useMontgomeryData'
 
const SafetyContext = createContext()
 
export const TRANSPORT_MODES = {
  walking:  { label: "Walking",  icon: "🚶", maxSpeed: 8,   minSpeed: 0.5, dwellMins: 4,  bufferPct: 40, mapboxProfile: "walking"         },
  running:  { label: "Running",  icon: "🏃", maxSpeed: 18,  minSpeed: 3,   dwellMins: 2,  bufferPct: 25, mapboxProfile: "walking"         },
  cycling:  { label: "Cycling",  icon: "🚴", maxSpeed: 35,  minSpeed: 2,   dwellMins: 3,  bufferPct: 30, mapboxProfile: "cycling"         },
  driving:  { label: "Driving",  icon: "🚗", maxSpeed: 120, minSpeed: 5,   dwellMins: 5,  bufferPct: 15, mapboxProfile: "driving-traffic" },
}
 
export const SafetyProvider = ({ children }) => {
  const [activeJourney,    setActiveJourney]   = useState(null)
  const [selectedRoute,    setSelectedRoute]   = useState(null)
  const [isEmergency,      setIsEmergency]     = useState(false)
  const [userPos,          setUserPos]         = useState([-86.3006, 32.3668])
  const [liveIncidents,    setLiveIncidents]   = useState([])
  const [confidenceScore,  setConfidenceScore] = useState(94)
  const [transportMode,    setTransportMode]   = useState("walking")
  const [journeyProgress,  setJourneyProgress] = useState({
    percent: 0, checkIns: [], startedAt: null, lastPosition: null, alertLevel: 0
  })
  // Arrival timer deadline — epoch ms. Null = no timer set.
  // NavigationPage watches this and escalates to Level 2 alert when exceeded.
  const [arrivalDeadline, setArrivalDeadline] = useState(null)
 
  // ── SHARED MAP REF ────────────────────────────────────────────
  // AppShell owns the single persistent MapBackground instance.
  // JourneyPage and NavigationPage both read/write map state through this ref.
  // The Mapbox instance never unmounts when navigating between /journey ↔ /navigation.
  const sharedMapRef = useRef(null)
 
  // Ref mirror of selectedRoute — cancelJourney reads this so it always gets the
  // live value even if the useCallback closure captured a stale copy (Bug 6).
  const selectedRouteRef = useRef(null)
 
  // Journey plan persists in sessionStorage across React navigation
  const [journeyPlan, _setJourneyPlan] = useState(() => {
    try {
      const s = sessionStorage.getItem('saferoute_journey_plan')
      return s ? JSON.parse(s) : null
    } catch { return null }
  })
  const setJourneyPlan = useCallback((plan) => {
    _setJourneyPlan(plan)
    try {
      if (plan) sessionStorage.setItem('saferoute_journey_plan', JSON.stringify(plan))
      else sessionStorage.removeItem('saferoute_journey_plan')
    } catch {}
  }, [])
 
  const handleIncidentsLoaded  = useCallback((i) => setLiveIncidents(i), [])
  const handleConfidenceUpdate = useCallback((s) => setConfidenceScore(s), [])
 
  const { neighborhoods, fireIncidents, hasLiveData, loading, aiContext, stats } =
    useMontgomeryData({ onIncidentsLoaded: handleIncidentsLoaded, onConfidenceUpdate: handleConfidenceUpdate })
 
  const getCurrentRisk = useCallback(() => {
    if (!neighborhoods?.length || !hasLiveData)
      return { level: 'MEDIUM', score: 45, name: 'Unknown', color: '#FBBF24' }
    let closest = neighborhoods[0], minDist = Infinity
    neighborhoods.forEach(n => {
      const d = Math.hypot(n.lat - userPos[1], n.lng - userPos[0])
      if (d < minDist) { minDist = d; closest = n }
    })
    const level = closest.risk_score >= 65 ? 'HIGH' : closest.risk_score >= 40 ? 'MEDIUM' : 'LOW'
    return {
      level, score: Math.round(closest.risk_score), name: closest.name,
      color: level === 'HIGH' ? '#FF6B4A' : level === 'MEDIUM' ? '#FBBF24' : '#00E5A0',
    }
  }, [neighborhoods, hasLiveData, userPos])
 
  const currentRisk = getCurrentRisk()
 
  useEffect(() => {
    if (!activeJourney || !neighborhoods.length) return
    const iv = setInterval(() => {
      const t = neighborhoods.find(n => n.risk_level === 'LOW') || neighborhoods[0]
      setUserPos(p => [p[0] + (t.lng - p[0]) * 0.003, p[1] + (t.lat - p[1]) * 0.003])
      setConfidenceScore(p => Math.min(98, p + (currentRisk.level === 'HIGH' ? -0.3 : 0.4)))
    }, 3000)
    return () => clearInterval(iv)
  }, [activeJourney, neighborhoods, currentRisk.level])
 
  const refreshLiveHappening = useCallback(async () => {
    if (activeJourney && Math.random() > 0.7) {
      setLiveIncidents(p => [...p, {
        id: Date.now(), type: 'Incident',
        lat: userPos[1] + (Math.random() - 0.5) * 0.015,
        lng: userPos[0] + (Math.random() - 0.5) * 0.015,
        description: 'Reported activity nearby', timestamp: new Date().toISOString(),
      }])
    }
  }, [activeJourney, userPos])
 
  useEffect(() => {
    if (!activeJourney) return
    const iv = setInterval(refreshLiveHappening, 15000)
    refreshLiveHappening()
    return () => clearInterval(iv)
  }, [activeJourney, refreshLiveHappening])
 
  const startJourney = useCallback((route) => {
    const enriched = { ...route, transportMode, startedAt: new Date().toISOString() }
    selectedRouteRef.current = enriched
    setSelectedRoute(enriched)
    setActiveJourney({ id: Date.now(), from: route.from || 'Origin', to: route.to || 'Destination',
      startTime: new Date().toISOString(), routeId: route.id, transportMode })
    setJourneyProgress({ percent: 0, checkIns: [], startedAt: Date.now(), lastPosition: null, alertLevel: 0 })
    // Arrival timer — set deadline if caller supplied arrivalMins
    if (route.arrivalMins && route.arrivalMins > 0) {
      setArrivalDeadline(Date.now() + route.arrivalMins * 60 * 1000)
    } else {
      setArrivalDeadline(null)
    }
  }, [transportMode])
 
  const cancelJourney = useCallback((saveToHistory = true) => {
    // Bug 6 fix: read from ref — the useCallback closure value of selectedRoute
    // can be stale if the route changed after this callback was last memoised.
    const route = selectedRouteRef.current
 
    if (saveToHistory && route) {
      try {
        const h = JSON.parse(localStorage.getItem('saferoute_journeys') || '[]')
        const okFrom = route.from && !['Current Location','Unknown','Origin'].includes(route.from)
        const okTo   = route.to   && !['Destination','Unknown'].includes(route.to)
        if (okFrom && okTo) {
          h.unshift({
            from: route.from, fromCoords: route.fromCoords,
            to: route.to,     destCoords: route.toCoords,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            duration: route.duration || '--', distance: route.distance || '--',
            outcome: 'CANCELLED',
          })
          localStorage.setItem('saferoute_journeys', JSON.stringify(h.slice(0, 20)))
        }
      } catch {}
    }
 
    // Bug 3 fix: wipe route lines from the shared Mapbox canvas.
    // clearRoutes() calls the public API that also clears lastRoutesRef so a
    // subsequent style toggle doesn't ghost-redraw the cancelled route.
    sharedMapRef.current?.clearRoutes?.()
 
    // Bug 1 fix: clear selectedRoute so NavigationPage's hasRoute becomes false
    // and the NoJourneyOverlay is shown instead of the active navigation UI.
    selectedRouteRef.current = null
    setSelectedRoute(null)
 
    // Bug 2 fix: clear journeyPlan so JourneyPage's mount-restore effect finds
    // nothing and renders a blank form instead of the cancelled journey's data.
    setJourneyPlan(null)
    setArrivalDeadline(null)
    setActiveJourney(null)
    setJourneyProgress({ percent: 0, checkIns: [], startedAt: null, lastPosition: null, alertLevel: 0 })
  }, [setJourneyPlan])   // no longer depends on selectedRoute state — uses ref instead
 
  return (
    <SafetyContext.Provider value={{
      activeJourney, setActiveJourney, selectedRoute, setSelectedRoute,
      isEmergency, setIsEmergency, journeyPlan, setJourneyPlan,
      journeyProgress, setJourneyProgress, transportMode, setTransportMode,
      arrivalDeadline, setArrivalDeadline,
      startJourney, cancelJourney,
      userPos, setUserPos, liveIncidents, setLiveIncidents,
      confidenceScore, setConfidenceScore, currentRisk, getCurrentRisk,
      neighborhoods, fireIncidents, hasLiveData, loading, aiContext, stats,
      refreshLiveHappening,
      sharedMapRef,
    }}>
      {children}
    </SafetyContext.Provider>
  )
}
 
export const useSafety = () => {
  const ctx = useContext(SafetyContext)
  if (!ctx) {
    console.warn('[SafeRoute] SafetyContext undefined')
    return {
      userPos: [-86.3006, 32.3668], setUserPos: () => {},
      selectedRoute: null, setSelectedRoute: () => {},
      activeJourney: null, setActiveJourney: () => {},
      isEmergency: false,  setIsEmergency: () => {},
      journeyPlan: null,   setJourneyPlan: () => {},
      journeyProgress: { percent: 0, checkIns: [], startedAt: null, lastPosition: null, alertLevel: 0 },
      setJourneyProgress: () => {}, transportMode: 'walking', setTransportMode: () => {},
      arrivalDeadline: null, setArrivalDeadline: () => {},
      startJourney: () => {}, cancelJourney: () => {},
      liveIncidents: [], setLiveIncidents: () => {},
      confidenceScore: 94, setConfidenceScore: () => {},
      currentRisk: { level: 'LOW', score: 28, name: 'Montgomery', color: '#00E5A0' },
      getCurrentRisk: () => ({ level: 'LOW', score: 28, name: 'Montgomery', color: '#00E5A0' }),
      neighborhoods: [], fireIncidents: [], hasLiveData: false, loading: false,
      aiContext: '', stats: {}, refreshLiveHappening: () => {},
      sharedMapRef: { current: null },
    }
  }
  return ctx
}