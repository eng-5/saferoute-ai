/**
 * OnboardingModal.jsx — SafeRoute AI+ Welcome Tutorial
 * Built with TUTORIALMAKER v2.1 framework
 *
 * Shows on first visit (localStorage key: saferoute_onboarded)
 * Expandable feature cards, keyboard navigation, ARIA compliant
 * Matches SafeRoute AI+ design system exactly
 *
 * Usage:
 *   import { OnboardingModal } from "@/components/onboarding-modal"
 *   <OnboardingModal />   ← drop anywhere inside AppShell (auto-shows on first visit)
 *
 *   Or force-show for demo:
 *   <OnboardingModal forceShow />
 */
 
import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Shield, MapPin, Navigation, AlertTriangle, Radio,
  ChevronDown, X, Zap, Map, Activity, Users, Brain,
  ArrowRight, Eye
} from "lucide-react"
 
// ── STORAGE KEY ───────────────────────────────────────────────
const STORAGE_KEY = "saferoute_onboarded"
 
// ── FEATURE DATA ──────────────────────────────────────────────
const FEATURES = [
  {
    id: "live-intelligence",
    icon: Map,
    iconColor: "text-mint",
    borderColor: "border-mint/30",
    bgColor: "bg-mint/8",
    dotColor: "bg-mint",
    title: "Live Risk Intelligence",
    brief: "Real ArcGIS data scores every neighborhood in real-time.",
    details: {
      heading: "What the AI sees right now",
      bullets: [
        { label: "Live incident data", text: "Fire & rescue incidents pulled from Montgomery's ArcGIS portal every 5 minutes — real addresses, real coordinates." },
        { label: "Neighborhood risk scores", text: "7 city districts scored 0–99 using live fire incidents, 311 complaints, and historical patterns. Green = safe. Red = avoid." },
        { label: "Community reports", text: "Residents tap the radio button to report hazards anonymously — pins appear on the map within seconds." },
        { label: "AI news context", text: "Local Montgomery news is scraped and fed into the AI so answers reflect what's happening today, not last month." },
      ],
      tip: "Click any colored zone on the dashboard map to see its live risk breakdown.",
    },
  },
  {
    id: "safe-journey",
    icon: Navigation,
    iconColor: "text-sky",
    borderColor: "border-sky/30",
    bgColor: "bg-sky/8",
    dotColor: "bg-sky",
    title: "Safe Journey Planner",
    brief: "3 AI-scored routes with real safety data — not just speed.",
    details: {
      heading: "How routes are scored",
      bullets: [
        { label: "Three distinct options", text: "Safest (solid green), Balanced (dashed amber), Fastest (dotted coral) — each scored against live incidents within 800m of the path." },
        { label: "Voice input", text: "Tap the mic icon to speak your destination. AI matches your speech to real Montgomery streets automatically." },
        { label: "Transport modes", text: "Walking, running, cycling, and driving each use the correct Mapbox profile with speed-adjusted ETAs." },
        { label: "Live scoring", text: "Route confidence % = 100 minus risk score. A 94% confidence route has almost no incidents along its corridor." },
      ],
      tip: "Select a route card then tap 'START SAFE JOURNEY' — your guardian contacts are notified automatically.",
    },
  },
  {
    id: "active-monitor",
    icon: Activity,
    iconColor: "text-amber2",
    borderColor: "border-amber2/30",
    bgColor: "bg-amber2/8",
    dotColor: "bg-amber2",
    title: "Active Journey Monitor",
    brief: "AI watches your movement and raises alerts when something's wrong.",
    details: {
      heading: "Smart detection triggers",
      bullets: [
        { label: "Check-in countdown", text: "A 3-minute timer counts down. Tap 'I'M SAFE' to reset it. Miss it and the system escalates automatically." },
        { label: "Stopped detection", text: "If you're stationary longer than normal for your transport mode, the AI asks if you're okay." },
        { label: "Off-route detection", text: "Stray more than 80m (walking) or 150m (driving) from your route for 60 seconds and an alert triggers." },
        { label: "Speed anomaly", text: "Sudden stops or speed changes inconsistent with your mode flag a Level 1 check-in." },
      ],
      tip: "The ETA and distance remaining update in real-time based on your actual route duration — not a fixed timer.",
    },
  },
  {
    id: "crisis-companion",
    icon: Shield,
    iconColor: "text-coral",
    borderColor: "border-coral/30",
    bgColor: "bg-coral/8",
    dotColor: "bg-coral",
    title: "Crisis Companion",
    brief: "Three escalation levels — from gentle nudge to full emergency dispatch.",
    details: {
      heading: "How the alert system works",
      bullets: [
        { label: "Level 1 — Soft check", text: "A small card appears asking 'Are you still safe?' with a 2-minute auto-escalation timeout." },
        { label: "Level 2 — Urgent", text: "Full-screen modal with 60-second countdown. Miss it and guardian contacts are alerted via WhatsApp and email." },
        { label: "Level 3 — Emergency", text: "Contacts receive WhatsApp messages and emails instantly with your last known GPS coordinates and a Google Maps link." },
        { label: "Guardian contacts", text: "Add up to 3 guardians in Settings with international phone numbers (supports 13 country codes). Test them before you travel." },
      ],
      tip: "Tap the SOS button at any time to jump straight to Level 3 and alert everyone immediately.",
    },
  },
  {
    id: "community",
    icon: Radio,
    iconColor: "text-purple",
    borderColor: "border-purple/30",
    bgColor: "bg-purple/8",
    dotColor: "bg-purple",
    title: "Community Intelligence",
    brief: "Anonymous reports from nearby users keep the map honest.",
    details: {
      heading: "How community reporting works",
      bullets: [
        { label: "Anonymous & rate-limited", text: "Reports are GPS-stamped but never linked to identity. Maximum 3 per hour, same category locked for 10 minutes." },
        { label: "5 report categories", text: "Suspicious activity, broken street lights, road hazards, unsafe area feeling, and general other concerns." },
        { label: "Broadcast toasts", text: "When someone near you files a report, a notification slides in from the top with a 45-second timer. Tap to fly the map to the exact location." },
        { label: "Time-decay opacity", text: "Report markers fade over 24–48 hours so the map always shows what's recent, not a cluttered history." },
      ],
      tip: "Tap the Radio icon on the Dashboard map to file a report — your GPS is captured automatically.",
    },
  },
]
 
// ── FEATURE CARD ──────────────────────────────────────────────
function FeatureCard({ feature, isExpanded, onToggle }) {
  const Icon = feature.icon
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-controls={`${feature.id}-details`}
      onClick={onToggle}
      onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle())}
      className={`rounded-xl border cursor-pointer transition-all select-none ${
        isExpanded
          ? `${feature.borderColor} ${feature.bgColor}`
          : "border-border/40 hover:border-border/70"
      }`}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 p-3.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${feature.bgColor} border ${feature.borderColor}`}>
          <Icon className={`w-4.5 h-4.5 ${feature.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-sans text-sm font-medium text-foreground">{feature.title}</div>
          <div className="font-mono text-[10px] text-muted-foreground leading-snug">{feature.brief}</div>
        </div>
        <div className={`flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
          <ChevronDown className={`w-4 h-4 ${isExpanded ? feature.iconColor : "text-muted-foreground/50"}`} />
        </div>
      </div>
 
      {/* Expandable details */}
      {isExpanded && (
        <div id={`${feature.id}-details`} className="px-3.5 pb-3.5">
          <div className={`rounded-lg border ${feature.borderColor} p-3 space-y-2`}>
            <p className={`font-mono text-[10px] uppercase tracking-wider ${feature.iconColor} mb-2`}>
              {feature.details.heading}
            </p>
            <ul className="space-y-2">
              {feature.details.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${feature.dotColor} flex-shrink-0 mt-1.5`} />
                  <span className="font-sans text-xs text-foreground leading-relaxed">
                    <strong className="font-medium">{b.label}:</strong>{" "}
                    <span className="text-muted-foreground">{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className={`mt-2 pt-2 border-t ${feature.borderColor} flex items-start gap-2`}>
              <Zap className={`w-3 h-3 ${feature.iconColor} flex-shrink-0 mt-0.5`} />
              <p className="font-mono text-[10px] text-muted-foreground/70 italic leading-relaxed">
                {feature.details.tip}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
 
// ── MAIN COMPONENT ────────────────────────────────────────────
export function OnboardingModal({ forceShow = false, onClose }) {
  const navigate    = useNavigate()
  const modalRef    = useRef(null)
  const closeRef    = useRef(null)
  const [visible,       setVisible]       = useState(false)
  const [expandedId,    setExpandedId]    = useState(null)
  const [dontShowAgain, setDontShowAgain] = useState(false)
 
  // ── SHOW LOGIC ──────────────────────────────────────────────
  useEffect(() => {
    if (forceShow) { setVisible(true); return }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch { setVisible(true) }
  }, [forceShow])
 
  // Focus first button when modal opens
  useEffect(() => {
    if (visible) setTimeout(() => closeRef.current?.focus(), 100)
  }, [visible])
 
  // ── DISMISS ─────────────────────────────────────────────────
  const dismiss = useCallback((action = "skip") => {
    if (dontShowAgain || action === "start") {
      try { localStorage.setItem(STORAGE_KEY, "1") } catch {}
    }
    setVisible(false)
    onClose?.()
    if (action === "start") navigate("/journey")
  }, [dontShowAgain, navigate, onClose])
 
  // Escape key
  useEffect(() => {
    if (!visible) return
    const h = e => { if (e.key === "Escape") dismiss("escape") }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [visible, dismiss])
 
  // Trap focus inside modal
  useEffect(() => {
    if (!visible || !modalRef.current) return
    const focusable = modalRef.current.querySelectorAll(
      'button, [tabindex="0"], input, a[href]'
    )
    const first = focusable[0]
    const last  = focusable[focusable.length - 1]
    const trap  = e => {
      if (e.key !== "Tab") return
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus() } }
      else { if (document.activeElement === last) { e.preventDefault(); first?.focus() } }
    }
    document.addEventListener("keydown", trap)
    return () => document.removeEventListener("keydown", trap)
  }, [visible, expandedId])
 
  if (!visible) return null
 
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-desc"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: "rgba(5,7,15,0.85)", backdropFilter: "blur(8px)" }}
      onClick={e => { if (e.target === e.currentTarget) dismiss("overlay") }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-2xl glass border border-amber2/25 shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          ref={closeRef}
          onClick={() => dismiss("close")}
          aria-label="Close tutorial"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-bg3 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
 
        {/* ── HEADER ────────────────────────────────────────── */}
        <div className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-3 mb-3">
            {/* Animated shield logo */}
            <div className="relative w-12 h-12 flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-amber2/20 animate-ping-marker opacity-60" />
              <div className="relative w-12 h-12 rounded-full bg-amber2/10 border border-amber2/30 flex items-center justify-center">
                <Shield className="w-6 h-6 text-amber2" />
              </div>
            </div>
            <div>
              <h2 id="onboarding-title" className="font-serif italic text-2xl text-foreground leading-tight">
                Welcome to <span className="text-amber2">SafeRoute AI+</span>
              </h2>
              <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
                Montgomery, Alabama · Civic Safety Platform
              </p>
            </div>
          </div>
          <p id="onboarding-desc" className="font-sans text-sm text-muted-foreground leading-relaxed">
            Your AI-powered safety companion — real live data, intelligent routing,
            and a crisis system that watches over you every step of the way.
          </p>
 
          {/* Live data badge */}
          <div className="flex items-center gap-4 mt-3">
            {[
              { dot: "bg-mint",   label: "ArcGIS Live Data" },
              { dot: "bg-sky",    label: "Mapbox Routing"   },
              { dot: "bg-purple", label: "Groq LLaMA 3.3"   },
            ].map(({ dot, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dot} animate-pulse-dot`} />
                <span className="font-mono text-[9px] text-muted-foreground uppercase">{label}</span>
              </div>
            ))}
          </div>
        </div>
 
        {/* ── FEATURE CARDS ─────────────────────────────────── */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider">
              Tap any feature to explore — 5 core capabilities
            </span>
          </div>
 
          {FEATURES.map(feature => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              isExpanded={expandedId === feature.id}
              onToggle={() => setExpandedId(expandedId === feature.id ? null : feature.id)}
            />
          ))}
        </div>
 
        {/* ── STATS ROW ─────────────────────────────────────── */}
        <div className="mx-4 mb-4 grid grid-cols-3 gap-2">
          {[
            { value: "7",    label: "Districts",    color: "text-mint"   },
            { value: "Live", label: "Incidents",    color: "text-coral"  },
            { value: "3",    label: "Route Options", color: "text-sky"   },
          ].map(({ value, label, color }) => (
            <div key={label} className="bg-bg3 rounded-xl p-2.5 text-center border border-border/30">
              <div className={`font-serif italic text-xl ${color}`}>{value}</div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">{label}</div>
            </div>
          ))}
        </div>
 
        {/* ── FOOTER ────────────────────────────────────────── */}
        <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-4">
          {/* Primary CTA */}
          <button
            onClick={() => dismiss("start")}
            className="btn-mint-gradient w-full py-4 rounded-xl font-mono text-sm text-bg font-bold flex items-center justify-center gap-3"
          >
            <Navigation className="w-5 h-5" />
            PLAN MY FIRST SAFE JOURNEY
            <ArrowRight className="w-4 h-4" />
          </button>
 
          {/* Secondary action */}
          <button
            onClick={() => dismiss("skip")}
            className="w-full py-2.5 rounded-xl border border-border text-muted-foreground font-mono text-xs uppercase hover:border-border/70 hover:text-foreground transition-colors"
          >
            Explore the Dashboard First
          </button>
 
          {/* Don't show again */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              role="checkbox"
              aria-checked={dontShowAgain}
              tabIndex={0}
              onClick={() => setDontShowAgain(d => !d)}
              onKeyDown={e => (e.key === " " || e.key === "Enter") && setDontShowAgain(d => !d)}
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                dontShowAgain
                  ? "bg-amber2 border-amber2"
                  : "border-border group-hover:border-amber2/50"
              }`}
            >
              {dontShowAgain && (
                <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-bg">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
              Don't show this again
            </span>
          </label>
        </div>
 
        {/* ── FOOTER NOTE ───────────────────────────────────── */}
        <div className="px-4 pb-4 text-center">
          <p className="font-mono text-[9px] text-muted-foreground/40">
            Data sourced from City of Montgomery ArcGIS Open Data Portal ·
            Built for World Wide Vibes Hackathon 2026
          </p>
        </div>
      </div>
    </div>
  )
}
 
/**
 * Hook to manually trigger the onboarding modal from anywhere
 *
 * Usage:
 *   const { showOnboarding } = useOnboarding()
 *   <button onClick={showOnboarding}>Show Tutorial</button>
 */
export function useOnboarding() {
  const resetOnboarding = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    window.location.reload()
  }, [])
 
  return { resetOnboarding }
}