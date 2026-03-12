/**
 * WatchPage.jsx — Guardian Live Tracking
 * Accessible at /watch?from=...&to=...&lat=...&lng=...&start=...&eta=...
 *
 * No login. No app required. Guardian opens the link on any device.
 * Shows: location at time of link generation, journey info, status, alert button.
 */
 
import { useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import mapboxgl from "mapbox-gl"
import { useRef } from "react"
import {
  MapPin, Clock, Navigation, Shield, AlertTriangle,
  CheckCircle, Phone, RefreshCw
} from "lucide-react"
 
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
 
function formatElapsed(isoStart) {
  if (!isoStart) return "Unknown"
  const diff = Date.now() - new Date(isoStart).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return "Just started"
  if (mins < 60) return `${mins} min ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}
 
function parseEtaMins(etaStr) {
  if (!etaStr || etaStr === "Unknown") return null
  const m = etaStr.match(/(\d+)\s*min/)
  if (m) return parseInt(m[1])
  const h = etaStr.match(/(\d+)h\s*(\d+)m/)
  if (h) return parseInt(h[1]) * 60 + parseInt(h[2])
  return null
}
 
export default function WatchPage() {
  const [params]     = useSearchParams()
  const mapRef       = useRef(null)
  const mapContainer = useRef(null)
  const markerRef    = useRef(null)
  const [alerted,    setAlerted]    = useState(false)
  const [elapsed,    setElapsed]    = useState("")
  const [status,     setStatus]     = useState("active") // active | overdue | arrived
 
  const from   = params.get("from")    || "Origin"
  const to     = params.get("to")      || "Destination"
  const lat    = parseFloat(params.get("lat") || "32.3668")
  const lng    = parseFloat(params.get("lng") || "-86.3006")
  const start  = params.get("start")   || null
  const eta    = params.get("eta")     || "Unknown"
  const phone  = params.get("phone")   || ""
 
  const etaMins = parseEtaMins(eta)
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`
 
  // Update elapsed and status every 30s
  useEffect(() => {
    const update = () => {
      setElapsed(formatElapsed(start))
      if (start && etaMins) {
        const diffMins = (Date.now() - new Date(start).getTime()) / 60000
        if (diffMins > etaMins + 5) setStatus("overdue")
        else if (diffMins > etaMins - 1) setStatus("near")
      }
    }
    update()
    const iv = setInterval(update, 30000)
    return () => clearInterval(iv)
  }, [start, etaMins])
 
  // Init map
  useEffect(() => {
    if (!mapContainer.current) return
    if (TOKEN) mapboxgl.accessToken = TOKEN
 
    mapRef.current = new mapboxgl.Map({
      container:          mapContainer.current,
      style:              "mapbox://styles/mapbox/dark-v11",
      center:             [lng, lat],
      zoom:               14,
      attributionControl: false,
    })
 
    mapRef.current.on("load", () => {
      // Pulsing marker
      const el = document.createElement("div")
      el.style.cssText = `
        width:20px;height:20px;border-radius:50%;
        background:rgba(0,229,160,0.9);
        border:2px solid #00E5A0;
        box-shadow:0 0 0 0 rgba(0,229,160,0.4);
        animation:pulseMarker 2s infinite;
      `
      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(mapRef.current)
    })
 
    return () => { try { mapRef.current?.remove() } catch {} }
  }, [lat, lng])
 
  const handleAlert = () => {
    setAlerted(true)
    if (phone) {
      const msg = encodeURIComponent(`Are you okay? I'm watching your SafeRoute journey and something seems wrong. Please let me know you're safe.`)
      window.open(`https://wa.me/${phone.replace(/\D/g,"")}?text=${msg}`, "_blank", "noopener")
    }
  }
 
  const statusConfig = {
    active:  { color: "text-mint",  bg: "bg-mint/10",  border: "border-mint/30",  label: "Journey in Progress",  icon: Shield     },
    near:    { color: "text-amber", bg: "bg-amber/10", border: "border-amber/30", label: "Approaching Arrival",  icon: Navigation },
    overdue: { color: "text-coral", bg: "bg-coral/10", border: "border-coral/30", label: "Journey Overdue",      icon: AlertTriangle },
  }
  const sc = statusConfig[status]
 
  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden" style={{ fontFamily: "'Lato', sans-serif" }}>
      <style>{`
        @keyframes pulseMarker {
          0%   { box-shadow: 0 0 0 0 rgba(0,229,160,0.4) }
          70%  { box-shadow: 0 0 0 12px rgba(0,229,160,0) }
          100% { box-shadow: 0 0 0 0 rgba(0,229,160,0) }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #05070F; color: #F5F0E8; }
      `}</style>
 
      {/* Header */}
      <header style={{ background: "rgba(12,16,32,0.95)", borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,229,160,0.15)", border: "1px solid rgba(0,229,160,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Shield size={16} color="#00E5A0" />
          </div>
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#F5F0E8", letterSpacing: "0.05em" }}>SafeRoute AI+ · Guardian View</div>
            <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(245,240,232,0.4)", letterSpacing: "0.1em" }}>LIVE TRACKING LINK</div>
          </div>
        </div>
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: "monospace", fontSize: 11, color: "#38BDF8", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={12} /> Open in Maps
        </a>
      </header>
 
      {/* Map */}
      <div ref={mapContainer} style={{ flex: "1 1 0", minHeight: 0 }} />
 
      {/* Info panel */}
      <div style={{ background: "rgba(12,16,32,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)", padding: "16px 20px", flexShrink: 0 }}>
 
        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, padding: "8px 12px", borderRadius: 10, background: status === "overdue" ? "rgba(255,107,74,0.1)" : "rgba(0,229,160,0.08)", border: `1px solid ${status === "overdue" ? "rgba(255,107,74,0.3)" : "rgba(0,229,160,0.25)"}` }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: status === "overdue" ? "#FF6B4A" : "#00E5A0", animation: "pulseMarker 2s infinite" }} />
          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: status === "overdue" ? "#FF6B4A" : "#00E5A0", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {sc.label}
          </span>
          <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: 10, color: "rgba(245,240,232,0.4)" }}>
            Started {elapsed}
          </span>
        </div>
 
        {/* Route info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(245,240,232,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>From</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#F5F0E8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{from}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(245,240,232,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>To</div>
            <div style={{ fontFamily: "sans-serif", fontSize: 13, color: "#F5F0E8", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{to}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(245,240,232,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>ETA</div>
            <div style={{ fontFamily: "monospace", fontSize: 13, color: "#FBBF24" }}>{eta}</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(245,240,232,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Location</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#38BDF8" }}>{lat.toFixed(4)}, {lng.toFixed(4)}</div>
          </div>
        </div>
 
        {/* Alert button */}
        {!alerted ? (
          <button onClick={handleAlert}
            style={{ width: "100%", padding: "14px", borderRadius: 12, background: status === "overdue" ? "rgba(255,107,74,0.15)" : "rgba(251,191,36,0.12)", border: `1px solid ${status === "overdue" ? "rgba(255,107,74,0.4)" : "rgba(251,191,36,0.3)"}`, color: status === "overdue" ? "#FF6B4A" : "#FBBF24", fontFamily: "monospace", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <AlertTriangle size={16} />
            Something Feels Wrong — Check On Them
          </button>
        ) : (
          <div style={{ width: "100%", padding: "14px", borderRadius: 12, background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.25)", color: "#00E5A0", fontFamily: "monospace", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <CheckCircle size={14} /> WhatsApp message sent — awaiting response
          </div>
        )}
 
        <p style={{ textAlign: "center", fontFamily: "monospace", fontSize: 9, color: "rgba(245,240,232,0.2)", marginTop: 10, lineHeight: 1.5 }}>
          Location captured when journey started · Real-time updates on production roadmap · SafeRoute AI+
        </p>
      </div>
    </div>
  )
}