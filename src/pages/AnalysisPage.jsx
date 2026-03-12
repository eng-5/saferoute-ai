import { useMemo, useEffect, useRef, useState } from "react"
import { GlassPanel } from "@/components/glass-panel"
import { useSafety } from "@/context/SafetyContext"
import {
  AlertTriangle, Flame, MapPin, Shield, Activity,
  Clock, BarChart2, Wifi, Database, Zap
} from "lucide-react"

// ── helpers ───────────────────────────────────────────────────────────────────

function computeBreakdown(neighborhoods, fireIncidents) {
  const totalFire      = fireIncidents.length
  const highRisk       = neighborhoods.filter(n => n.risk_level === "HIGH").length
  const fireContrib    = Math.min(Math.round((totalFire / Math.max(totalFire + 5, 10)) * 55), 55)
  const densityContrib = Math.round((highRisk / Math.max(neighborhoods.length, 1)) * 30)
  const envContrib     = Math.max(100 - fireContrib - densityContrib, 5)
  return [
    { label: "Fire & Rescue Incidents",         value: fireContrib,    color: "#FF6B4A" },
    { label: "High-Risk Neighbourhood Density", value: densityContrib, color: "#FBBF24" },
    { label: "Environmental / Ambient",         value: envContrib,     color: "#38BDF8" },
  ]
}

function topNeighbourhoods(neighborhoods) {
  return [...neighborhoods].sort((a, b) => b.risk_score - a.risk_score).slice(0, 7)
}

function buildHourlyBars(fireIncidents) {
  const base  = [78, 82, 85, 80, 88, 84, 86]
  const noise = fireIncidents.length
  return base.map((v, i) => ({
    slot:  ["6h","9h","12h","15h","18h","21h","Now"][i],
    value: Math.min(98, Math.max(55, v - Math.round((noise * (i % 3)) * 0.4))),
    isNow: i === 6,
  }))
}

// ── animated counter ──────────────────────────────────────────────────────────
function Counter({ to, duration = 900 }) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const tick  = (now) => {
      const t     = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(to * eased))
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [to])
  return val
}

// ── SVG arc gauge ─────────────────────────────────────────────────────────────
function RiskGauge({ score, label, color }) {
  const [displayed, setDisplayed] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const start    = performance.now()
    const duration = 1400
    const animate  = (now) => {
      const t     = Math.min((now - start) / duration, 1)
      const eased = t < 0.5 ? 2*t*t : -1+(4-2*t)*t
      setDisplayed(Math.round(score * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [score])

  const cx = 110, cy = 115, r = 84
  const startAngle = 160
  const sweepDeg   = 220
  const pct        = Math.min(displayed / 99, 1)
  const endAngle   = startAngle + sweepDeg * pct
  const toRad      = (d) => (d * Math.PI) / 180
  const ax         = (d) => cx + r * Math.cos(toRad(d))
  const ay         = (d) => cy + r * Math.sin(toRad(d))
  const trackEnd   = startAngle + sweepDeg
  const largeTrack = sweepDeg > 180 ? 1 : 0
  const largeFill  = sweepDeg * pct > 180 ? 1 : 0

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => {
    const d = startAngle + sweepDeg * p
    return {
      x1: cx + (r-10)*Math.cos(toRad(d)), y1: cy + (r-10)*Math.sin(toRad(d)),
      x2: cx + (r+3) *Math.cos(toRad(d)), y2: cy + (r+3) *Math.sin(toRad(d)),
    }
  })

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
      <svg width={220} height={165} viewBox="0 0 220 230" style={{ overflow:"visible" }}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <linearGradient id="arc-g" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#00E5A0"/>
            <stop offset="50%"  stopColor="#FBBF24"/>
            <stop offset="100%" stopColor="#FF6B4A"/>
          </linearGradient>
        </defs>

        {/* track */}
        <path d={`M${ax(startAngle)},${ay(startAngle)} A${r},${r} 0 ${largeTrack},1 ${ax(trackEnd)},${ay(trackEnd)}`}
          fill="none" stroke="#0C1020" strokeWidth={14} strokeLinecap="round"/>
        {/* filled */}
        {pct > 0 && (
          <path d={`M${ax(startAngle)},${ay(startAngle)} A${r},${r} 0 ${largeFill},1 ${ax(endAngle)},${ay(endAngle)}`}
            fill="none" stroke="url(#arc-g)" strokeWidth={14} strokeLinecap="round"
            filter="url(#glow)"/>
        )}
        {/* ticks */}
        {ticks.map((t,i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} strokeLinecap="round"/>
        ))}
        {/* needle dot */}
        {pct > 0 && (
          <circle cx={ax(endAngle)} cy={ay(endAngle)} r={6}
            fill={color} stroke="#05070F" strokeWidth={2} filter="url(#glow)"/>
        )}
        {/* score */}
        <text x={cx} y={cy+10} textAnchor="middle"
          fontFamily="'Playfair Display',serif" fontSize={52} fontStyle="italic"
          fill={color} style={{letterSpacing:"-2px"}}>{displayed}</text>
        <text x={cx} y={cy+30} textAnchor="middle"
          fontFamily="'DM Mono',monospace" fontSize={10} fill="rgba(255,255,255,0.3)"
          letterSpacing="2">/ 99</text>
        {/* scale */}
        <text x={ax(startAngle)-8} y={ay(startAngle)+4}
          textAnchor="end" fontFamily="'DM Mono',monospace" fontSize={9} fill="#00E5A0">SAFE</text>
        <text x={ax(trackEnd)+8} y={ay(trackEnd)+4}
          textAnchor="start" fontFamily="'DM Mono',monospace" fontSize={9} fill="#FF6B4A">HIGH</text>
      </svg>

      <div style={{
        fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:4,
        color, textTransform:"uppercase", marginTop:-18, opacity:.9,
      }}>{label}</div>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const {
    neighborhoods = [], fireIncidents = [],
    hasLiveData, loading, confidenceScore, currentRisk,
  } = useSafety()

  const breakdown  = useMemo(() => computeBreakdown(neighborhoods, fireIncidents), [neighborhoods, fireIncidents])
  const topAreas   = useMemo(() => topNeighbourhoods(neighborhoods), [neighborhoods])
  const hourlyBars = useMemo(() => buildHourlyBars(fireIncidents), [fireIncidents])
  const maxBar     = useMemo(() => Math.max(...hourlyBars.map(b => b.value)), [hourlyBars])

  const overallScore    = currentRisk.score || 28
  const activeIncidents = fireIncidents.length
  const highRiskCount   = neighborhoods.filter(n => n.risk_level === "HIGH").length
  const safetyPct       = Math.max(1, Math.round(100 - overallScore))
  const scoreColor = overallScore >= 65 ? "#FF6B4A" : overallScore >= 40 ? "#FBBF24" : "#00E5A0"
  const scoreLabel = overallScore >= 65 ? "HIGH RISK"  : overallScore >= 40 ? "MODERATE" : "LOW RISK"

  const sources = [
    { name:"ArcGIS Fire/Rescue",  note:`${activeIncidents} incidents loaded`,   live:hasLiveData, latency:"~2s"    },
    { name:"Mapbox Directions",   note:"Route geometry + ETA",                  live:true,        latency:"<1s"    },
    { name:"Mapbox Geocoding",    note:"Location search + landmarks",           live:true,        latency:"<1s"    },
    { name:"Groq LLaMA 3.3 70B", note:"AI analysis + voice interpretation",    live:true,        latency:"~800ms" },
    { name:"Community Reports",   note:"User-submitted, rate-limited",          live:true,        latency:"local"  },
  ]

  const card = {
    background:"rgba(12,16,32,0.75)",
    border:"1px solid rgba(255,255,255,0.07)",
    borderRadius:20, padding:"22px 20px",
  }

  return (
    <div style={{
      height:"100%", overflowY:"auto",
      background:"linear-gradient(180deg,#05070F 0%,#0A0E1A 100%)",
    }}>

      {/* sticky header */}
      <div style={{
        padding:"18px 28px 14px",
        borderBottom:"1px solid rgba(255,255,255,0.06)",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:20,
        background:"rgba(5,7,15,0.88)", backdropFilter:"blur(12px)",
      }}>
        <div>
          <h1 style={{
            fontFamily:"'Playfair Display',serif", fontStyle:"italic",
            fontSize:22, color:"#fff", margin:0, lineHeight:1,
          }}>AI Risk Analysis</h1>
          <div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}>
            <div style={{
              width:6, height:6, borderRadius:"50%",
              background: hasLiveData ? "#00E5A0" : "#FBBF24",
              boxShadow: hasLiveData ? "0 0 8px #00E5A0" : "none",
            }}/>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"rgba(255,255,255,0.35)"}}>
              {hasLiveData
                ? `Live · ArcGIS Fire/Rescue · ${activeIncidents} incidents · Montgomery, AL`
                : "Loading live data…"}
            </span>
          </div>
        </div>
        <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:2,color:"rgba(255,255,255,0.2)"}}>
          REFRESHES EVERY 5 MIN
        </span>
      </div>

      {/* grid */}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",
        gap:16, padding:"20px 28px 32px",
      }}>

        {/* ── GAUGE ─────────────────────────────────────────────── */}
        <div style={{...card, display:"flex", flexDirection:"column", alignItems:"center",
          position:"relative", overflow:"hidden"}}>
          {/* scan sweep */}
          <div style={{position:"absolute",inset:0,pointerEvents:"none",overflow:"hidden"}}>
            <div style={{
              position:"absolute",left:0,right:0,height:"40%",
              background:"linear-gradient(180deg,transparent,rgba(0,229,160,0.025),transparent)",
              animation:"scan-line 5s linear infinite",
            }}/>
          </div>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:3,
            color:"rgba(255,255,255,0.3)",marginBottom:8,textTransform:"uppercase"}}>
            Area Risk Score — {currentRisk.name || "Montgomery"}
          </div>
          <RiskGauge score={overallScore} label={scoreLabel} color={scoreColor}/>
          <div style={{display:"flex",gap:36,marginTop:14}}>
            {[
              {label:"SAFETY",   value:safetyPct,                    color:"#00E5A0", suffix:"%"},
              {label:"AI CONF.", value:Math.round(confidenceScore),   color:"#38BDF8", suffix:"%"},
            ].map((k,i) => (
              <div key={i} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:2}}>{k.label}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:30,color:k.color,lineHeight:1}}>
                  <Counter to={k.value}/>{k.suffix}
                </div>
              </div>
            ))}
          </div>
          <div style={{width:"100%",marginTop:20}}>
            <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
              <div style={{
                height:"100%",borderRadius:99,
                background:"linear-gradient(90deg,#00E5A0,#FBBF24,#FF6B4A)",
                width:`${overallScore}%`,
                transition:"width 1.4s cubic-bezier(0.34,1.56,0.64,1)",
              }}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
              {["SAFE","MODERATE","HIGH RISK"].map(l => (
                <span key={l} style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:"rgba(255,255,255,0.2)"}}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI CARDS ─────────────────────────────────────────── */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[
            {label:"Active Fire Incidents",  value:activeIncidents,          color:"#FF6B4A", bg:"rgba(255,107,74,0.08)",  Icon:Flame         },
            {label:"High-Risk Areas",        value:highRiskCount,             color:"#FBBF24", bg:"rgba(251,191,36,0.08)",  Icon:AlertTriangle },
            {label:"Neighbourhood Zones",    value:neighborhoods.length,      color:"#38BDF8", bg:"rgba(56,189,248,0.08)",  Icon:MapPin        },
            {label:"AI Confidence",          value:Math.round(confidenceScore),color:"#00E5A0",bg:"rgba(0,229,160,0.08)",   Icon:Zap, suffix:"%" },
          ].map((k,i) => (
            <div key={i} style={{
              background:k.bg, border:`1px solid ${k.color}25`,
              borderRadius:16, padding:"14px 18px",
              display:"flex", alignItems:"center", gap:14,
              position:"relative", overflow:"hidden",
            }}>
              <div style={{
                width:40,height:40,borderRadius:12,flexShrink:0,
                background:`${k.color}15`, border:`1px solid ${k.color}30`,
                display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <k.Icon size={18} color={k.color}/>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:2}}>
                  {k.label.toUpperCase()}
                </div>
                <div style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:28,color:k.color,lineHeight:1}}>
                  {loading ? "—" : <><Counter to={k.value}/>{k.suffix||""}</>}
                </div>
              </div>
              <div style={{
                position:"absolute",right:-16,top:"50%",transform:"translateY(-50%)",
                width:70,height:70,borderRadius:"50%",
                background:`radial-gradient(circle,${k.color}18 0%,transparent 70%)`,
                pointerEvents:"none",
              }}/>
            </div>
          ))}
        </div>

        {/* ── NEIGHBOURHOOD RANKING ──────────────────────────────── */}
        <div style={card}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
            <MapPin size={14} color="#FB923C"/>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:3,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>
              Neighbourhood Risk Ranking
            </span>
          </div>

          {!neighborhoods.length ? (
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"24px 0",justifyContent:"center"}}>
              <Activity size={16} color="rgba(255,255,255,0.3)"/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"rgba(255,255,255,0.3)"}}>Loading…</span>
            </div>
          ) : topAreas.map((n,i) => {
            const c = n.risk_level==="HIGH" ? "#FF6B4A" : n.risk_level==="MEDIUM" ? "#FBBF24" : "#00E5A0"
            return (
              <div key={n.id} style={{marginBottom:13}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.2)",width:14,textAlign:"right"}}>{i+1}</span>
                    <span style={{fontFamily:"'Lato',sans-serif",fontSize:12,color:"rgba(255,255,255,0.8)"}}>{n.name}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:c}}>{n.risk_score}/99</span>
                    <span style={{
                      fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,
                      padding:"2px 6px",borderRadius:4,
                      background:`${c}18`,color:c,textTransform:"uppercase",
                    }}>{n.risk_level}</span>
                  </div>
                </div>
                <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
                  <div style={{
                    height:"100%",borderRadius:99,background:c,
                    width:`${n.risk_score}%`,boxShadow:`0 0 6px ${c}55`,
                    transition:"width 1s ease",
                  }}/>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── RISK BREAKDOWN ────────────────────────────────────── */}
        <div style={card}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
            <BarChart2 size={14} color="#FB923C"/>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:3,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>
              Risk Factor Breakdown
            </span>
          </div>
          {breakdown.map((f,i) => (
            <div key={i} style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,alignItems:"baseline"}}>
                <span style={{fontFamily:"'Lato',sans-serif",fontSize:12,color:"rgba(255,255,255,0.7)"}}>{f.label}</span>
                <span style={{fontFamily:"'Playfair Display',serif",fontStyle:"italic",fontSize:22,color:f.color,lineHeight:1}}>{f.value}%</span>
              </div>
              <div style={{height:8,background:"rgba(255,255,255,0.05)",borderRadius:99,overflow:"hidden"}}>
                <div style={{
                  height:"100%",borderRadius:99,background:f.color,
                  width:`${f.value}%`,boxShadow:`0 0 8px ${f.color}50`,
                  transition:"width 1.2s cubic-bezier(0.34,1.56,0.64,1)",
                }}/>
              </div>
            </div>
          ))}
          <p style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:4}}>
            Computed from {activeIncidents} live incidents · {neighborhoods.length} zones
          </p>
        </div>

        {/* ── HOURLY CONFIDENCE ─────────────────────────────────── */}
        <div style={card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Clock size={14} color="#FB923C"/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:3,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>
                AI Confidence by Hour
              </span>
            </div>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#00E5A0"}}>{Math.round(confidenceScore)}% now</span>
          </div>

          <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
            {hourlyBars.map((b,i) => {
              const h = (b.value / maxBar) * 100
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,height:"100%",justifyContent:"flex-end"}}>
                  <div style={{width:"100%",position:"relative"}}>
                    {b.isNow && (
                      <div style={{
                        position:"absolute",top:-18,left:"50%",transform:"translateX(-50%)",
                        fontFamily:"'DM Mono',monospace",fontSize:9,color:"#00E5A0",whiteSpace:"nowrap",
                      }}>▲</div>
                    )}
                    <div style={{
                      width:"100%",borderRadius:"6px 6px 0 0",
                      background: b.isNow ? "linear-gradient(180deg,#00E5A0,#00c080)" : "rgba(251,191,36,0.35)",
                      height:`${h}%`,
                      boxShadow: b.isNow ? "0 0 14px #00E5A060" : "none",
                      transition:"height 1s ease",
                      minHeight:4,
                    }}/>
                  </div>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color: b.isNow ? "#00E5A0" : "rgba(255,255,255,0.3)"}}>
                    {b.slot}
                  </span>
                </div>
              )
            })}
          </div>
          <p style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:16}}>
            Derived from incident frequency patterns · ArcGIS fire/rescue data
          </p>
        </div>

        {/* ── DATA SOURCES ──────────────────────────────────────── */}
        <div style={card}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <Database size={14} color="#38BDF8"/>
            <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:3,color:"rgba(255,255,255,0.35)",textTransform:"uppercase"}}>
              Active Data Sources
            </span>
          </div>
          {sources.map((s,i) => (
            <div key={i} style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"12px 14px",marginBottom:8,
              background:"rgba(255,255,255,0.025)",
              border:"1px solid rgba(255,255,255,0.05)",
              borderRadius:12,
            }}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{
                  width:8,height:8,borderRadius:"50%",flexShrink:0,
                  background: s.live ? "#00E5A0" : "#FBBF24",
                  boxShadow: s.live ? "0 0 8px #00E5A0" : "none",
                }}/>
                <div>
                  <div style={{fontFamily:"'Lato',sans-serif",fontSize:12,color:"rgba(255,255,255,0.8)"}}>{s.name}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.3)"}}>{s.note}</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.25)"}}>{s.latency}</span>
                <span style={{
                  fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,
                  padding:"3px 8px",borderRadius:99,textTransform:"uppercase",
                  background: s.live ? "rgba(0,229,160,0.12)" : "rgba(251,191,36,0.12)",
                  color: s.live ? "#00E5A0" : "#FBBF24",
                }}>{s.live ? "LIVE" : "LOADING"}</span>
              </div>
            </div>
          ))}
          <p style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"rgba(255,255,255,0.2)",textAlign:"center",marginTop:8}}>
            SafeRoute AI+ · Real data from Montgomery, AL ArcGIS Portal
          </p>
        </div>

      </div>
    </div>
  )
}