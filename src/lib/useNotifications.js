/**
 * useNotifications — three-layer emergency notification system
 *
 * Layer 1: Guardian share link (clipboard + QR)
 * Layer 2: WhatsApp deep link (opens with prefilled message)
 * Layer 3: Email via EmailJS (actually sends, free tier)
 */
 
// ── COUNTRY CODES ─────────────────────────────────────────────
export const COUNTRY_CODES = [
  { code: "NG", dial: "+234", flag: "🇳🇬", name: "Nigeria"        },
  { code: "US", dial: "+1",   flag: "🇺🇸", name: "United States"  },
  { code: "GB", dial: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "GH", dial: "+233", flag: "🇬🇭", name: "Ghana"          },
  { code: "KE", dial: "+254", flag: "🇰🇪", name: "Kenya"          },
  { code: "ZA", dial: "+27",  flag: "🇿🇦", name: "South Africa"   },
  { code: "CA", dial: "+1",   flag: "🇨🇦", name: "Canada"         },
  { code: "AU", dial: "+61",  flag: "🇦🇺", name: "Australia"      },
  { code: "IN", dial: "+91",  flag: "🇮🇳", name: "India"          },
  { code: "DE", dial: "+49",  flag: "🇩🇪", name: "Germany"        },
  { code: "FR", dial: "+33",  flag: "🇫🇷", name: "France"         },
  { code: "BR", dial: "+55",  flag: "🇧🇷", name: "Brazil"         },
  { code: "NG", dial: "+234", flag: "🇳🇬", name: "Nigeria"        },
]
 
// ── GUARDIAN LINK ─────────────────────────────────────────────
export function generateGuardianLink(journey, userPos) {
  const base = window.location.origin
  const params = new URLSearchParams({
    from:  journey?.from     || "Origin",
    to:    journey?.to       || "Destination",
    lat:   userPos?.[1]      || 32.3668,
    lng:   userPos?.[0]      || -86.3006,
    start: new Date().toISOString(),
    eta:   journey?.duration || "Unknown",
    phone: journey?.guardianPhone || "",
  })
  return `${base}/watch?${params.toString()}`
}
 
export async function copyGuardianLink(journey, userPos) {
  const link = generateGuardianLink(journey, userPos)
  try {
    await navigator.clipboard.writeText(link)
    return { success: true, link }
  } catch {
    return { success: false, link }
  }
}
 
// ── BATTERY ───────────────────────────────────────────────────
export async function getBatteryLevel() {
  try {
    const b = await navigator.getBattery?.()
    if (b) return `${Math.round(b.level * 100)}%`
  } catch {}
  return "Unknown"
}
 
// ── DISTRESS BROADCAST ────────────────────────────────────────
// Six preset messages — maps preset id → human readable text
export const DISTRESS_PRESETS = [
  { id: "followed",   label: "I'M BEING FOLLOWED",          icon: "👁",  color: "coral"  },
  { id: "cornered",   label: "I'M CORNERED / TRAPPED",      icon: "🚨",  color: "coral"  },
  { id: "threatened", label: "SOMEONE IS THREATENING ME",   icon: "⚠️",  color: "coral"  },
  { id: "unsafe",     label: "I FEEL UNSAFE — WATCHING ME", icon: "😰",  color: "amber"  },
  { id: "cantTalk",   label: "NEED HELP, CAN'T TALK",       icon: "🤫",  color: "amber"  },
  { id: "location",   label: "SEND MY LOCATION NOW",        icon: "📍",  color: "sky"    },
]
 
export async function buildDistressMessage(presetId, customText, journey, userPos) {
  const preset  = DISTRESS_PRESETS.find(p => p.id === presetId)
  const label   = preset?.label || customText || "DISTRESS ALERT"
  const lat     = userPos?.[1] || 32.3668
  const lng     = userPos?.[0] || -86.3006
  const maps    = `https://maps.google.com/?q=${lat},${lng}`
  const time    = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  const battery = await getBatteryLevel()
  const route   = journey?.from && journey?.to ? `${journey.from} → ${journey.to}` : "Montgomery, AL"
 
  const detail  = customText && customText !== label ? `\nDetail: "${customText}"` : ""
 
  return [
    `🚨 DISTRESS ALERT — SafeRoute AI+`,
    ``,
    `MESSAGE: ${label}${detail}`,
    ``,
    `Time: ${time}`,
    `Location: ${maps}`,
    `Route: ${route}`,
    `Battery: ${battery}`,
    ``,
    `PLEASE RESPOND IMMEDIATELY or call emergency services.`,
  ].join("\n")
}
 
export async function fireDistressAlerts(contacts, presetId, customText, journey, userPos) {
  const message = await buildDistressMessage(presetId, customText, journey, userPos)
  const results = []
 
  for (const contact of contacts) {
    if (contact.phone) {
      const dialCode = (contact.dialCode || "+1").replace("+", "")
      const number   = (contact.phone || "").replace(/\D/g, "")
      const url      = `https://wa.me/${dialCode}${number}?text=${encodeURIComponent(message)}`
      window.open(url, "_blank", "noopener")
      results.push({ success: true, channel: "whatsapp", contact: contact.name })
    }
    if (contact.email) {
      const r = await sendEmergencyEmail(contact, journey, userPos, 3)
      results.push(r)
    }
  }
 
  // Always copy guardian link + distress text to clipboard
  try {
    const link = generateGuardianLink(journey, userPos)
    await navigator.clipboard.writeText(`${message}\n\nLive watch: ${link}`)
    results.push({ success: true, channel: "clipboard" })
  } catch {
    results.push({ success: false, channel: "clipboard" })
  }
 
  return results
}
 
// ── WHATSAPP ──────────────────────────────────────────────────
export function buildWhatsAppMessage(contact, journey, userPos, level = 2) {
  const name     = contact.name      || "the traveler"
  const from     = journey?.from     || "their origin"
  const to       = journey?.to       || "their destination"
  const eta      = journey?.duration || "unknown duration"
  const time     = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  const lat      = userPos?.[1]      || 32.3668
  const lng      = userPos?.[0]      || -86.3006
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`
  const mode     = journey?.transportMode || "traveling"
 
  const messages = {
    1: `Hi, this is a safety check from SafeRoute AI+. ${name} is ${mode} from ${from} to ${to} and has not confirmed safety. Last seen: ${mapsLink} at ${time}. Please check in with them.`,
    2: `SAFETY ALERT from SafeRoute AI+: ${name} started a journey from ${from} to ${to} (ETA: ${eta}) at ${time} and has not responded to check-in prompts. Last known location: ${mapsLink}. Please contact them immediately.`,
    3: `EMERGENCY: SafeRoute AI+ has triggered an emergency alert for ${name}. They were ${mode} from ${from} to ${to}. Last known GPS location: ${mapsLink} (${time}). Immediate assistance may be needed. Please call them now or contact emergency services.`,
  }
 
  return messages[level] || messages[2]
}
 
export function openWhatsApp(contact, journey, userPos, level = 2) {
  const dialCode = contact.dialCode || "+1"
  const number   = (contact.phone || "").replace(/\D/g, "")
  const fullNum  = `${dialCode.replace("+", "")}${number}`
  const message  = buildWhatsAppMessage(contact, journey, userPos, level)
  const url      = `https://wa.me/${fullNum}?text=${encodeURIComponent(message)}`
  window.open(url, "_blank", "noopener")
  return { success: true, channel: "whatsapp", contact: contact.name }
}
 
// ── EMAIL via EmailJS ─────────────────────────────────────────
export async function sendEmergencyEmail(contact, journey, userPos, level = 2) {
  const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
  const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
  const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY
 
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    // EmailJS not configured — log for demo, return graceful failure
    console.info("[SafeRoute] EmailJS not configured — skipping email notification")
    return { success: false, channel: "email", reason: "not_configured" }
  }
 
  const lat      = userPos?.[1] || 32.3668
  const lng      = userPos?.[0] || -86.3006
  const mapsLink = `https://maps.google.com/?q=${lat},${lng}`
 
  try {
    // Use EmailJS REST API directly — no npm package needed
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id:  SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id:     PUBLIC_KEY,
        template_params: {
          to_name:       contact.name          || "Guardian",
          to_email:      contact.email         || "",
          traveler_name: "SafeRoute User",
          from_location: journey?.from         || "Origin",
          to_location:   journey?.to           || "Destination",
          transport:     journey?.transportMode || "traveling",
          eta:           journey?.duration      || "unknown",
          maps_link:     mapsLink,
          alert_time:    new Date().toLocaleString(),
          alert_level:   level === 3 ? "EMERGENCY" : level === 2 ? "URGENT" : "CHECK-IN",
        },
      }),
    })
    if (!res.ok) throw new Error(`EmailJS ${res.status}`)
    return { success: true, channel: "email", contact: contact.name }
  } catch (err) {
    console.error("[SafeRoute] EmailJS error:", err)
    return { success: false, channel: "email", reason: err.message }
  }
}
 
// ── FIRE ALL CHANNELS ─────────────────────────────────────────
export async function fireAllAlerts(contacts, journey, userPos, level = 2) {
  const results = []
 
  for (const contact of contacts) {
    // WhatsApp — open in new tab for each contact
    if (contact.phone) {
      const r = openWhatsApp(contact, journey, userPos, level)
      results.push(r)
    }
    // Email — async send
    if (contact.email) {
      const r = await sendEmergencyEmail(contact, journey, userPos, level)
      results.push(r)
    }
  }
 
  // Guardian link — copy to clipboard
  const linkResult = await copyGuardianLink(journey, userPos)
  results.push({ ...linkResult, channel: "guardian_link" })
 
  return results
}
 
// ── LOAD CONTACTS from localStorage ──────────────────────────
export function loadGuardianContacts() {
  try {
    return JSON.parse(localStorage.getItem("saferoute_contacts") || "[]")
  } catch { return [] }
}
 
export function saveGuardianContacts(contacts) {
  try {
    localStorage.setItem("saferoute_contacts", JSON.stringify(contacts))
    return true
  } catch { return false }
}