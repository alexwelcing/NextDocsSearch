// SFX bus for the ARC Terminal, built on a shared WebAudio graph instead of HTMLAudio so the
// clips come out warm instead of harsh: every voice gets a 3ms attack ramp (de-click), then all
// voices run through one lowpass (rounds the synth transients) into a gentle compressor (keeps
// fast key-chatter from stacking into spikes) and a master gain. Files live under
// /public/sounds/arc (see scripts/generate-arc-sfx.py); playback is fire-and-forget, unlocked by
// the first user gesture, and silently skipped when a clip is missing.

export type ArcSound =
  | 'boot'
  | 'key'
  | 'tab'
  | 'open'
  | 'close'
  | 'confirm'
  | 'deny'
  | 'hum'

const FILES: Record<ArcSound, string> = {
  boot: '/sounds/arc/boot.wav',
  key: '/sounds/arc/key.wav',
  tab: '/sounds/arc/tab.wav',
  open: '/sounds/arc/open.wav',
  close: '/sounds/arc/close.wav',
  confirm: '/sounds/arc/confirm.wav',
  deny: '/sounds/arc/deny.wav',
  hum: '/sounds/arc/hum.wav',
}

/** Per-sound trim into the shared bus (clips are mastered hot-ish; this sets the mix). */
const GAIN: Record<ArcSound, number> = {
  boot: 0.5,
  key: 0.3,
  tab: 0.36,
  open: 0.42,
  close: 0.4,
  confirm: 0.44,
  deny: 0.44,
  hum: 0.32,
}

const ATTACK_S = 0.003
/** Fast repeated keypresses retrigger at most this often — over-rate chatter reads as noise. */
const KEY_THROTTLE_MS = 36

let ctx: AudioContext | null = null
let bus: BiquadFilterNode | null = null
let master: GainNode | null = null
let unlocked = false
let muted = false
let lastKeyAt = 0
let hum: { src: AudioBufferSourceNode; gain: GainNode } | null = null
let humWanted = false
const buffers = new Map<ArcSound, Promise<AudioBuffer | null>>()

function ensureGraph(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  bus = ctx.createBiquadFilter()
  bus.type = 'lowpass'
  bus.frequency.value = 10500
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -20
  comp.ratio.value = 4
  comp.knee.value = 24
  master = ctx.createGain()
  master.gain.value = muted ? 0 : 1
  bus.connect(comp)
  comp.connect(master)
  master.connect(ctx.destination)
  return ctx
}

function loadBuffer(name: ArcSound): Promise<AudioBuffer | null> {
  let p = buffers.get(name)
  if (!p) {
    p = fetch(FILES[name])
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => (ctx ? ctx.decodeAudioData(data) : null))
      .catch(() => null)
    buffers.set(name, p)
  }
  return p
}

function ensureUnlockListener() {
  if (unlocked || typeof window === 'undefined') return
  const unlock = () => {
    unlocked = true
    // Autoplay policy: the context can only start (or resume) inside a user gesture.
    ensureGraph()
    void ctx?.resume().catch(() => undefined)
    if (humWanted) startHum()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}
ensureUnlockListener()

export function playSound(name: ArcSound, opts?: { rate?: number; gain?: number }): void {
  if (typeof window === 'undefined' || muted || !unlocked) return
  if (name === 'key') {
    const now = performance.now()
    if (now - lastKeyAt < KEY_THROTTLE_MS) return
    lastKeyAt = now
  }
  const ac = ensureGraph()
  if (!ac || !bus) return
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined)
  void loadBuffer(name).then((buffer) => {
    if (!buffer || !ctx || !bus || muted) return
    try {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = opts?.rate ?? 1
      const g = ctx.createGain()
      const level = GAIN[name] * (opts?.gain ?? 1)
      const t = ctx.currentTime
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(level, t + ATTACK_S)
      src.connect(g)
      g.connect(bus)
      src.onended = () => {
        src.disconnect()
        g.disconnect()
      }
      src.start()
    } catch {
      /* no audio available */
    }
  })
}

function startHum(): void {
  const ac = ensureGraph()
  if (!ac || !bus || hum) return
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined)
  void loadBuffer('hum').then((buffer) => {
    if (!buffer || !ctx || !bus || !humWanted || hum) return
    try {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true
      const g = ctx.createGain()
      const t = ctx.currentTime
      g.gain.setValueAtTime(0, t)
      // room tone breathes in rather than clicking on
      g.gain.linearRampToValueAtTime(GAIN.hum, t + 0.4)
      src.connect(g)
      g.connect(bus)
      src.start()
      hum = { src, gain: g }
    } catch {
      /* no audio available */
    }
  })
}

function stopHum(): void {
  if (!hum || !ctx) return
  const { src, gain } = hum
  hum = null
  try {
    const t = ctx.currentTime
    gain.gain.setValueAtTime(gain.gain.value, t)
    gain.gain.linearRampToValueAtTime(0, t + 0.25)
    src.stop(t + 0.3)
    src.onended = () => {
      src.disconnect()
      gain.disconnect()
    }
  } catch {
    /* already stopped */
  }
}

/** Looped room-tone hum while the dock is open. */
export function setHum(on: boolean): void {
  if (typeof window === 'undefined') return
  humWanted = on
  if (on && unlocked && !muted) startHum()
  if (!on) stopHum()
}

export function setMuted(v: boolean): void {
  muted = v
  if (master && ctx) {
    const t = ctx.currentTime
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(v ? 0 : 1, t + 0.03)
  }
  if (v) stopHum()
  else if (humWanted && unlocked) startHum()
}
