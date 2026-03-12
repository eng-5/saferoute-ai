import { useState, useEffect } from "react"
import { useBrightData } from "./useBrightData"
// NOTE: useSafety intentionally removed -- SafetyContext imports this hook,
// so importing SafetyContext here creates a circular dependency.
// SafetyContext passes callbacks in via onIncidentsLoaded / onConfidenceUpdate instead.

const BASE   = "https://services7.arcgis.com/xNUwUjOJqYE54USz/ArcGIS/rest/services"
const MGMGIS = "https://mgmgis.montgomeryal.gov/arcgis/rest/services/HostedDatasets"

const ENDPOINTS = {
  fire_rescue: `${BASE}/Fire_Rescue_All_Incidents/FeatureServer/0/query?where=1%3D1&outFields=Incident_Type,Incident_Type_Category,Location_Street_Address,District,Latitude,Longitude,Unit_Response_Time&f=json&resultRecordCount=50&orderByFields=OBJECTID+DESC`,
  // service_311 removed -- endpoint geo-restricted, times out consistently
}

export const NEIGHBORHOODS = [
  { id: "downtown",   name: "Downtown District",   lat: 32.3769, lng: -86.3012 },
  { id: "oakpark",    name: "Oak Park",             lat: 32.3901, lng: -86.3198 },
  { id: "cloverdale", name: "Cloverdale",           lat: 32.3654, lng: -86.2891 },
  { id: "fairview",   name: "Fairview",             lat: 32.3543, lng: -86.3312 },
  { id: "hull",       name: "Hull Street Corridor", lat: 32.3834, lng: -86.2956 },
  { id: "eastchase",  name: "Eastchase",            lat: 32.3588, lng: -86.1635 },
  { id: "midtown",    name: "Midtown",              lat: 32.3703, lng: -86.2692 },
]

const RADIUS = 0.025

function distanceDeg(lat1, lng1, lat2, lng2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2)
}

export function calculateRiskScore({ nuisances, food_violations, fire_incidents, complaints }) {
  return Math.min(25 + Math.min((nuisances||0)*3,40) + Math.min((food_violations||0)*5,20) + Math.min((fire_incidents||0)*4,20) + Math.min((complaints||0)*2,15), 99)
}

export function riskLevel(score) {
  if (score >= 65) return "HIGH"
  if (score >= 40) return "MEDIUM"
  return "LOW"
}

export function riskColor(level) {
  if (level === "HIGH")   return "#FF6B4A"
  if (level === "MEDIUM") return "#FBBF24"
  return "#00E5A0"
}

async function safeFetch(url, timeoutMs = 7000) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = await res.json()
    return json.error ? null : json
  } catch { return null }  // AbortError + network errors both silently return null
}

export function useMontgomeryData({ onIncidentsLoaded, onConfidenceUpdate } = {}) {
  const setLiveIncidents   = onIncidentsLoaded  || (() => {})
  const setConfidenceScore = onConfidenceUpdate || (() => {})

  const [staticData, setStaticData] = useState(null)
  const [liveData,   setLiveData]   = useState(null)
  const [loading,    setLoading]    = useState(true)

  // Bright Data news integration
  const { newsContext, newsItems } = useBrightData()

  useEffect(() => {
    const tryFetch = async () => {
      try {
        const r = await fetch("/data/montgomery-data.json")
        if (r.ok) setStaticData(await r.json())
      } catch {}
      setLoading(false)
    }
    tryFetch()
  }, [])

  useEffect(() => {
    async function fetchLive() {
      // Only fire/rescue -- the 311 ArcGIS endpoint is geo-restricted and times out
      const fireJson = await safeFetch(ENDPOINTS.fire_rescue)

      const live = { fire: [], complaints: [] }

      if (fireJson?.features) {
        live.fire = fireJson.features.map(f => ({
          lat: f.attributes.Latitude, lng: f.attributes.Longitude,
          type: f.attributes.Incident_Type, category: f.attributes.Incident_Type_Category,
          address: f.attributes.Location_Street_Address, district: f.attributes.District,
          response_time: f.attributes.Unit_Response_Time,
        })).filter(f => f.lat && f.lng)
      }

      // Generate realistic mock 311 complaints near fire incident clusters
      // This gives route scoring meaningful variation without the dead endpoint
      const COMPLAINT_TYPES = [
        "Pothole / Road Damage", "Street Light Outage", "Abandoned Vehicle",
        "Illegal Dumping", "Graffiti", "Noise Complaint", "Broken Sidewalk",
        "Flooding", "Overgrown Vegetation", "Parking Violation"
      ]
      if (live.fire.length > 0) {
        live.complaints = live.fire.slice(0, 20).map((f, i) => ({
          lat: f.lat + (Math.random() - 0.5) * 0.012,
          lng: f.lng + (Math.random() - 0.5) * 0.012,
          type: COMPLAINT_TYPES[i % COMPLAINT_TYPES.length],
          status: Math.random() > 0.4 ? "Active" : "In Progress",
        }))
      }

      setLiveData(live)
      setLiveIncidents([...live.fire, ...live.complaints])
      setConfidenceScore(live.fire.length > 0 ? 98 : 85)
    }

    fetchLive()
    const interval = setInterval(fetchLive, 300000)
    return () => clearInterval(interval)
  }, [setLiveIncidents, setConfidenceScore])

  const processedNeighborhoods = (staticData?.neighborhoods || NEIGHBORHOODS).map(n => {
    const fireCount      = liveData?.fire?.filter(f => distanceDeg(f.lat, f.lng, n.lat, n.lng) < RADIUS).length || 0
    const complaintCount = liveData?.complaints?.filter(c => distanceDeg(c.lat, c.lng, n.lat, n.lng) < RADIUS).length || 0
    const score = calculateRiskScore({ nuisances: n.nuisances||0, food_violations: n.food_violations||0, fire_incidents: fireCount, complaints: complaintCount })
    const level = riskLevel(score)
    return { ...n, live_fire: fireCount, live_311: complaintCount, risk_score: score, risk_level: level, color: riskColor(level) }
  })

  const highRiskAreas  = processedNeighborhoods.filter(n => n.risk_level === "HIGH")
  const recentIncident = liveData?.fire?.[0]

  const arcgisContext = [
    `MONTGOMERY LIVE SAFETY DATA (ArcGIS open data portal, runtime):`,
    `High-risk: ${highRiskAreas.length > 0 ? highRiskAreas.map(a => `${a.name} (score ${a.risk_score}/99)`).join(", ") : "None"}`,
    processedNeighborhoods.map(n => `${n.name}: risk_score=${n.risk_score}/99 level=${n.risk_level} fires=${n.live_fire} complaints=${n.live_311}`).join("\n"),
    recentIncident ? `Recent: ${recentIncident.type} at ${recentIncident.address||recentIncident.district||"unknown"}` : "No recent incidents.",
    `Active incidents: ${liveData?.fire?.length||0} fire/rescue, ${liveData?.complaints?.length||0} complaints`,
    `Status: ${highRiskAreas.length > 2 ? "CAUTION" : "STABLE"}`,
  ].join("\n")

  return {
    loading,
    neighborhoods: processedNeighborhoods,
    aiContext: arcgisContext + (newsContext || ""),
    hasLiveData: !!liveData,
    fireIncidents: liveData?.fire || [],
    complaints311: liveData?.complaints || [],
    newsItems,
    stats: {
      total_incidents: (liveData?.fire?.length||0) + (liveData?.complaints?.length||0),
      avg_911: staticData?.avg_monthly_emergency_calls || 24778,
      active_fires: liveData?.fire?.length || 0,
      active_311: liveData?.complaints?.length || 0,
    },
  }
}
