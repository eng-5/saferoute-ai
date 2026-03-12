import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { cn } from "@/lib/utils"
 
const MONTGOMERY = { lng: -86.3077, lat: 32.3792 }
 
// ── FALLBACK DATA ──────────────────────────────────────────────
const RISK_ZONES_FALLBACK = [
  { id: "downtown",   name: "Downtown District",   level: "HIGH",   color: "#FF6B4A", coordinates: [-86.3012, 32.3769], radius: 500, confidence: 91 },
  { id: "oakpark",    name: "Oak Park",             level: "MEDIUM", color: "#FBBF24", coordinates: [-86.3198, 32.3901], radius: 450, confidence: 87 },
  { id: "cloverdale", name: "Cloverdale",           level: "LOW",    color: "#00E5A0", coordinates: [-86.2891, 32.3654], radius: 400, confidence: 94 },
  { id: "fairview",   name: "Fairview",             level: "MEDIUM", color: "#FBBF24", coordinates: [-86.3312, 32.3543], radius: 420, confidence: 82 },
  { id: "hull",       name: "Hull Street Corridor", level: "HIGH",   color: "#FF6B4A", coordinates: [-86.2956, 32.3834], radius: 350, confidence: 89 },
]
 
const INCIDENTS_FALLBACK = [
  { coordinates: [-86.2998, 32.3756], color: "#FF6B4A", level: "HIGH",    label: "Structure Fire",      category: "Active Response",     weight: 1.0 },
  { coordinates: [-86.3187, 32.3889], color: "#FBBF24", level: "MEDICAL", label: "Emergency Medical",   category: "EMS Response",        weight: 0.6 },
  { coordinates: [-86.2876, 32.3645], color: "#00E5A0", level: "LOW",     label: "Fire Alarm",          category: "Alarm Investigation", weight: 0.2 },
  { coordinates: [-86.3301, 32.3534], color: "#FBBF24", level: "MEDICAL", label: "Vehicle Accident",    category: "MVA with Injuries",   weight: 0.55 },
  { coordinates: [-86.2956, 32.3834], color: "#FF6B4A", level: "HIGH",    label: "Hazardous Materials", category: "Hull Street Area",    weight: 0.9 },
]
 
// ── HELPERS ────────────────────────────────────────────────────
function riskColor(level) {
  if (level === "HIGH")   return "#FF6B4A"
  if (level === "MEDIUM") return "#FBBF24"
  return "#00E5A0"
}
 
const MAP_STYLES = [
  { id: "dark",       label: "Dark",      icon: "🌑", style: "mapbox://styles/mapbox/dark-v11",               pitch: 25 },
  { id: "satellite",  label: "Satellite", icon: "🛰",  style: "mapbox://styles/mapbox/satellite-streets-v12", pitch: 45 },
  { id: "streets",    label: "Streets",   icon: "🗺",  style: "mapbox://styles/mapbox/streets-v12",            pitch: 0  },
  { id: "navigation", label: "3D Nav",    icon: "📍", style: "mapbox://styles/mapbox/navigation-night-v1",    pitch: 60 },
]
 
// ── DRAG HOOK ─────────────────────────────────────────────────
function useDraggable(containerRef, toggleRef, initialOffset = { x: -12, y: -180 }) {
  const [pos, setPos]       = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart   = useRef(null)
  const posStart    = useRef(null)
  const hasMoved    = useRef(false)
  const initialized = useRef(false)
 
  useEffect(() => {
    if (initialized.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setPos({ x: rect.right + initialOffset.x, y: rect.bottom + initialOffset.y })
    initialized.current = true
  }, [containerRef.current])
 
  const clamp = useCallback((rawX, rawY) => {
    if (!containerRef.current || !toggleRef.current) return { x: rawX, y: rawY }
    const map    = containerRef.current.getBoundingClientRect()
    const toggle = toggleRef.current.getBoundingClientRect()
    const hw = toggle.width  / 2
    const hh = toggle.height / 2
    const MARGIN = 10
    return {
      x: Math.max(map.left  + hw + MARGIN, Math.min(map.right  - hw - MARGIN, rawX)),
      y: Math.max(map.top   + hh + MARGIN, Math.min(map.bottom - hh - MARGIN, rawY)),
    }
  }, [])
 
  const onMouseDown = useCallback((e) => {
    if (e.target.closest("button")) return
    e.preventDefault()
    setDragging(true)
    hasMoved.current  = false
    dragStart.current = { x: e.clientX,         y: e.clientY }
    posStart.current  = { ...pos }
  }, [pos])
 
  const onTouchStart = useCallback((e) => {
    if (e.target.closest("button")) return
    setDragging(true)
    hasMoved.current  = false
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    posStart.current  = { ...pos }
  }, [pos])
 
  useEffect(() => {
    if (!dragging) return
    const move = (cx, cy) => {
      const dx = cx - dragStart.current.x
      const dy = cy - dragStart.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true
      setPos(clamp(posStart.current.x + dx, posStart.current.y + dy))
    }
    const onMouseMove = (e) => move(e.clientX, e.clientY)
    const onTouchMove = (e) => move(e.touches[0].clientX, e.touches[0].clientY)
    const stop = () => setDragging(false)
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup",   stop)
    window.addEventListener("touchmove", onTouchMove, { passive: true })
    window.addEventListener("touchend",  stop)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup",   stop)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend",  stop)
    }
  }, [dragging, clamp])
 
  useEffect(() => {
    const onResize = () => setPos(p => clamp(p.x, p.y))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [clamp])
 
  return { pos, dragging, hasMoved, onMouseDown, onTouchStart }
}
 
// ── MAP STYLE TOGGLE ──────────────────────────────────────────
function MapStyleToggle({ activeStyle, is3D, onStyleChange, on3DToggle, containerRef }) {
  const toggleRef  = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
 
  const { pos, dragging, hasMoved, onMouseDown, onTouchStart } =
    useDraggable(containerRef, toggleRef)
 
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener("resize", h)
    return () => window.removeEventListener("resize", h)
  }, [])
 
  const safe = (fn) => () => {
    if (hasMoved.current) { hasMoved.current = false; return }
    fn()
  }
 
  const glass = {
    background:     "rgba(12,16,32,0.92)",
    backdropFilter: "blur(24px)",
    border:         "1px solid rgba(251,146,60,0.18)",
    borderRadius:   12,
  }
 
  const iconBtn = (active) => ({
    width: 36, height: 36, borderRadius: 8,
    border: "none", cursor: "pointer", fontSize: 16,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "all 0.15s",
    background: active ? "rgba(0,229,160,0.15)" : "transparent",
    boxShadow: active ? "0 0 0 1.5px #00E5A0, 0 0 10px rgba(0,229,160,0.3)" : "none",
  })
 
  const labelBtn = (active) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 10px", borderRadius: 8, border: "none",
    cursor: "pointer", transition: "all 0.15s",
    background: active ? "rgba(0,229,160,0.12)" : "transparent",
    borderLeft: active ? "2px solid #00E5A0"    : "2px solid transparent",
  })
 
  const labelText = (active) => ({
    fontFamily: "monospace", fontSize: 9,
    letterSpacing: "0.1em", fontWeight: 700,
    color: active ? "#00E5A0" : "rgba(245,240,232,0.4)",
  })
 
  const activeDot = (
    <span style={{
      marginLeft: "auto", width: 5, height: 5,
      borderRadius: "50%", background: "#00E5A0",
      boxShadow: "0 0 6px #00E5A0",
    }} />
  )
 
  const divider = (
    <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
  )
 
  return (
    <div
      ref={toggleRef}
      style={{
        position:   "fixed",
        left:       pos.x,
        top:        pos.y,
        zIndex:     9999,
        transform:  "translate(-50%, -50%)",
        cursor:     dragging ? "grabbing" : "grab",
        userSelect: "none",
        touchAction:"none",
        filter:     dragging
          ? "drop-shadow(0 8px 24px rgba(0,229,160,0.3))"
          : "drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
        transition: dragging ? "none" : "filter 0.2s",
      }}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4, opacity: dragging ? 1 : 0.3, transition: "opacity 0.2s" }}>
        <div style={{ width: 28, height: 3, borderRadius: 99, background: dragging ? "#00E5A0" : "rgba(245,240,232,0.5)", transition: "background 0.2s" }} />
      </div>
 
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {expanded && (
            <div style={{ ...glass, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 2, animation: "slideDown 0.2s ease-out", minWidth: 150 }}>
              <div style={{ fontFamily: "monospace", fontSize: 7, color: "rgba(245,240,232,0.3)", letterSpacing: "0.18em", padding: "2px 8px 6px", textAlign: "center" }}>
                MAP STYLE
              </div>
              {MAP_STYLES.map(s => (
                <button key={s.id} onClick={safe(() => { onStyleChange(s.id); setExpanded(false) })} style={{ ...labelBtn(activeStyle === s.id), padding: "8px 12px" }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{ ...labelText(activeStyle === s.id), fontSize: 10 }}>{s.label.toUpperCase()}</span>
                  {activeStyle === s.id && activeDot}
                </button>
              ))}
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />
              <button onClick={safe(() => { on3DToggle(); setExpanded(false) })} style={{ ...labelBtn(is3D), padding: "8px 12px" }}>
                <span style={{ fontSize: 16 }}>🏙</span>
                <span style={{ ...labelText(is3D), fontSize: 10 }}>{is3D ? "3D ON" : "3D BUILDINGS"}</span>
              </button>
            </div>
          )}
          <div style={{ ...glass, padding: "6px 8px", display: "flex", gap: 4, alignItems: "center" }}>
            {MAP_STYLES.map(s => (
              <button key={s.id} onClick={safe(() => onStyleChange(s.id))} title={s.label} style={iconBtn(activeStyle === s.id)}>
                {s.icon}
              </button>
            ))}
            {divider}
            <button onClick={safe(on3DToggle)} title="3D Buildings" style={iconBtn(is3D)}>🏙</button>
            {divider}
            <button
              onClick={safe(() => setExpanded(e => !e))}
              title={expanded ? "Collapse" : "Show labels"}
              style={{ width: 36, height: 36, borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "monospace", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", background: expanded ? "rgba(251,146,60,0.15)" : "transparent", color: expanded ? "#FB923C" : "rgba(245,240,232,0.4)", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
            >▲</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ ...glass, padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "rgba(245,240,232,0.3)", letterSpacing: "0.18em", padding: "4px 8px 6px", textAlign: "center" }}>
              MAP STYLE
            </div>
            {MAP_STYLES.map(s => (
              <button key={s.id} onClick={safe(() => onStyleChange(s.id))} style={labelBtn(activeStyle === s.id)}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span style={labelText(activeStyle === s.id)}>{s.label.toUpperCase()}</span>
                {activeStyle === s.id && activeDot}
              </button>
            ))}
          </div>
          <button onClick={safe(on3DToggle)} style={{ ...glass, border: is3D ? "1px solid rgba(0,229,160,0.4)" : "1px solid rgba(251,146,60,0.18)", background: is3D ? "rgba(0,229,160,0.15)" : "rgba(12,16,32,0.92)", padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s", width: "100%", boxShadow: is3D ? "0 0 16px rgba(0,229,160,0.2)" : "none" }}>
            <span style={{ fontSize: 14 }}>🏙</span>
            <span style={labelText(is3D)}>{is3D ? "3D ON" : "3D BUILDINGS"}</span>
          </button>
        </div>
      )}
    </div>
  )
}
 
// ── INCIDENT LABEL MAP ────────────────────────────────────────
const INCIDENT_LABELS = {
  "EMS":            "Emergency Medical",
  "FIRE":           "Structure Fire",
  "HAZMAT":         "Hazardous Materials",
  "RESCUE":         "Technical Rescue",
  "MVA":            "Vehicle Accident",
  "ALARM":          "Fire Alarm",
  "INVESTIGATION":  "Fire Investigation",
  "SERVICE CALL":   "Service Call",
  "MUTUAL AID":     "Mutual Aid Response",
  "BRUSH":          "Brush / Wildland Fire",
  "CARBON MONOXIDE":"Carbon Monoxide",
  "GAS LEAK":       "Gas Leak",
  "FLOODING":       "Flood / Water Emergency",
  "CARDIAC":        "Cardiac Emergency",
  "TRAUMA":         "Trauma Response",
  "OVERDOSE":       "Medical Overdose",
}
 
// ── MAIN MAP COMPONENT ────────────────────────────────────────
export function MapBackground({
  className,
  showHeatmap  = true,
  showGrid     = true,
  dimmed       = false,
  children,
  onZoneClick,
  onMapClick,
  mapControlRef,
  neighborhoods = [],
  fireIncidents = [],
}) {
  const mapContainer = useRef(null)
  const map          = useRef(null)
  const markers      = useRef([])
  const clickMarker  = useRef(null)   // separate ref — never cleared with incident markers
  const userMarkerRef = useRef(null)  // real GPS marker ref
  const geoWatchId    = useRef(null)  // navigator.geolocation watchId
  const [activeStyle, setActiveStyle] = useState(() => {
    try { return localStorage.getItem("saferoute_map_style") || "dark" } catch { return "dark" }
  })
  // Ref mirror of activeStyle — always in sync, safe to read inside map event closures
  // where React state would be stale (closures capture the value at time of attachment,
  // not at time of firing).
  const activeStyleRef = useRef(activeStyle)
  const [is3D, setIs3D] = useState(false)
 
  // ── Convert neighborhoods → risk zones ───────────────────────
  const riskZones = useMemo(() => {
    if (!neighborhoods?.length) return RISK_ZONES_FALLBACK
    return neighborhoods.map(n => ({
      id:          n.name.toLowerCase().replace(/[\s/]+/g, "-"),
      name:        n.name,
      level:       n.risk_level || "MEDIUM",
      color:       riskColor(n.risk_level),
      coordinates: [n.lng ?? n.lon ?? -86.3077, n.lat ?? 32.3792],
      radius:      Math.max(300, Math.min(600, 250 + n.risk_score * 3)),
      confidence:  Math.round(80 + (n.risk_score / 99) * 15),
      risk_score:  n.risk_score,
    }))
  }, [neighborhoods])
 
  // ── Convert fire incidents → incident markers ─────────────────
  const incidents = useMemo(() => {
    if (!fireIncidents?.length) return INCIDENTS_FALLBACK
 
    console.log("🔥 FireIncidents sample:", fireIncidents[0])
    console.log("🔥 Total:", fireIncidents.length, "| With GPS:", fireIncidents.filter(i => i.lat && i.lng).length)
 
    const withGPS = fireIncidents.filter(inc => inc.lat && inc.lng)
    if (!withGPS.length) {
      console.warn("⚠️ No fire incidents have lat/lng — check field mapping in useMontgomeryData.js")
      return INCIDENTS_FALLBACK
    }
 
    return withGPS.slice(0, 30).map(inc => {
      const rawType     = (inc.type     || "").toUpperCase().trim()
      const rawCategory = (inc.category || "").trim()
 
      const mappedLabel = Object.entries(INCIDENT_LABELS).find(([key]) =>
        rawType.includes(key)
      )?.[1]
 
      const label = mappedLabel
        ? mappedLabel
        : rawType && rawCategory && rawType !== rawCategory
          ? `${rawType} — ${rawCategory}`
          : rawType || rawCategory || "Fire/Rescue Incident"
 
      return {
        coordinates:  [inc.lng, inc.lat],
        color:        rawType.includes("EMS") || rawType.includes("CARDIAC") || rawType.includes("MEDICAL")
                        ? "#FBBF24" : "#FF6B4A",
        level:        rawType.includes("EMS") ? "MEDICAL" : "HIGH",
        label,
        category:     rawCategory,
        address:      inc.address       || "",
        district:     inc.district      || "",
        responseTime: inc.response_time || inc.Unit_Response_Time || null,
        weight:       rawType.includes("FIRE") ? 1.0
                    : rawType.includes("EMS")  ? 0.7
                    : 0.5,
      }
    })
  }, [fireIncidents])
 
  // ── Keep refs so map callbacks always see latest data ─────────
  const riskZonesRef = useRef(riskZones)
  const incidentsRef = useRef(incidents)
  useEffect(() => { riskZonesRef.current = riskZones }, [riskZones])
  useEffect(() => { incidentsRef.current = incidents }, [incidents])
 
  // ── INIT MAP ONCE ─────────────────────────────────────────────
  useEffect(() => {
    if (map.current || !mapContainer.current) return
 
    const token =
      import.meta.env?.VITE_MAPBOX_TOKEN ||
      process.env?.NEXT_PUBLIC_MAPBOX_TOKEN ||
      ""
 
    if (!token) {
      console.error("MapBackground: No Mapbox token. Add VITE_MAPBOX_TOKEN to .env")
      return
    }
 
    mapboxgl.accessToken = token
 
    const initStyleId = (() => {
      try { return localStorage.getItem("saferoute_map_style") || "dark" } catch { return "dark" }
    })()
    const initStyle = MAP_STYLES.find(s => s.id === initStyleId) || MAP_STYLES[0]
 
    map.current = new mapboxgl.Map({
      container:          mapContainer.current,
      style:              initStyle.style,
      center:             [MONTGOMERY.lng, MONTGOMERY.lat],
      zoom:               13,
      pitch:              initStyle.pitch,
      bearing:            -8,
      attributionControl: false,
    })
 
    map.current.on("load", () => {
      addDataLayers()
      addIncidentMarkers()
      addUserLocation()
      const t = setInterval(() => map.current?.resize(), 200)
      setTimeout(() => clearInterval(t), 2000)
    })
 
    // Map click → amber crosshair marker + callback
    map.current.on("click", (e) => {
      placeClickMarker(e.lngLat.lng, e.lngLat.lat)
      onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })
 
    // Expose flyTo + placeMarker + pulseZone + addCommunityMarker
    if (mapControlRef) {
      mapControlRef.current = {
        flyTo: (lat, lng, zoom = 15) =>
          map.current?.flyTo({ center: [lng, lat], zoom, duration: 1800, curve: 1.4, essential: true }),
        placeMarker: (lat, lng) =>
          placeClickMarker(lng, lat),
        pulseZone: (lat, lng) =>
          triggerZonePulse(lng, lat),
        addCommunityMarker: (report) =>
          addOneCommunityMarker(report),
        setRoutes: (routes, selectedId) =>
          drawRoutes(routes, selectedId),
        selectRoute: (selectedId) =>
          highlightRoute(selectedId),
        clearRoutes: () => {
          // Public cancel API — clears both the GL layers AND the persisted route
          // data so a subsequent style toggle doesn't ghost-redraw the cancelled route.
          // Internal removeAllRoutes() intentionally does NOT clear lastRoutesRef
          // (it's called mid-redraw-cycle and must not wipe its own save).
          removeAllRoutes()
          lastRoutesRef.current = { routes: null, selectedId: null }
        },
        fitRouteBounds: (geometry) =>
          fitToGeometry(geometry),
      }
    }
 
    map.current.on("idle", () => map.current?.resize())
    // NavigationControl (zoom buttons + compass) is redundant on touch devices —
    // users pinch-to-zoom natively. Only add it on desktop (md breakpoint = 768px).
    if (window.innerWidth >= 768) {
      map.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right")
    }
 
    const ro = new ResizeObserver(() => map.current?.resize())
    if (mapContainer.current) ro.observe(mapContainer.current)
 
    return () => {
      ro.disconnect()
      markers.current.forEach(m => m.remove())
      markers.current = []
      if (clickMarker.current) { clickMarker.current.remove(); clickMarker.current = null }
      if (geoWatchId.current) { navigator.geolocation.clearWatch(geoWatchId.current); geoWatchId.current = null }
      map.current?.remove()
      map.current = null
    }
  }, [])
 
  // ── UPDATE when real data arrives ─────────────────────────────
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return
    if (!neighborhoods?.length && !fireIncidents?.length) return
 
    const heatSrc = map.current.getSource("incidents-heatmap")
    if (heatSrc) {
      heatSrc.setData({
        type: "FeatureCollection",
        features: incidentsRef.current.map(inc => ({
          type: "Feature",
          geometry:   { type: "Point", coordinates: inc.coordinates },
          properties: { weight: inc.weight },
        })),
      })
    }
 
    riskZonesRef.current.forEach(zone => {
      const layerId = `zone-fill-${zone.id}`
      if (map.current.getLayer(layerId)) {
        map.current.setPaintProperty(layerId, "circle-color",        zone.color)
        map.current.setPaintProperty(layerId, "circle-stroke-color", zone.color)
        map.current.setPaintProperty(layerId, "circle-radius",       zone.radius / 10)
      }
    })
 
    markers.current.forEach(m => m.remove())
    markers.current = []
    addIncidentMarkers()
    addUserLocation()
  }, [neighborhoods, fireIncidents])
 
  // Tracks whether a setStyle() transition is currently in progress.
  // drawRoutes reads this to avoid registering a second once("style.load") listener
  // that would never fire (the event already fired for handleStyleChange's listener).
  const styleChangingRef = useRef(false)
 
  // ── STYLE CHANGE ──────────────────────────────────────────────
  function handleStyleChange(styleId) {
    if (!map.current || styleId === activeStyle) return
    const chosen = MAP_STYLES.find(s => s.id === styleId)
    if (!chosen) return
 
    // Update the ref FIRST — synchronously, before setStyle() triggers any async
    // callbacks. React state (activeStyle) updates asynchronously; any closure
    // captured by map.once() would see the stale old value if we only used state.
    activeStyleRef.current = styleId
    setActiveStyle(styleId)
    try { localStorage.setItem("saferoute_map_style", styleId) } catch {}
 
    // Signal to drawRoutes that a transition is in progress so it doesn't
    // register a second once("style.load") listener that would never fire.
    styleChangingRef.current = true
    map.current.setStyle(chosen.style)
 
    map.current.once("style.load", () => {
      styleChangingRef.current = false   // transition complete — drawRoutes may proceed normally
      map.current.easeTo({ pitch: is3D ? 60 : chosen.pitch, duration: 800 })
 
      // 1. Wipe stale DOM incident markers
      markers.current.forEach(m => m.remove())
      markers.current = []
 
      // 2. Re-add base GL layers: heatmap, risk zones, grid
      addDataLayers()
 
      // 3. Re-add incident DOM markers
      addIncidentMarkers()
 
      // 4. Re-add user location dot
      addUserLocation()
 
      // 5. Re-add community report GL layers
      if (communityReportsRef.current.length > 0) {
        initCommunityReportsLayer()
      }
 
      // 6. Re-paint route lines directly via _paintRouteLayers (not drawRoutes).
      //    drawRoutes would hit the isStyleLoaded() guard which returns false even
      //    inside style.load (it checks tiles, not just the style spec), queue a
      //    second once("style.load") that never fires, and bail out with no lines drawn.
      //    _paintRouteLayers skips that guard entirely — we know we're ready here.
      const { routes, selectedId } = lastRoutesRef.current
      if (routes?.length) {
        _paintRouteLayers(routes, selectedId)
      }
    })
  }
 
  // ── 3D TOGGLE ─────────────────────────────────────────────────
  function handle3DToggle() {
    if (!map.current) return
    const next = !is3D
    setIs3D(next)
    map.current.easeTo({
      pitch:    next ? 60 : MAP_STYLES.find(s => s.id === activeStyle)?.pitch || 0,
      bearing:  next ? -15 : -8,
      zoom:     next ? 14  : 13,
      duration: 1000,
    })
    if (next && !map.current.getLayer("3d-buildings")) {
      map.current.addLayer({
        id: "3d-buildings", source: "composite", "source-layer": "building",
        filter: ["==", "extrude", "true"], type: "fill-extrusion", minzoom: 12,
        paint: {
          "fill-extrusion-color":   ["interpolate",["linear"],["get","height"],0,"#0A0E1A",50,"#0C1020",100,"#101830"],
          "fill-extrusion-height":  ["get","height"],
          "fill-extrusion-base":    ["get","min_height"],
          "fill-extrusion-opacity": 0.75,
        },
      })
    } else if (!next && map.current.getLayer("3d-buildings")) {
      map.current.removeLayer("3d-buildings")
    }
  }
 
  // ── ADD DATA LAYERS ───────────────────────────────────────────
  function addDataLayers() {
    if (!map.current) return
    const zones = riskZonesRef.current
    const incs  = incidentsRef.current
 
    // Heatmap
    if (showHeatmap && !map.current.getSource("incidents-heatmap")) {
      map.current.addSource("incidents-heatmap", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: incs.map(inc => ({
            type: "Feature",
            geometry:   { type: "Point", coordinates: inc.coordinates },
            properties: { weight: inc.weight },
          })),
        },
      })
      map.current.addLayer({
        id: "heatmap-layer", type: "heatmap", source: "incidents-heatmap",
        paint: {
          "heatmap-weight": ["get","weight"], "heatmap-intensity": 1.2,
          "heatmap-radius": 55,
          // Reduce opacity on mobile (< 768px) so route lines read clearly over the heatmap.
          // On desktop keep full 0.5 opacity.
          "heatmap-opacity": window.innerWidth < 768 ? 0.28 : 0.5,
          "heatmap-color": ["interpolate",["linear"],["heatmap-density"],
            0,"rgba(0,229,160,0)", 0.2,"rgba(0,229,160,0.35)",
            0.45,"rgba(251,191,36,0.5)", 0.7,"rgba(255,107,74,0.6)",
            1,"rgba(255,107,74,0.85)"],
        },
      })
    }
 
    // Risk zone circles
    zones.forEach(zone => {
      if (map.current.getSource(`zone-${zone.id}`)) return
      map.current.addSource(`zone-${zone.id}`, {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Point", coordinates: zone.coordinates }, properties: zone },
      })
      map.current.addLayer({
        id: `zone-fill-${zone.id}`, type: "circle", source: `zone-${zone.id}`,
        paint: {
          "circle-radius":         zone.radius / 10,
          "circle-color":          zone.color,
          "circle-opacity":        0.07,
          "circle-stroke-color":   zone.color,
          "circle-stroke-width":   1.5,
          "circle-stroke-opacity": 0.3,
        },
      })
      map.current.on("click",      `zone-fill-${zone.id}`, () => onZoneClick?.(zone))
      map.current.on("mouseenter", `zone-fill-${zone.id}`, () => { map.current.getCanvas().style.cursor = "pointer" })
      map.current.on("mouseleave", `zone-fill-${zone.id}`, () => { map.current.getCanvas().style.cursor = "" })
    })
 
    // Hover tooltips after all zones registered
    setTimeout(() => addNeighborhoodTooltips(), 100)
    setTimeout(() => initCommunityReportsLayer(), 200)
  }
 
  // ── INCIDENT MARKERS ──────────────────────────────────────────
  function addIncidentMarkers() {
    const incs = incidentsRef.current
    incs.forEach(inc => {
      const el = document.createElement("div")
      el.style.cssText = `width:13px;height:13px;border-radius:50%;background:${inc.color};border:2px solid white;box-shadow:0 0 10px ${inc.color}90;cursor:pointer;position:relative;`
      const ping = document.createElement("div")
      ping.style.cssText = `position:absolute;inset:-4px;border-radius:50%;background:${inc.color};opacity:0.3;animation:saferoute-ping 1.8s ease-out infinite;`
      el.appendChild(ping)
 
      const popup = new mapboxgl.Popup({
        offset: 18, closeButton: false, closeOnClick: false, maxWidth: "240px"
      }).setHTML(`
        <div style="background:rgba(8,12,28,0.97);backdrop-filter:blur(24px);border:1px solid ${inc.color}35;border-radius:14px;padding:12px 16px;font-family:monospace;pointer-events:none;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <div style="width:6px;height:6px;border-radius:50%;background:${inc.color};box-shadow:0 0 6px ${inc.color};flex-shrink:0;"></div>
            <span style="font-size:8px;color:${inc.color};letter-spacing:0.18em;font-weight:700;">LIVE INCIDENT</span>
          ${inc.timestamp ? `<span style="margin-left:auto;font-size:8px;color:rgba(245,240,232,0.3);">${Math.round((Date.now()-inc.timestamp)/60000)||"<1"} min ago</span>` : ''}
          </div>
          <div style="font-size:12px;color:#F5F0E8;font-weight:700;margin-bottom:2px;">${inc.label}</div>
          ${inc.category && inc.category !== inc.label ? `<div style="font-size:10px;color:rgba(251,146,60,0.75);margin-bottom:6px;">${inc.category}</div>` : ""}
          ${inc.address ? `<div style="font-size:10px;color:rgba(245,240,232,0.45);margin-bottom:3px;">📍 ${inc.address}</div>` : ""}
          ${inc.district ? `<div style="font-size:10px;color:rgba(245,240,232,0.35);margin-bottom:8px;">District: ${inc.district}</div>` : "<div style='margin-bottom:8px;'></div>"}
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="background:${inc.color}18;color:${inc.color};border:1px solid ${inc.color}40;border-radius:99px;padding:2px 9px;font-size:9px;font-weight:700;letter-spacing:0.1em;">${inc.level}</span>
            ${inc.responseTime ? `<span style="font-size:9px;color:#00E5A0;">⏱ ${inc.responseTime}</span>` : ""}
          </div>
        </div>
      `)
 
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(inc.coordinates)
        .addTo(map.current)
 
      // Hover to show — much more modern than click-to-show
      el.addEventListener("mouseenter", () => popup.setLngLat(inc.coordinates).addTo(map.current))
      el.addEventListener("mouseleave", () => popup.remove())
      el.style.cursor = "pointer"
 
      markers.current.push(marker)
    })
  }
 
  // ── USER LOCATION (blue dot) ──────────────────────────────────
  function addUserLocation() {
    const el = document.createElement("div")
    el.style.cssText = `width:16px;height:16px;border-radius:50%;background:#38BDF8;border:3px solid white;box-shadow:0 0 18px #38BDF880;position:relative;cursor:pointer;`
    ;[1, 2].forEach(i => {
      const ring = document.createElement("div")
      ring.style.cssText = `position:absolute;inset:${-7 * i}px;border-radius:50%;border:1.5px solid #38BDF8;opacity:${0.4 / i};animation:saferoute-ripple 2s ease-out ${i * 0.5}s infinite;`
      el.appendChild(ring)
    })
 
    const zones   = riskZonesRef.current
    const nearest = zones.length ? zones.reduce((closest, z) => {
      const d1 = Math.hypot(z.coordinates[0] - MONTGOMERY.lng, z.coordinates[1] - MONTGOMERY.lat)
      const d2 = Math.hypot(closest.coordinates[0] - MONTGOMERY.lng, closest.coordinates[1] - MONTGOMERY.lat)
      return d1 < d2 ? z : closest
    }, zones[0]) : { name: "Downtown District", level: "LOW", color: "#00E5A0", risk_score: 25 }
 
    const timeStr   = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    const zoneColor = nearest.color || "#00E5A0"
 
    const popup = new mapboxgl.Popup({
      offset: 22, closeButton: false, closeOnClick: false, maxWidth: "240px"
    }).setHTML(`
      <div style="background:rgba(8,12,28,0.97);backdrop-filter:blur(24px);border:1px solid rgba(56,189,248,0.35);border-radius:14px;padding:12px 16px;font-family:monospace;pointer-events:none;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="width:7px;height:7px;border-radius:50%;background:#38BDF8;box-shadow:0 0 8px #38BDF8;flex-shrink:0;"></div>
          <span style="font-size:9px;color:#38BDF8;letter-spacing:0.18em;font-weight:700;">YOUR LOCATION</span>
          <span style="margin-left:auto;font-size:9px;color:rgba(245,240,232,0.35);">${timeStr}</span>
        </div>
        <div style="font-size:13px;color:#F5F0E8;font-weight:700;margin-bottom:2px;">Montgomery, Alabama</div>
        <div style="font-size:10px;color:rgba(245,240,232,0.4);margin-bottom:10px;">32.3792° N, 86.3077° W</div>
        <div style="height:1px;background:rgba(56,189,248,0.1);margin-bottom:10px;"></div>
        <div style="font-size:9px;color:rgba(245,240,232,0.35);letter-spacing:0.12em;margin-bottom:5px;">NEAREST SAFETY ZONE</div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span style="font-size:11px;color:#F5F0E8;font-weight:600;">${nearest.name}</span>
          <span style="background:${zoneColor}20;color:${zoneColor};border:1px solid ${zoneColor}40;border-radius:99px;padding:2px 8px;font-size:9px;font-weight:700;letter-spacing:0.1em;white-space:nowrap;">${nearest.level}</span>
        </div>
        <div style="margin-top:4px;font-size:10px;color:rgba(245,240,232,0.3);">Danger score: ${nearest.risk_score ?? "—"}/99</div>
      </div>
    `)
 
    userMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([MONTGOMERY.lng, MONTGOMERY.lat])
      .addTo(map.current)
 
    el.addEventListener("mouseenter", () => popup.setLngLat(
      userMarkerRef.current?.getLngLat() || [MONTGOMERY.lng, MONTGOMERY.lat]
    ).addTo(map.current))
    el.addEventListener("mouseleave", () => popup.remove())
 
    markers.current.push(userMarkerRef.current)
 
    // ── REAL GPS: watch position and move marker ──────────────
    if (navigator.geolocation) {
      geoWatchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          userMarkerRef.current?.setLngLat([lng, lat])
          // Update popup HTML with real coords when re-hovered
          popup.setHTML(`
            <div style="background:rgba(8,12,28,0.97);backdrop-filter:blur(24px);border:1px solid rgba(56,189,248,0.35);border-radius:14px;padding:12px 16px;font-family:monospace;pointer-events:none;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <div style="width:7px;height:7px;border-radius:50%;background:#38BDF8;box-shadow:0 0 8px #38BDF8;flex-shrink:0;"></div>
                <span style="font-size:9px;color:#38BDF8;letter-spacing:0.18em;font-weight:700;">YOUR LOCATION</span>
                <span style="margin-left:auto;font-size:9px;color:rgba(245,240,232,0.35);">${new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:true})}</span>
              </div>
              <div style="font-size:13px;color:#F5F0E8;font-weight:700;margin-bottom:2px;">Live GPS Position</div>
              <div style="font-size:10px;color:rgba(245,240,232,0.4);margin-bottom:10px;">${lat.toFixed(5)}° N, ${Math.abs(lng).toFixed(5)}° W · ±${Math.round(pos.coords.accuracy)}m</div>
              <div style="height:1px;background:rgba(56,189,248,0.1);margin-bottom:10px;"></div>
              <div style="font-size:9px;color:rgba(245,240,232,0.35);letter-spacing:0.12em;margin-bottom:5px;">NEAREST SAFETY ZONE</div>
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:11px;color:#F5F0E8;font-weight:600;">${nearest.name}</span>
                <span style="background:${nearest.color}20;color:${nearest.color};border:1px solid ${nearest.color}40;border-radius:99px;padding:2px 8px;font-size:9px;font-weight:700;letter-spacing:0.1em;white-space:nowrap;">${nearest.level}</span>
              </div>
              <div style="margin-top:4px;font-size:10px;color:rgba(245,240,232,0.3);">Danger score: ${nearest.risk_score ?? "—"}/99</div>
            </div>
          `)
        },
        () => {
          // Permission denied or unavailable — keep MONTGOMERY default, that's fine
          console.log("SafeRoute: GPS unavailable, using Montgomery center")
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      )
    }
  }
 
  // ── CLICK MARKER — amber crosshair + pulsing rings ────────────
  function placeClickMarker(lng, lat) {
    if (clickMarker.current) { clickMarker.current.remove(); clickMarker.current = null }
 
    const el = document.createElement("div")
    el.style.cssText = `position:relative;width:24px;height:24px;pointer-events:none;`
 
    // Pulsing ring 1
    const ring1 = document.createElement("div")
    ring1.style.cssText = `position:absolute;inset:-10px;border-radius:50%;border:1.5px solid #FB923C;opacity:0;animation:click-ripple 2s ease-out infinite;`
 
    // Pulsing ring 2 (offset)
    const ring2 = document.createElement("div")
    ring2.style.cssText = `position:absolute;inset:-6px;border-radius:50%;border:1.5px solid #FB923C;opacity:0;animation:click-ripple 2s ease-out 0.6s infinite;`
 
    // Inner amber dot
    const dot = document.createElement("div")
    dot.style.cssText = `position:absolute;inset:6px;border-radius:50%;background:#FB923C;box-shadow:0 0 12px #FB923C,0 0 4px rgba(255,255,255,0.6);`
 
    // Crosshair horizontal line
    const hLine = document.createElement("div")
    hLine.style.cssText = `position:absolute;top:50%;left:-8px;right:-8px;height:1px;background:#FB923C;opacity:0.6;transform:translateY(-50%);`
 
    // Crosshair vertical line
    const vLine = document.createElement("div")
    vLine.style.cssText = `position:absolute;left:50%;top:-8px;bottom:-8px;width:1px;background:#FB923C;opacity:0.6;transform:translateX(-50%);`
 
    el.appendChild(ring1)
    el.appendChild(ring2)
    el.appendChild(hLine)
    el.appendChild(vLine)
    el.appendChild(dot)
 
    clickMarker.current = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat([lng, lat])
      .addTo(map.current)
  }
 
  // ── NEIGHBORHOOD HOVER TOOLTIPS ───────────────────────────────
  // ── ROUTE DRAWING — real Mapbox GeoJSON road lines ──────────
  const routeIdsRef   = useRef([])
  const lastRoutesRef = useRef({ routes: null, selectedId: null })
 
  // _paintRouteLayers: pure GL work, no guard checks.
  // Called directly from the style.load callback so we never hit the
  // isStyleLoaded() guard which returns false even during style.load
  // (it checks tiles, not just style spec) — causing a dead second listener.
  function _paintRouteLayers(routes, selectedId) {
    if (!map.current || !routes?.length) return
 
    const isSatellite   = activeStyleRef.current === "satellite"
    const selWidth      = isSatellite ? 8  : 6
    const unselWidth    = isSatellite ? 5  : 4
    const casingWidth   = isSatellite ? 14 : 10
    const casingOpacity = isSatellite ? 0.6 : 0.25
    const casingColor   = isSatellite ? "#000000" : "#ffffff"
 
    routes.forEach(route => {
      const srcId      = `route-src-${route.id}`
      const layerId    = `route-layer-${route.id}`
      const isSelected = route.id === selectedId
      const opacity    = isSelected ? 1 : (isSatellite ? 0.55 : 0.35)
      const width      = isSelected ? selWidth : unselWidth
 
      if (!map.current.getSource(srcId)) {
        map.current.addSource(srcId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: route.geometry, properties: {} }
        })
      }
 
      if (!map.current.getLayer(layerId)) {
        if (isSelected || isSatellite) {
          map.current.addLayer({
            id: `${layerId}-casing`, type: 'line', source: srcId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color':   casingColor,
              'line-width':   isSelected ? casingWidth : casingWidth - 4,
              'line-opacity': isSelected ? casingOpacity : casingOpacity * 0.5,
            }
          })
          routeIdsRef.current.push(`${layerId}-casing`)
        }
 
        const paintProps = {
          'line-color':   route.color || '#FBBF24',
          'line-width':   width,
          'line-opacity': opacity,
        }
        if (route.dashArray && !isSelected && !isSatellite) {
          paintProps['line-dasharray'] = route.dashArray
        }
 
        map.current.addLayer({
          id: layerId, type: 'line', source: srcId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: paintProps,
        })
        routeIdsRef.current.push(layerId)
      }
    })
 
    routes.forEach(r => {
      if (r.id === (selectedId || routes[0]?.id) && r.geometry?.coordinates?.length >= 2) {
        const coords = r.geometry.coordinates
        addEndpointMarker(coords[0][0], coords[0][1], 'origin')
        addEndpointMarker(coords[coords.length-1][0], coords[coords.length-1][1], 'destination')
        addDirectionArrows(r.id, r.geometry)
      }
    })
  }
 
  // drawRoutes: public, called by pages via sharedMapRef.
  // Persists routes, clears old layers, then delegates to _paintRouteLayers.
  // If a style change is actively in flight (styleChangingRef=true), we just
  // persist the routes and return — handleStyleChange's style.load callback
  // will call _paintRouteLayers once the new style is fully ready. Registering
  // a second once("style.load") here would create a dead listener because the
  // event fires exactly once per setStyle() call and handleStyleChange already
  // consumed it.
  function drawRoutes(routes, selectedId) {
    if (!map.current) return
    lastRoutesRef.current = { routes, selectedId }
 
    // Style transition in progress — handleStyleChange owns the style.load slot.
    // Our data is persisted in lastRoutesRef; it will be painted when style.load fires.
    if (styleChangingRef.current) return
 
    removeAllRoutes()
 
    if (!map.current.isStyleLoaded()) {
      // Genuine cold-start case (first map init, not a toggle).
      // Safe to register once("style.load") here because no handleStyleChange
      // listener is competing for it.
      map.current.once("style.load", () => _paintRouteLayers(routes, selectedId))
      return
    }
 
    _paintRouteLayers(routes, selectedId)
  }
 
  function highlightRoute(selectedId) {
    if (!map.current) return
    const isSatellite = activeStyleRef.current === "satellite"
    const selWidth   = isSatellite ? 8  : 6
    const unselWidth = isSatellite ? 5  : 3
    const selOpacity   = 1
    const unselOpacity = isSatellite ? 0.55 : 0.25
    routeIdsRef.current.forEach(layerId => {
      const routeId  = layerId.replace('route-layer-', '').replace('-casing', '')
      const isSel    = routeId === selectedId
      const isCasing = layerId.includes('-casing')
      const opacity  = isSel ? selOpacity : unselOpacity
      const width    = isSel ? selWidth   : unselWidth
      if (map.current.getLayer(layerId)) {
        try {
          map.current.setPaintProperty(layerId, 'line-opacity', isCasing ? opacity * (isSatellite ? 0.6 : 0.3) : opacity)
          map.current.setPaintProperty(layerId, 'line-width',   isCasing ? width + (isSatellite ? 6 : 4)       : width)
        } catch {}
      }
    })
  }
 
  function removeAllRoutes() {
    if (!map.current) return
    ;['safest','balanced','fastest'].forEach(id => {
      // Arrow layer + source (accumulated separately from route layers)
      const arrowLayerId = `arrow-layer-${id}`
      const arrowSrcId   = `arrow-src-${id}`
      if (map.current.getLayer(arrowLayerId))  map.current.removeLayer(arrowLayerId)
      if (map.current.getSource(arrowSrcId))   map.current.removeSource(arrowSrcId)
      // Route casing + main layer + source
      const layerId = `route-layer-${id}`
      if (map.current.getLayer(`${layerId}-casing`)) map.current.removeLayer(`${layerId}-casing`)
      if (map.current.getLayer(layerId))              map.current.removeLayer(layerId)
      if (map.current.getSource(`route-src-${id}`))   map.current.removeSource(`route-src-${id}`)
    })
    // Endpoint DOM markers
    ;['endpoint-origin','endpoint-destination'].forEach(id => {
      if (endpointMarkers.current[id]) {
        endpointMarkers.current[id].remove()
        delete endpointMarkers.current[id]
      }
    })
    routeIdsRef.current = []
    // NOTE: lastRoutesRef is intentionally NOT cleared here.
    // removeAllRoutes() is called inside drawRoutes() on every redraw cycle.
    // Clearing here would wipe the save that drawRoutes() made 2 lines earlier,
    // so style changes would always find nothing to restore.
    // lastRoutesRef is only cleared by the public clearRoutes() API.
  }
 
  function fitToGeometry(geometry) {
    if (!map.current || !geometry?.coordinates?.length) return
    const coords = geometry.coordinates
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    coords.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    })
    map.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: { top: 80, bottom: 120, left: 40, right: 40 }, duration: 1200 }
    )
  }
 
  const endpointMarkers = useRef({})
 
  function addEndpointMarker(lng, lat, type) {
    if (!map.current) return
    if (endpointMarkers.current[`endpoint-${type}`]) {
      endpointMarkers.current[`endpoint-${type}`].remove()
    }
    const isOrigin = type === 'origin'
    const color    = isOrigin ? '#38BDF8' : '#00E5A0'
    const label    = isOrigin ? 'START'   : 'END'
    const el = document.createElement('div')
    el.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:2px;cursor:default;`
    el.innerHTML = `
      <div style="
        padding:2px 6px;border-radius:4px;
        background:${color};color:#000;
        font-family:monospace;font-size:9px;font-weight:700;letter-spacing:0.08em;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);white-space:nowrap;
      ">${label}</div>
      <div style="
        width:14px;height:14px;border-radius:50%;
        background:${color};border:3px solid white;
        box-shadow:0 0 10px ${isOrigin ? 'rgba(56,189,248,0.7)' : 'rgba(0,229,160,0.7)'};
      "></div>
    `
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lng, lat]).addTo(map.current)
    endpointMarkers.current[`endpoint-${type}`] = marker
  }
 
  // Direction arrows on selected route via symbol layer
  function addDirectionArrows(routeId, geometry) {
    if (!map.current || !geometry) return
    const arrowSrcId   = `arrow-src-${routeId}`
    const arrowLayerId = `arrow-layer-${routeId}`
    if (map.current.getLayer(arrowLayerId))  map.current.removeLayer(arrowLayerId)
    if (map.current.getSource(arrowSrcId))   map.current.removeSource(arrowSrcId)
    map.current.addSource(arrowSrcId, { type: 'geojson', data: geometry })
    map.current.addLayer({
      id: arrowLayerId, type: 'symbol', source: arrowSrcId,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 80,
        // text-only arrows — no sprite needed, works with every Mapbox style
        'text-field': '›',
        'text-size': 18,
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-keep-upright': false,
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'viewport',
      },
      paint: { 'text-color': '#ffffff', 'text-opacity': 0.85 },
    })
    routeIdsRef.current.push(arrowLayerId)
  }
 
    // ── ZONE PULSE — cinematic sonar ring on zone click ──────────
  function triggerZonePulse(lng, lat) {
    if (!map.current) return
    const sourceId = 'pulse-source'
    const layerId  = 'pulse-layer'
    // Remove any existing pulse
    if (map.current.getLayer(layerId))  map.current.removeLayer(layerId)
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId)
 
    map.current.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } }
    })
    map.current.addLayer({
      id: layerId, type: 'circle', source: sourceId,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['coalesce', ['get', 'step'], 0], 0, 0, 1, 80],
        'circle-color': '#00E5A0',
        'circle-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'step'], 0], 0, 0.6, 1, 0],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#00E5A0',
        'circle-stroke-opacity': ['interpolate', ['linear'], ['coalesce', ['get', 'step'], 0], 0, 0.8, 1, 0],
      }
    })
 
    // Animate 3 rings outward
    let step = 0
    const animate = () => {
      step = Math.min(step + 0.018, 1)
      const src = map.current?.getSource(sourceId)
      if (src) {
        src.setData({ type: 'Feature', properties: { step }, geometry: { type: 'Point', coordinates: [lng, lat] } })
      }
      if (step < 1) requestAnimationFrame(animate)
      else {
        setTimeout(() => {
          if (map.current?.getLayer(layerId))  map.current.removeLayer(layerId)
          if (map.current?.getSource(sourceId)) map.current.removeSource(sourceId)
        }, 300)
      }
    }
    requestAnimationFrame(animate)
  }
 
  // ── COMMUNITY REPORT MARKERS — clustered + time-decay ────────
  const communityReportsRef = useRef([])
 
  function initCommunityReportsLayer() {
    if (!map.current || map.current.getSource('community-reports')) return
    map.current.addSource('community-reports', {
      type: 'geojson',
      data: buildReportsGeoJSON(),
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
      clusterProperties: {
        // Track dominant category for cluster colour
        suspicious: ['+', ['case', ['==', ['get', 'category'], 'suspicious'], 1, 0]],
        hazard:     ['+', ['case', ['==', ['get', 'category'], 'hazard'],     1, 0]],
        lighting:   ['+', ['case', ['==', ['get', 'category'], 'lighting'],   1, 0]],
      }
    })
 
    // Cluster circles — colour by dominant category
    map.current.addLayer({
      id: 'clusters', type: 'circle', source: 'community-reports',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'case',
          ['>', ['get', 'suspicious'], ['get', 'hazard']], '#FF6B4A',
          ['>', ['get', 'hazard'],     ['get', 'lighting']], '#FBBF24',
          '#38BDF8'
        ],
        'circle-radius': ['step', ['get', 'point_count'], 16, 5, 22, 10, 28],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.3,
      }
    })
 
    // Cluster count labels
    map.current.addLayer({
      id: 'cluster-count', type: 'symbol', source: 'community-reports',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 11,
      },
      paint: { 'text-color': '#ffffff' }
    })
 
    // Individual unclustered markers with time-decay opacity
    map.current.addLayer({
      id: 'unclustered-reports', type: 'circle', source: 'community-reports',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 7,
        'circle-opacity': ['get', 'opacity'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': ['get', 'opacity'],
      }
    })
 
    // Hover popup for individual reports
    const reportPopup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '200px' })
    map.current.on('mouseenter', 'unclustered-reports', (e) => {
      map.current.getCanvas().style.cursor = 'pointer'
      const props = e.features[0].properties
      const minsAgo = Math.round((Date.now() - props.timestamp) / 60000)
      reportPopup.setLngLat(e.features[0].geometry.coordinates).setHTML(`
        <div style="background:rgba(8,12,28,0.97);backdrop-filter:blur(20px);border:1px solid ${props.color}40;border-radius:12px;padding:10px 14px;font-family:monospace;pointer-events:none;">
          <div style="font-size:8px;color:${props.color};letter-spacing:0.15em;font-weight:700;margin-bottom:6px;">COMMUNITY REPORT</div>
          <div style="font-size:11px;color:#F5F0E8;font-weight:600;margin-bottom:4px;">${props.label}</div>
          <div style="font-size:10px;color:rgba(245,240,232,0.4);">${minsAgo < 1 ? 'Just now' : minsAgo + ' min ago'} · Anonymous</div>
        </div>
      `).addTo(map.current)
    })
    map.current.on('mouseleave', 'unclustered-reports', () => {
      map.current.getCanvas().style.cursor = ''
      reportPopup.remove()
    })
  }
 
  function buildReportsGeoJSON() {
    const now = Date.now()
    const features = communityReportsRef.current
      .filter(r => (now - r.timestamp) < 48 * 60 * 60 * 1000) // drop after 48h
      .map(r => {
        const ageHours = (now - r.timestamp) / (1000 * 60 * 60)
        const opacity  = Math.max(0.15, 1 - (ageHours / 24)) // fade over 24h
        const colorMap = { suspicious: '#FF6B4A', lighting: '#FBBF24', hazard: '#FBBF24', safe: '#FB923C', other: '#38BDF8' }
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
          properties: { ...r, opacity, color: colorMap[r.category] || '#38BDF8', label: r.label || r.category }
        }
      })
    return { type: 'FeatureCollection', features }
  }
 
  function addOneCommunityMarker(report) {
    communityReportsRef.current = [report, ...communityReportsRef.current].slice(0, 200)
    const src = map.current?.getSource('community-reports')
    if (src) src.setData(buildReportsGeoJSON())
    else initCommunityReportsLayer()
  }
 
  function refreshCommunityOpacity() {
    const src = map.current?.getSource('community-reports')
    if (src) src.setData(buildReportsGeoJSON())
  }
 
  // Refresh opacity every 5 minutes
  useEffect(() => {
    const iv = setInterval(refreshCommunityOpacity, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])
 
    function addNeighborhoodTooltips() {
    const zones = riskZonesRef.current
    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "200px", offset: 12 })
 
    zones.forEach(zone => {
      const layerId = `zone-fill-${zone.id}`
      if (!map.current.getLayer(layerId)) return
 
      map.current.on("mouseenter", layerId, () => {
        map.current.getCanvas().style.cursor = "pointer"
        popup.setLngLat(zone.coordinates)
          .setHTML(`
            <div style="background:rgba(12,16,32,0.97);backdrop-filter:blur(20px);border:1px solid ${zone.color}40;border-radius:10px;padding:10px 14px;font-family:monospace;">
              <div style="font-size:8px;color:rgba(245,240,232,0.4);letter-spacing:0.15em;margin-bottom:4px;">SAFETY ZONE</div>
              <div style="font-size:12px;color:#F5F0E8;font-weight:700;margin-bottom:6px;">${zone.name}</div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="background:${zone.color}20;color:${zone.color};border:1px solid ${zone.color}40;border-radius:99px;padding:2px 8px;font-size:9px;font-weight:700;letter-spacing:0.1em;">${zone.level}</span>
                <span style="font-size:10px;color:rgba(245,240,232,0.5);">Score: ${zone.risk_score ?? "—"}/99</span>
              </div>
            </div>
          `)
          .addTo(map.current)
      })
 
      map.current.on("mouseleave", layerId, () => {
        map.current.getCanvas().style.cursor = ""
        popup.remove()
      })
    })
  }
 
 
 
  // ── DIMMED EFFECT ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return
    mapContainer.current.style.opacity = dimmed ? "0.5" : "1"
  }, [dimmed])
 
  // ── RENDER ────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes saferoute-ping {
          0%   { transform:scale(1);   opacity:0.3; }
          100% { transform:scale(2.8); opacity:0;   }
        }
        @keyframes saferoute-ripple {
          0%   { transform:scale(1);   opacity:0.4; }
          100% { transform:scale(2.4); opacity:0;   }
        }
        @keyframes click-ripple {
          0%   { transform:scale(0.6); opacity:0.8; }
          100% { transform:scale(2.2); opacity:0;   }
        }
        @keyframes slideDown {
          from { opacity:0; transform:translateY(8px);  }
          to   { opacity:1; transform:translateY(0);    }
        }
        .mapboxgl-popup-content  { background:transparent !important; padding:0 !important; box-shadow:none !important; border-radius:0 !important; }
        .mapboxgl-popup-tip      { display:none !important; }
        .mapboxgl-ctrl-group     { background:rgba(12,16,32,0.85) !important; backdrop-filter:blur(20px) !important; border:1px solid rgba(251,146,60,0.18) !important; border-radius:10px !important; overflow:hidden; }
        .mapboxgl-ctrl-group button { background:transparent !important; border-bottom:1px solid rgba(255,255,255,0.06) !important; }
        .mapboxgl-ctrl-icon      { filter:invert(1) opacity(0.6); }
        .mapboxgl-ctrl-attrib   { display:none !important; }
      `}</style>
 
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        <div ref={mapContainer} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 scan-line pointer-events-none" />
        <div className="absolute inset-0 noise-overlay pointer-events-none" />
 
        <MapStyleToggle
          activeStyle={activeStyle}
          is3D={is3D}
          onStyleChange={handleStyleChange}
          on3DToggle={handle3DToggle}
          containerRef={mapContainer}
        />
 
        {children}
      </div>
    </>
  )
}