import { useState, useEffect } from "react"
import { GlassPanel } from "@/components/glass-panel"
import { COUNTRY_CODES, loadGuardianContacts, saveGuardianContacts, openWhatsApp, sendEmergencyEmail } from "@/lib/useNotifications"
import {
  UserPlus, Phone, Mail, Trash2, ChevronDown,
  Check, AlertCircle, Send, Shield, X
} from "lucide-react"

const RELATIONSHIPS = ["Partner", "Parent", "Sibling", "Friend", "Colleague", "Other"]

const EMPTY_CONTACT = {
  id:         "",
  name:       "",
  relation:   "Friend",
  dialCode:   "+234",
  phone:      "",
  email:      "",
}

function ContactCard({ contact, onEdit, onDelete, onTest, testing }) {
  return (
    <GlassPanel className="p-4 border border-border/50">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber2/15 border border-amber2/25 flex items-center justify-center flex-shrink-0">
          <span className="font-mono text-sm font-bold text-amber2">
            {contact.name?.[0]?.toUpperCase() || "?"}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-sans text-sm font-medium text-foreground">{contact.name}</span>
            <span className="px-1.5 py-0.5 rounded-full bg-bg3 font-mono text-[8px] text-muted-foreground uppercase">
              {contact.relation}
            </span>
          </div>
          <div className="space-y-0.5">
            {contact.phone && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <Phone className="w-3 h-3 text-sky" />
                {contact.dialCode} {contact.phone}
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                <Mail className="w-3 h-3 text-mint" />
                {contact.email}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={() => onTest(contact)}
            disabled={testing === contact.id}
            className="px-2.5 py-1.5 rounded-lg bg-sky/10 border border-sky/25 text-sky font-mono text-[9px] uppercase flex items-center gap-1 hover:bg-sky/20 transition-colors disabled:opacity-50">
            {testing === contact.id
              ? <><AlertCircle className="w-3 h-3 animate-pulse" /> Sending...</>
              : <><Send className="w-3 h-3" /> Test</>
            }
          </button>
          <button onClick={() => onDelete(contact.id)}
            className="px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground font-mono text-[9px] uppercase flex items-center gap-1 hover:border-coral/40 hover:text-coral transition-colors">
            <Trash2 className="w-3 h-3" /> Remove
          </button>
        </div>
      </div>
    </GlassPanel>
  )
}

function ContactForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { ...EMPTY_CONTACT, id: Date.now().toString() })
  const [showDialDrop, setShowDialDrop] = useState(false)
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.name.trim())              e.name  = "Name required"
    if (!form.phone && !form.email)     e.contact = "Phone or email required"
    if (form.phone && !/^\d{6,15}$/.test(form.phone.replace(/\s/g, "")))
                                        e.phone = "Invalid phone number"
    if (form.email && !/\S+@\S+\.\S+/.test(form.email))
                                        e.email = "Invalid email"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => { if (validate()) onSave(form) }

  const selectedCountry = COUNTRY_CODES.find(c => c.dial === form.dialCode) || COUNTRY_CODES[0]

  return (
    <GlassPanel className="p-4 border border-amber2/25 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[10px] text-amber2 uppercase tracking-wider">
          {initial?.id ? "Edit Contact" : "Add Guardian Contact"}
        </span>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="font-mono text-[9px] text-muted-foreground uppercase mb-1 block">Full Name</label>
        <input value={form.name} onChange={e => set("name", e.target.value)}
          placeholder="e.g. Sarah Johnson"
          className="w-full bg-bg3 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-amber2/50" />
        {errors.name && <p className="font-mono text-[9px] text-coral mt-1">{errors.name}</p>}
      </div>

      {/* Relationship */}
      <div>
        <label className="font-mono text-[9px] text-muted-foreground uppercase mb-1 block">Relationship</label>
        <div className="flex flex-wrap gap-1.5">
          {RELATIONSHIPS.map(r => (
            <button key={r} onClick={() => set("relation", r)}
              className={`px-2.5 py-1 rounded-full border font-mono text-[9px] uppercase transition-colors ${
                form.relation === r
                  ? "border-amber2/50 bg-amber2/15 text-amber2"
                  : "border-border text-muted-foreground hover:border-border/70"
              }`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Phone with country code */}
      <div>
        <label className="font-mono text-[9px] text-muted-foreground uppercase mb-1 block">
          WhatsApp / Phone
        </label>
        <div className="flex gap-2">
          {/* Country code picker */}
          <div className="relative">
            <button onClick={() => setShowDialDrop(d => !d)}
              className="flex items-center gap-1.5 px-2.5 py-2 bg-bg3 border border-border rounded-lg hover:border-border/70 transition-colors min-w-[80px]">
              <span className="text-base">{selectedCountry.flag}</span>
              <span className="font-mono text-[10px] text-foreground">{selectedCountry.dial}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
            {showDialDrop && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-bg2 border border-border rounded-xl shadow-2xl max-h-48 overflow-y-auto min-w-[200px]">
                {COUNTRY_CODES.filter((c, i, a) => a.findIndex(x => x.dial === c.dial) === i).map(c => (
                  <button key={c.code} onClick={() => { set("dialCode", c.dial); setShowDialDrop(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-bg3 transition-colors text-left">
                    <span className="text-base">{c.flag}</span>
                    <span className="font-sans text-xs text-foreground flex-1">{c.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{c.dial}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input value={form.phone} onChange={e => set("phone", e.target.value)}
            placeholder="8012345678"
            className="flex-1 bg-bg3 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-sky/50" />
        </div>
        {errors.phone && <p className="font-mono text-[9px] text-coral mt-1">{errors.phone}</p>}
      </div>

      {/* Email */}
      <div>
        <label className="font-mono text-[9px] text-muted-foreground uppercase mb-1 block">
          Email (for emergency reports)
        </label>
        <input value={form.email} onChange={e => set("email", e.target.value)}
          placeholder="guardian@example.com" type="email"
          className="w-full bg-bg3 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-mint/50" />
        {errors.email   && <p className="font-mono text-[9px] text-coral mt-1">{errors.email}</p>}
        {errors.contact && <p className="font-mono text-[9px] text-coral mt-1">{errors.contact}</p>}
      </div>

      <button onClick={handleSave}
        className="w-full py-3 rounded-xl bg-amber2/15 border border-amber2/35 text-amber2 font-mono text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-amber2/25 transition-colors">
        <Check className="w-3.5 h-3.5" /> Save Contact
      </button>
    </GlassPanel>
  )
}

export function GuardianContacts() {
  const [contacts, setContacts] = useState([])
  const [showForm,  setShowForm]  = useState(false)
  const [testing,   setTesting]   = useState(null)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => { setContacts(loadGuardianContacts()) }, [])

  const save = (contact) => {
    const updated = contacts.find(c => c.id === contact.id)
      ? contacts.map(c => c.id === contact.id ? contact : c)
      : [...contacts, contact]
    setContacts(updated)
    saveGuardianContacts(updated)
    setShowForm(false)
  }

  const remove = (id) => {
    const updated = contacts.filter(c => c.id !== id)
    setContacts(updated)
    saveGuardianContacts(updated)
  }

  const test = async (contact) => {
    setTesting(contact.id)
    setTestResult(null)
    const mockJourney = {
      from: "Downtown Montgomery", to: "Oak Park",
      duration: "14 min", transportMode: "walking"
    }
    const mockPos = [-86.3006, 32.3668]
    const results = []
    if (contact.phone) results.push(openWhatsApp(contact, mockJourney, mockPos, 1))
    if (contact.email) {
      const r = await sendEmergencyEmail(contact, mockJourney, mockPos, 1)
      results.push(r)
    }
    setTesting(null)
    const success = results.some(r => r.success)
    setTestResult({ success, name: contact.name })
    setTimeout(() => setTestResult(null), 4000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber2" />
          <h3 className="font-mono text-[10px] text-muted-foreground uppercase">Guardian Contacts</h3>
        </div>
        <span className="font-mono text-[9px] text-muted-foreground/50">{contacts.length}/3</span>
      </div>

      <p className="font-sans text-[11px] text-muted-foreground leading-relaxed">
        These contacts receive WhatsApp messages and emails if you don't respond to safety check-ins during a journey.
      </p>

      {testResult && (
        <div className={`p-3 rounded-xl border font-mono text-[10px] flex items-center gap-2 ${
          testResult.success
            ? "bg-mint/8 border-mint/25 text-mint"
            : "bg-amber/8 border-amber/25 text-amber"
        }`}>
          {testResult.success
            ? <><Check className="w-3.5 h-3.5" /> Test sent to {testResult.name} — check WhatsApp</>
            : <><AlertCircle className="w-3.5 h-3.5" /> Test sent (email requires EmailJS config)</>
          }
        </div>
      )}

      <div className="space-y-2">
        {contacts.map(c => (
          <ContactCard key={c.id} contact={c}
            onEdit={() => {}} onDelete={remove}
            onTest={test} testing={testing} />
        ))}
      </div>

      {contacts.length < 3 && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl border border-dashed border-border text-muted-foreground font-mono text-[10px] uppercase flex items-center justify-center gap-2 hover:border-amber2/40 hover:text-amber2 transition-colors">
          <UserPlus className="w-3.5 h-3.5" /> Add Guardian Contact
        </button>
      )}

      {showForm && (
        <ContactForm onSave={save} onCancel={() => setShowForm(false)} />
      )}

      {contacts.length === 0 && !showForm && (
        <div className="text-center py-3">
          <p className="font-mono text-[9px] text-muted-foreground/50">
            No contacts added. Add at least one guardian for full protection.
          </p>
        </div>
      )}
    </div>
  )
}