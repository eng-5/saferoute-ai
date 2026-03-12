import { useState, useCallback } from "react"
 
// ── SPEED MULTIPLIERS ─────────────────────────────────────────
// When Mapbox returns a walking-profile route, multiply duration by these
// factors to get a realistic estimate for the actual transport mode.
// walking:  × 1.0  (Mapbox walking = walking, correct)
// running:  × 0.45 (running ≈ 2.2× faster than walking)
// cycling:  × 0.28 (cycling ≈ 3.5× faster than walking)
// driving:  uses driving-traffic profile directly — no adjustment needed
const DURATION_MULTIPLIER = {
  walking: 1.00,
  running: 0.45,
  cycling: 0.28,
  driving: 1.00,
}
 
// Mapbox profile to use for each mode
const MAPBOX_PROFILE = {
  walking: "walking",
  running: "walking",   // Mapbox has no "running" profile; we scale manually
  cycling: "cycling",
  driving: "driving-traffic",
}
 
// ── RISK SCORING ──────────────────────────────────────────────
function scoreRouteRisk(routeCoords, incidents) {
  if (!incidents?.length || !routeCoords?.length) return 25
  const CORRIDOR = 0.008
  let hits = 0
  for (const inc of incidents) {
    if (!inc.lat || !inc.lng) continue
    for (const [lng, lat] of routeCoords) {
      if (Math.hypot(lat - inc.lat, lng - inc.lng) < CORRIDOR) { hits++; break }
    }
  }
  return Math.min(25 + hits * 8, 95)
}
 
function honestConfidence(riskScore) {
  return Math.max(1, Math.round(100 - riskScore))
}
 
function riskLevel(score) {
  if (score >= 65) return "high"
  if (score >= 40) return "medium"
  return "low"
}
 
function formatDuration(seconds) {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
 
function formatDistance(meters) {
  const miles = meters / 1609.34
  return miles < 0.1 ? `${Math.round(meters)}m` : `${miles.toFixed(1)} mi`
}
 
function sampleCoords(coords, every = 3) {
  return coords.filter((_, i) => i % every === 0)
}
 
function countIncidentsNear(sampled, incidents) {
  return incidents.filter(inc => {
    if (!inc.lat || !inc.lng) return false
    for (const [lng, lat] of sampled) {
      if (Math.hypot(lat - inc.lat, lng - inc.lng) < 0.008) return true
    }
    return false
  }).length
}
 
// ── PERSONAL SAFETY FEELINGS ──────────────────────────────────
// Reads the route feeling log saved by ArrivalPage after each journey.
// Returns the extra risk penalty for a given route ID.
function getPersonalRiskPenalty(routeId) {
  try {
    const log = JSON.parse(localStorage.getItem("saferoute_route_feelings") || "[]")
    const entries = log.filter(e => e.routeId === routeId)
    const unsafe  = entries.filter(e => e.feeling === "unsafe").length
    const uneasy  = entries.filter(e => e.feeling === "uneasy").length
    return unsafe * 18 + uneasy * 8
  } catch { return 0 }
}
 
function getPersonalFeelingLabel(routeId) {
  try {
    const log     = JSON.parse(localStorage.getItem("saferoute_route_feelings") || "[]")
    const entries = log.filter(e => e.routeId === routeId)
    if (!entries.length) return null
    const worst = entries.find(e => e.feeling === "unsafe") || entries.find(e => e.feeling === "uneasy")
    return worst?.feeling || null
  } catch { return null }
}
 
// ── CONTEXT-AWARE RISK MULTIPLIERS ────────────────────────────
// Client-side only — no API calls needed for time/weather context.
function getContextMultipliers() {
  const hour   = new Date().getHours()
  const chips  = []
  let   mult   = 1.0
 
  if (hour >= 22 || hour < 6)        { mult *= 1.3; chips.push({ label: "Night Risk",    icon: "🌙", color: "text-amber2" }) }
  else if (hour >= 20 || hour < 7)   { mult *= 1.15; chips.push({ label: "Late Evening", icon: "🌆", color: "text-amber"  }) }
 
  return { mult, chips }
}
 
// Async: fetch weather context (Open-Meteo — free, no key)
async function fetchWeatherContext() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=32.37&longitude=-86.30&current=rain,visibility,weather_code"
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    const d   = await res.json()
    const rain       = d.current?.rain || 0
    const visibility = d.current?.visibility ?? 10000
    const chips      = []
    let   mult       = 1.0
    if (rain > 0)             { mult *= 1.2; chips.push({ label: "Rain Risk",   icon: "🌧", color: "text-sky"   }) }
    if (visibility < 3000)    { mult *= 1.15; chips.push({ label: "Low Visibility", icon: "🌫", color: "text-sky" }) }
    return { mult, chips }
  } catch {
    return { mult: 1.0, chips: [] }
  }
}
 
 
// For pedestrian/cycling modes, a SINGLE call with alternatives=true gives
// Mapbox's genuinely different route options. Much more reliable than
// calling the same profile 3× with slightly different params.
async function fetchWithAlternatives(oLng, oLat, dLng, dLat, profile, token) {
  const coords = `${oLng},${oLat};${dLng},${dLat}`
  const url = [
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}`,
    `?alternatives=true`,
    `&geometries=geojson`,
    `&overview=full`,
    `&steps=true`,
    `&exclude=ferry`,
    `&access_token=${token}`,
  ].join("")
  const res  = await fetch(url)
  const data = await res.json()
  return data.routes || []
}
 
// For driving we use driving-traffic with alternatives=true so ALL three route
// cards show driving ETAs. The old version fetched a walking route as the
// "safe" option — it would appear as Safest Route with a 45-min walking ETA
// while the other two showed 8-min driving ETAs. Completely wrong.
async function fetchDrivingRoutes(oLng, oLat, dLng, dLat, token) {
  const coords = `${oLng},${oLat};${dLng},${dLat}`
  const base   = `https://api.mapbox.com/directions/v5/mapbox`
 
  // Primary: driving-traffic with alternatives gives up to 3 real driving routes
  const primary = await fetch(
    `${base}/driving-traffic/${coords}?alternatives=true&geometries=geojson&overview=full&steps=true&access_token=${token}`
  ).then(r => r.json())
 
  const routes = primary.routes || []
 
  // Supplement with no-traffic driving if Mapbox returned fewer than 3 options
  // (common on short/simple trips with only one road path)
  if (routes.length < 3) {
    const fallback = await fetch(
      `${base}/driving/${coords}?alternatives=false&geometries=geojson&overview=full&steps=true&access_token=${token}`
    ).then(r => r.json())
    if (fallback.routes?.[0]) routes.push(fallback.routes[0])
  }
 
  return routes.filter(Boolean)
}
 
/**
 * useRouteCalculation
 * Call: calculate(originCoords, destCoords, incidents, transportMode)
 * transportMode: "walking" | "running" | "cycling" | "driving"
 */
export function useRouteCalculation() {
  const [routes,  setRoutes]  = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
 
  const token = import.meta.env.VITE_MAPBOX_TOKEN
 
  const calculate = useCallback(async (originCoords, destCoords, incidents = [], transportMode = "walking") => {
    if (!originCoords || !destCoords) return
 
    if (!token) {
      setRoutes(getMockRoutes(originCoords, destCoords, incidents, transportMode))
      return
    }
 
    setLoading(true)
    setError(null)
 
    const [oLng, oLat] = originCoords
    const [dLng, dLat] = destCoords
    const durationMult = DURATION_MULTIPLIER[transportMode] ?? 1.0
 
    try {
      let rawRoutes = []
 
      if (transportMode === "driving") {
        // Three genuinely different profiles for driving
        const [safe, live, fast] = await fetchDrivingRoutes(oLng, oLat, dLng, dLat, token)
        rawRoutes = [safe, live, fast].filter(Boolean)
      } else {
        // Single call with alternatives=true → Mapbox returns up to 3 real alternatives
        const profile = MAPBOX_PROFILE[transportMode]
        rawRoutes = await fetchWithAlternatives(oLng, oLat, dLng, dLat, profile, token)
      }
 
      if (!rawRoutes.length) throw new Error("No routes returned from Mapbox")
 
      // Fetch context multipliers (time is sync, weather is async but fast)
      const { mult: timeMult, chips: timeChips } = getContextMultipliers()
      const { mult: wxMult,   chips: wxChips   } = await fetchWeatherContext()
      const contextMult  = timeMult * wxMult
      const contextChips = [...timeChips, ...wxChips]
 
      // Score all routes and sort by riskScore ascending (safest first)
      const scored = rawRoutes.map(raw => {
        const coords      = raw.geometry.coordinates
        const sampled     = sampleCoords(coords)
        const baseRisk    = scoreRouteRisk(sampled, incidents)
        const adjDuration = raw.duration * durationMult
        return { raw, coords, sampled, baseRisk, adjDuration }
      })
      scored.sort((a, b) => a.baseRisk - b.baseRisk)
 
      const META = [
        { id: "safest",   name: "Safest Route",   color: "#00E5A0", dashArray: null  },
        { id: "balanced", name: "Balanced Route",  color: "#FBBF24", dashArray: [8,3] },
        { id: "fastest",  name: "Fastest Route",   color: "#FF6B4A", dashArray: [2,4] },
      ]
 
      const built = scored.slice(0, 3).map((s, i) => {
        const m = META[i]
        // Apply context multipliers + personal safety penalty
        const personalPenalty = getPersonalRiskPenalty(m.id)
        const personalLabel   = getPersonalFeelingLabel(m.id)
        const rawRisk = Math.min(s.baseRisk * contextMult + personalPenalty, 99)
        const riskScore = Math.round(rawRisk)
 
        const chips = [...contextChips]
        if (personalLabel === "unsafe")  chips.push({ label: "You rated unsafe",  icon: "🧠", color: "text-coral"  })
        else if (personalLabel === "uneasy") chips.push({ label: "You felt uneasy", icon: "🧠", color: "text-amber"  })
 
        return {
          id:           m.id,
          name:         m.name,
          color:        m.color,
          dashArray:    m.dashArray,
          geometry:     s.raw.geometry,
          duration:     formatDuration(s.adjDuration),
          durationSecs: s.adjDuration,
          distance:     formatDistance(s.raw.distance),
          distanceM:    s.raw.distance,
          riskScore,
          riskLevel:    riskLevel(riskScore),
          confidence:   honestConfidence(riskScore),
          incidentsNear: countIncidentsNear(s.sampled, incidents),
          steps:        s.raw.legs?.[0]?.steps?.slice(0, 5).map(st => st.maneuver?.instruction).filter(Boolean) || [],
          recommended:  i === 0,
          transportMode,
          contextChips: chips,
        }
      })
 
      // Pad to 3 routes if Mapbox returned fewer alternatives
      // (e.g. short trips where only 1 path exists — show same route with different labels)
      while (built.length < 3) {
        const base = { ...built[0] }
        const idx  = built.length
        const m    = META[idx]
        built.push({ ...base, id: m.id, name: m.name, color: m.color, dashArray: m.dashArray, recommended: false })
      }
 
      setRoutes(built)
    } catch (err) {
      console.error("Route calculation failed:", err)
      setError("Could not calculate routes — showing estimates")
      setRoutes(getMockRoutes(originCoords, destCoords, incidents, transportMode))
    } finally {
      setLoading(false)
    }
  }, [token])
 
  const clear = useCallback(() => {
    setRoutes([])
    setError(null)
  }, [])
 
  return { routes, loading, error, calculate, clear }
}
 
// ── MOCK ROUTES ───────────────────────────────────────────────
function getMockRoutes(origin, dest, incidents, transportMode = "walking") {
  const [oLng, oLat] = origin
  const [dLng, dLat] = dest
  const midLng = (oLng + dLng) / 2
  const midLat = (oLat + dLat) / 2
 
  const curved1 = { type: "LineString", coordinates: [origin, [midLng - 0.006, midLat + 0.005], dest] }
  const straight = { type: "LineString", coordinates: [origin, dest] }
  const curved2  = { type: "LineString", coordinates: [origin, [midLng + 0.005, midLat - 0.004], dest] }
 
  const distM = Math.hypot(dLat - oLat, dLng - oLng) * 111320
  const mult  = DURATION_MULTIPLIER[transportMode] ?? 1.0
 
  // Base walking seconds, then scaled by mode multiplier
  const walkSecs = distM / 1.3
 
  const rs1 = scoreRouteRisk(curved1.coordinates, incidents)
  const rs2 = scoreRouteRisk(straight.coordinates, incidents)
  const rs3 = scoreRouteRisk(curved2.coordinates, incidents)
 
  return [
    {
      id: "safest",   name: "Safest Route",   color: "#00E5A0", dashArray: null,
      geometry: curved1,
      duration: formatDuration(walkSecs * 1.25 * mult), durationSecs: walkSecs * 1.25 * mult,
      distance: formatDistance(distM * 1.25),            distanceM:    distM * 1.25,
      riskScore: rs1, riskLevel: riskLevel(rs1), confidence: honestConfidence(rs1),
      incidentsNear: countIncidentsNear(curved1.coordinates, incidents),
      steps: [], recommended: true, transportMode,
    },
    {
      id: "balanced", name: "Balanced Route", color: "#FBBF24", dashArray: [8, 3],
      geometry: straight,
      duration: formatDuration(walkSecs * 1.05 * mult), durationSecs: walkSecs * 1.05 * mult,
      distance: formatDistance(distM),                   distanceM:    distM,
      riskScore: rs2, riskLevel: riskLevel(rs2), confidence: honestConfidence(rs2),
      incidentsNear: countIncidentsNear(straight.coordinates, incidents),
      steps: [], recommended: false, transportMode,
    },
    {
      id: "fastest",  name: "Fastest Route",  color: "#FF6B4A", dashArray: [2, 4],
      geometry: curved2,
      duration: formatDuration(walkSecs * 0.85 * mult), durationSecs: walkSecs * 0.85 * mult,
      distance: formatDistance(distM * 0.9),             distanceM:    distM * 0.9,
      riskScore: rs3, riskLevel: riskLevel(rs3), confidence: honestConfidence(rs3),
      incidentsNear: countIncidentsNear(curved2.coordinates, incidents),
      steps: [], recommended: false, transportMode,
    },
  ]
}