import { useState, useEffect } from "react"
import { X, Clock, MapPin, CheckCircle, Radio, Download } from "lucide-react"
 
// ── RATE LIMIT HELPERS ─────────────────────────────────────────
const STORAGE_KEY = "saferoute_report_log"
const TEN_MIN     = 10 * 60 * 1000
const ONE_HOUR    = 60 * 60 * 1000
 
function checkRateLimit(category) {
  try {
    const log = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    const now = Date.now()
    const sameCat    = log.filter(r => r.category === category && (now - r.ts) < TEN_MIN)
    const recentAll  = log.filter(r => (now - r.ts) < ONE_HOUR)
 
    if (sameCat.length > 0) {
      const remaining = Math.ceil((TEN_MIN - (now - sameCat[0].ts)) / 60000)
      return { blocked: true, reason: `Same category reported recently — available in ${remaining} min` }
    }
    if (recentAll.length >= 3) {
      const oldestRecent = recentAll[recentAll.length - 1]
      const resetIn = Math.ceil((ONE_HOUR - (now - oldestRecent.ts)) / 60000)
      return { blocked: true, reason: `3 reports filed this hour — limit resets in ${resetIn} min` }
    }
    return { blocked: false }
  } catch { return { blocked: false } }
}
 
function logReport(category) {
  try {
    const log = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ category, ts: Date.now() }, ...log].slice(0, 100)))
  } catch {}
}
 
// ── REPORT TYPES ──────────────────────────────────────────────
const REPORT_TYPES = [
  { id: "suspicious", label: "Suspicious Activity",    color: "coral",  description: "Person, vehicle, or behaviour" },
  { id: "lighting",   label: "Broken Street Light",    color: "amber",  description: "Poor visibility on path" },
  { id: "hazard",     label: "Road / Path Hazard",     color: "amber",  description: "Obstruction, damage, flooding" },
  { id: "safe",       label: "Area Feels Unsafe",       color: "amber2", description: "General concern, no specific event" },
  { id: "other",      label: "Other Concern",           color: "sky",    description: "Anything else worth noting" },
]
 
const COLOR_MAP = {
  coral:  { ring: "ring-coral/50",  bg: "bg-coral/8",  dot: "bg-coral",  text: "text-coral"  },
  amber:  { ring: "ring-amber/50",  bg: "bg-amber/8",  dot: "bg-amber",  text: "text-amber"  },
  amber2: { ring: "ring-amber2/50", bg: "bg-amber2/8", dot: "bg-amber2", text: "text-amber2" },
  sky:    { ring: "ring-sky/50",    bg: "bg-sky/8",    dot: "bg-sky",    text: "text-sky"    },
}
 
/**
 * CommunityReportModal
 *
 * Props:
 *   onClose      — close the modal
 *   onSubmitted  — called with the full report object on success
 */
export function CommunityReportModal({ onClose, onSubmitted }) {
  const [reportType,    setReportType]    = useState("")
  const [submitted,     setSubmitted]     = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [locStatus,     setLocStatus]     = useState("idle")
  const [userLocation,  setUserLocation]  = useState(null)
  const [rateError,     setRateError]     = useState("")
  const [photo,         setPhoto]         = useState(null)   // base64 string
  const [photoThumb,    setPhotoThumb]    = useState(null)   // object URL for preview
 
  // ── GPS — acquired at submit, but we start warming it up immediately
  useEffect(() => {
    if (!navigator.geolocation) { setLocStatus("denied"); return }
    setLocStatus("acquiring")
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) })
        setLocStatus("locked")
      },
      () => setLocStatus("denied"),
      { timeout: 8000, maximumAge: 30000 }
    )
  }, [])
 
  // Clear rate error when category changes
  useEffect(() => { setRateError("") }, [reportType])
 
  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const thumb = URL.createObjectURL(file)
    setPhotoThumb(thumb)
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result)  // full base64 data URL
    reader.readAsDataURL(file)
  }
 
  const downloadEvidencePDF = (report) => {
    const lat    = report.location?.lat?.toFixed(5) || "N/A"
    const lng    = report.location?.lng?.toFixed(5) || "N/A"
    const acc    = report.location?.accuracy        || "N/A"
    const mapsUrl = report.location
      ? `https://maps.google.com/?q=${report.location.lat},${report.location.lng}`
      : "N/A"
    const photoSection = photo
      ? `<div style="margin-top:16px"><img src="${photo}" alt="Evidence photo" style="max-width:100%;border-radius:8px;border:1px solid #ccc"/></div>`
      : `<p style="color:#888;font-style:italic">No photo attached</p>`
 
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SafeRoute Incident Report</title>
<style>body{font-family:monospace;padding:32px;max-width:600px;margin:auto;color:#1a1a1a}
h1{color:#00b07a;font-size:18px;border-bottom:2px solid #00b07a;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin:16px 0}
td{padding:6px 8px;border:1px solid #ddd;font-size:13px}
td:first-child{font-weight:bold;width:40%;background:#f9f9f9}
.badge{display:inline-block;padding:3px 8px;border-radius:4px;background:#ffe4e4;color:#c00;font-size:11px;font-weight:bold}
</style></head><body>
<h1>📍 SafeRoute AI+ — Incident Evidence Report</h1>
<table>
<tr><td>Category</td><td><span class="badge">${report.label}</span></td></tr>
<tr><td>Timestamp</td><td>${new Date(report.timestamp).toLocaleString()}</td></tr>
<tr><td>GPS Coordinates</td><td>${lat}, ${lng}</td></tr>
<tr><td>GPS Accuracy</td><td>±${acc}m</td></tr>
<tr><td>Google Maps</td><td><a href="${mapsUrl}">${mapsUrl}</a></td></tr>
<tr><td>City</td><td>${report.city}</td></tr>
<tr><td>Anonymous</td><td>Yes</td></tr>
<tr><td>Montgomery Non-Emergency</td><td>(334) 241-2651</td></tr>
</table>
<h2 style="font-size:14px;color:#555">Evidence Photo</h2>
${photoSection}
<p style="margin-top:24px;font-size:11px;color:#aaa">Generated by SafeRoute AI+ · For reference only</p>
</body></html>`
 
    const blob = new Blob([html], { type: "text/html" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = `saferoute-report-${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }
 
  const handleSubmit = () => {
    if (!reportType || submitting) return
 
    const limit = checkRateLimit(reportType)
    if (limit.blocked) { setRateError(limit.reason); return }
 
    setSubmitting(true)
 
    const selected = REPORT_TYPES.find(r => r.id === reportType)
    const report = {
      type:      reportType,
      category:  reportType,
      label:     selected?.label || reportType,
      timestamp: Date.now(),
      location:  userLocation || null,
      anonymous: true,
      city:      "Montgomery, AL",
      hasPhoto:  !!photo,
    }
 
    logReport(reportType)
 
    setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
      onSubmitted?.(report)
      // Save report to localStorage for offline evidence log
      try {
        const log = JSON.parse(localStorage.getItem("saferoute_evidence_log") || "[]")
        log.unshift({ ...report, photoThumb: photoThumb || null })
        localStorage.setItem("saferoute_evidence_log", JSON.stringify(log.slice(0, 50)))
      } catch {}
    }, 900)
  }
 
  const selectedType = REPORT_TYPES.find(r => r.id === reportType)
  const selectedColors = selectedType ? COLOR_MAP[selectedType.color] : null
 
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-bg/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-bg2 rounded-2xl border border-border shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
 
        {!submitted ? (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-4 border-b border-border">
              <div>
                <h3 className="font-serif italic text-xl text-foreground">Report an Issue</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    locStatus === "locked"     ? "bg-mint animate-pulse" :
                    locStatus === "acquiring"  ? "bg-amber animate-pulse" :
                    locStatus === "denied"     ? "bg-coral" : "bg-muted-foreground"
                  }`} />
                  <span className="font-mono text-[9px] text-muted-foreground uppercase">
                    {locStatus === "locked"    ? `GPS ±${userLocation?.accuracy}m` :
                     locStatus === "acquiring" ? "Acquiring GPS..." :
                     locStatus === "denied"    ? "Location unavailable" : "..."}
                  </span>
                </div>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-1">
                <X className="w-5 h-5" />
              </button>
            </div>
 
            {/* Rate limit warning */}
            {rateError && (
              <div className="mx-5 mt-4 p-3 rounded-xl bg-amber/8 border border-amber/25 flex items-start gap-2">
                <Clock className="w-4 h-4 text-amber flex-shrink-0 mt-0.5" />
                <p className="font-mono text-[10px] text-amber leading-relaxed">{rateError}</p>
              </div>
            )}
 
            {/* Category selector */}
            <div className="p-5 space-y-2">
              <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider mb-3">
                What are you reporting?
              </p>
 
              {REPORT_TYPES.map(type => {
                const c = COLOR_MAP[type.color]
                const isSelected = reportType === type.id
                return (
                  <button
                    key={type.id}
                    onClick={() => setReportType(type.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      isSelected
                        ? `ring-1 ${c.ring} ${c.bg} border-transparent`
                        : "border-border/40 hover:border-border/80 bg-transparent"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[11px] text-foreground">{type.label}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/60">{type.description}</div>
                    </div>
                    {isSelected && <div className={`w-1.5 h-1.5 rounded-full ${c.dot} flex-shrink-0`} />}
                  </button>
                )
              })}
            </div>
 
            {/* Photo evidence capture */}
            <div className="px-5 pb-3">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl border border-border/40 group-hover:border-sky/40 bg-bg3 flex items-center justify-center transition-colors">
                  {photoThumb
                    ? <img src={photoThumb} alt="" className="w-full h-full object-cover rounded-xl"/>
                    : <span className="text-base">📷</span>
                  }
                </div>
                <div>
                  <div className="font-mono text-[11px] text-foreground">
                    {photo ? "Photo attached" : "Add evidence photo (optional)"}
                  </div>
                  <div className="font-mono text-[9px] text-muted-foreground/50">
                    Camera or gallery · Included in evidence report
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="sr-only"
                />
                {photo && (
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); setPhoto(null); setPhotoThumb(null) }}
                    className="ml-auto text-muted-foreground hover:text-coral"
                  >
                    <X className="w-4 h-4"/>
                  </button>
                )}
              </label>
            </div>
 
            {/* Footer */}
            <div className="px-5 pb-5 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-border text-muted-foreground font-mono text-[10px] uppercase hover:border-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reportType || submitting}
                className={`flex-1 py-3 rounded-xl font-mono text-[10px] uppercase font-bold transition-all flex items-center justify-center gap-2 ${
                  reportType && !submitting
                    ? `${selectedColors?.bg || "bg-amber/10"} ${selectedColors?.text || "text-amber"} border ${selectedColors?.ring?.replace("ring-", "border-") || "border-amber/30"} hover:opacity-90`
                    : "bg-bg3 text-muted-foreground cursor-not-allowed"
                }`}
              >
                {submitting ? (
                  <span className="animate-pulse">Submitting...</span>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5" />
                    Submit Report
                  </>
                )}
              </button>
            </div>
 
            <p className="text-center font-mono text-[8px] text-muted-foreground/40 pb-4">
              Anonymous · Max 3 reports per hour
            </p>
          </>
 
        ) : (
          /* Success screen */
          <div className="p-8 text-center">
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full bg-mint/20 animate-ping" style={{ animationDuration: "1.5s" }} />
              <div className="relative w-16 h-16 rounded-full bg-mint/10 border border-mint flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-mint" />
              </div>
            </div>
 
            <h3 className="font-serif italic text-xl text-foreground mb-2">Report Submitted</h3>
            <p className="font-mono text-[10px] text-mint mb-1">
              {userLocation
                ? `GPS: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)} (±${userLocation.accuracy}m)`
                : "Submitted anonymously — no location"}
            </p>
            <p className="font-mono text-[9px] text-muted-foreground/50 mb-6">
              Broadcast to nearby SafeRoute users
            </p>
 
            <div className="flex flex-col gap-2">
              <button
                onClick={() => downloadEvidencePDF({
                  label: REPORT_TYPES.find(r=>r.id===reportType)?.label || reportType,
                  timestamp: Date.now(),
                  location: userLocation,
                  city: "Montgomery, AL",
                })}
                className="w-full py-3 rounded-xl bg-sky/10 border border-sky/30 text-sky font-mono text-[10px] uppercase font-bold hover:bg-sky/20 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5"/>
                Download Evidence Report
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-mint/10 border border-mint/30 text-mint font-mono text-[10px] uppercase font-bold hover:bg-mint/20 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}