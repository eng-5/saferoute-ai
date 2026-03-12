// ── SAFEROUTE AI+ AUDIO UTILITIES ────────────────────────────
// All sounds generated via Web Audio API — zero asset dependency.
// Respects saferoute_sound setting in localStorage.
 
function isSoundEnabled() {
  try { return localStorage.getItem("saferoute_sound") !== "false" }
  catch { return true }
}
 
function createCtx() {
  try {
    return new (window.AudioContext || window.webkitAudioContext)()
  } catch { return null }
}
 
/**
 * Soft sine-wave chime — used for community broadcast notifications.
 * ~200ms, gentle 880→660 sweep, quiet volume.
 * Caller must have had a prior user gesture (browser requirement).
 */
export function playBroadcastPing() {
  if (!isSoundEnabled()) return
  const ctx = createCtx()
  if (!ctx) return
 
  try {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
 
    osc.type = "sine"
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18)
 
    gain.gain.setValueAtTime(0.22, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22)
 
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.25)
 
    // Clean up after playback
    osc.onended = () => { try { ctx.close() } catch {} }
  } catch {}
}
 
/**
 * Sharper double-beep — reserved for crisis / SOS alerts.
 * More urgent than the broadcast ping.
 */
export function playCrisisAlert() {
  if (!isSoundEnabled()) return
  const ctx = createCtx()
  if (!ctx) return
 
  try {
    const beep = (startTime) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "square"
      osc.frequency.setValueAtTime(1200, startTime)
      gain.gain.setValueAtTime(0.15, startTime)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12)
      osc.start(startTime)
      osc.stop(startTime + 0.14)
    }
 
    beep(ctx.currentTime)
    beep(ctx.currentTime + 0.2)
 
    setTimeout(() => { try { ctx.close() } catch {} }, 600)
  } catch {}
}
 
/**
 * Short double-vibrate haptic — confirms distress message was sent.
 * Sound plays only in non-stealth mode; vibrate fires regardless.
 */
export function playDistressConfirm() {
  try { navigator.vibrate?.([100, 50, 100]) } catch {}
  if (!isSoundEnabled()) return
  const ctx = createCtx()
  if (!ctx) return
  try {
    const beep = (t) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.setValueAtTime(520, t)
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.08)
      gain.gain.setValueAtTime(0.18, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
      osc.start(t); osc.stop(t + 0.14)
    }
    beep(ctx.currentTime)
    beep(ctx.currentTime + 0.22)
    setTimeout(() => { try { ctx.close() } catch {} }, 700)
  } catch {}
}
 
/**
 * Stealth-mode confirm — silent vibrate only. No sound.
 * Lets the user know the message sent without making any noise.
 */
export function playStealthConfirm() {
  try { navigator.vibrate?.([60, 40, 60, 40, 200]) } catch {}
  // Intentionally no audio in stealth mode
}
 
/**
 * Realistic fake ringtone using two oscillators.
 * Mimics the double-ring pattern of a mobile phone.
 * Returns a stop function — call it when the user accepts or the call ends.
 */
export function playFakeRing() {
  try { navigator.vibrate?.([400, 200, 400, 800, 400, 200, 400]) } catch {}
  if (!isSoundEnabled()) return () => {}
 
  let stopped = false
  let currentCtx = null
 
  const ring = () => {
    if (stopped) return
    const ctx = createCtx()
    if (!ctx) return
    currentCtx = ctx
 
    try {
      // Two-tone ring pattern: 440Hz + 480Hz mixed (classic phone ring)
      const makeRingTone = (start, dur) => {
        [440, 480].forEach(freq => {
          const osc  = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = "sine"
          osc.frequency.setValueAtTime(freq, start)
          gain.gain.setValueAtTime(0, start)
          gain.gain.linearRampToValueAtTime(0.08, start + 0.04)
          gain.gain.setValueAtTime(0.08, start + dur - 0.04)
          gain.gain.linearRampToValueAtTime(0, start + dur)
          osc.start(start); osc.stop(start + dur)
        })
      }
 
      // Ring twice, 0.4s each, with 0.2s gap — then silence for 2s
      makeRingTone(ctx.currentTime, 0.4)
      makeRingTone(ctx.currentTime + 0.6, 0.4)
 
      setTimeout(() => {
        try { ctx.close() } catch {}
        // Repeat the ring pattern
        setTimeout(ring, 2000)
      }, 1200)
    } catch {
      try { ctx.close() } catch {}
    }
  }
 
  ring()
 
  return () => {
    stopped = true
    try { currentCtx?.close() } catch {}
    try { navigator.vibrate?.(0) } catch {}
  }
}
 
/**
 * Synthesised one-sided conversation audio.
 * Plays a convincing muffled "voice on the other end" for 45 seconds.
 * Returns a stop function.
 */
export function playFakeCallVoice() {
  if (!isSoundEnabled()) return () => {}
 
  let stopped = false
  const timers = []
 
  // Generate a segment of "voice-like" audio: band-pass filtered noise
  // with amplitude modulation that mimics speech rhythm
  const voiceSegment = (ctx, startTime, duration) => {
    try {
      const bufSize = Math.ceil(ctx.sampleRate * duration)
      const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate)
      const data    = buffer.getChannelData(0)
 
      // Brown noise base — warmer than white, closer to a voice
      let lastOut = 0
      for (let i = 0; i < bufSize; i++) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + (0.02 * white)) / 1.02
        data[i] = lastOut * 12  // boost
      }
 
      const src    = ctx.createBufferSource()
      src.buffer   = buffer
 
      // Band-pass filter centered at 300Hz — telephone voice frequency
      const bpf = ctx.createBiquadFilter()
      bpf.type = "bandpass"
      bpf.frequency.value = 300
      bpf.Q.value = 0.8
 
      // Low-pass to remove harshness
      const lpf = ctx.createBiquadFilter()
      lpf.type = "lowpass"
      lpf.frequency.value = 3400
 
      // Gain envelope — speech has natural pauses
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.06, startTime + 0.05)
      gain.gain.setValueAtTime(0.06, startTime + duration - 0.1)
      gain.gain.linearRampToValueAtTime(0, startTime + duration)
 
      src.connect(bpf); bpf.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination)
      src.start(startTime); src.stop(startTime + duration)
    } catch {}
  }
 
  // Schedule a realistic one-sided conversation pattern over 45 seconds
  // Pattern: voice(3s), pause(2s), voice(4s), pause(1.5s), voice(2s), pause(3s)...
  const schedule = [
    [0,    3.2],   // "Hey! Yeah I can see you're on your way"
    [5.5,  2.8],   // "Yeah it's fine, I'll be here"
    [9.5,  4.1],   // "Actually I wanted to ask you something when you get here"
    [15.0, 1.9],   // "Oh really?"
    [18.2, 3.5],   // "Yeah no worries, take your time"
    [23.5, 2.2],   // "Okay sounds good"
    [27.5, 4.8],   // "I'll let your mum know you're on your way as well"
    [34.5, 2.5],   // "Alright, see you soon"
    [38.5, 1.8],   // "Bye!"
  ]
 
  let ctx = null
  try {
    ctx = createCtx()
    if (!ctx) return () => {}
 
    schedule.forEach(([offset, duration]) => {
      if (stopped) return
      const t = setTimeout(() => {
        if (!stopped) voiceSegment(ctx, ctx.currentTime, duration)
      }, offset * 1000)
      timers.push(t)
    })
 
    // Auto-close after 45s
    const endT = setTimeout(() => { try { ctx.close() } catch {} }, 46000)
    timers.push(endT)
  } catch {}
 
  return () => {
    stopped = true
    timers.forEach(t => clearTimeout(t))
    try { ctx?.close() } catch {}
  }
}