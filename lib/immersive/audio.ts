// Tiny SFX bus for the ARC Terminal. Files live under /public/sounds/arc; playback is fire-and-
// forget, unlocked by the first user gesture, and silently skipped when a clip is missing.

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
  boot: '/sounds/arc/boot.mp3',
  key: '/sounds/arc/key.mp3',
  tab: '/sounds/arc/tab.mp3',
  open: '/sounds/arc/open.mp3',
  close: '/sounds/arc/close.mp3',
  confirm: '/sounds/arc/confirm.mp3',
  deny: '/sounds/arc/deny.mp3',
  hum: '/sounds/arc/hum.mp3',
}

const VOLUME: Partial<Record<ArcSound, number>> = { hum: 0.18, boot: 0.5, key: 0.35 }

let unlocked = false
const pool = new Map<ArcSound, HTMLAudioElement>()
let humEl: HTMLAudioElement | null = null
let muted = false

function ensureUnlockListener() {
  if (unlocked || typeof window === 'undefined') return
  const unlock = () => {
    unlocked = true
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}
ensureUnlockListener()

export function playSound(name: ArcSound): void {
  if (typeof window === 'undefined' || muted || !unlocked) return
  try {
    let el = pool.get(name)
    if (!el) {
      el = new Audio(FILES[name])
      el.volume = VOLUME[name] ?? 0.45
      pool.set(name, el)
    }
    el.currentTime = 0
    void el.play().catch(() => undefined)
  } catch {
    /* no audio available */
  }
}

/** Looped room-tone hum while the dock is open. */
export function setHum(on: boolean): void {
  if (typeof window === 'undefined' || muted) return
  try {
    if (on) {
      if (!humEl) {
        humEl = new Audio(FILES.hum)
        humEl.loop = true
        humEl.volume = VOLUME.hum ?? 0.18
      }
      if (unlocked) void humEl.play().catch(() => undefined)
    } else {
      humEl?.pause()
    }
  } catch {
    /* no audio available */
  }
}

export function setMuted(v: boolean): void {
  muted = v
  if (v) humEl?.pause()
}
