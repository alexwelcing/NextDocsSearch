import { describe, expect, it } from 'vitest'
import {
  ATTRACT_RAMP_S,
  MAX_IDLE_SPIN,
  attractSpin,
  panoramaSpin,
  stepAttract,
} from '@/lib/immersive/drift'
import type { BootPhase, ImmersiveModal } from '@/stores/immersiveStore'
import { IDLE_AFTER_MS, easeAttract, isIdle, nextLastInputAt, type IdleHolds } from './CameraRig'

const FPS = 60

/** Attract rate (rad/s) frame by frame from rest, as CameraRig drives it while idle. */
function onset(seconds: number): number[] {
  const rates: number[] = []
  let ramp = 0
  for (let i = 0; i < seconds * FPS; i++) {
    ramp = stepAttract(ramp, true, 1 / FPS)
    rates.push(attractSpin(easeAttract(ramp)))
  }
  return rates
}

/** A 62.5 fps frame loop in whole milliseconds, so UI boundaries never land on float noise. */
const FRAME_MS = 16
const READER: ImmersiveModal = { type: 'article', slug: 'a' }

/**
 * The time of the first frame at or after `from` that CameraRig's loop would call idle, given the
 * UI at each moment and no look input after page load (performance.now() = 0), or undefined if
 * none does within `ms`.
 */
function firstIdle(ui: (t: number) => Partial<IdleHolds>, ms: number, from = 0, reduced = false) {
  let last = 0
  for (let t = 0; t <= ms; t += FRAME_MS) {
    const holds: IdleHolds = { modal: null, dockOpen: false, bootPhase: 'ready', ...ui(t) }
    last = nextLastInputAt(last, t, holds)
    if (t >= from && isIdle(last, t, reduced)) return t
  }
  return undefined
}

/** Idle from within a frame of IDLE_AFTER_MS after the clock was last held fresh. */
function expectIdleAfter(t: number | undefined, releasedAt: number) {
  expect(t).toBeDefined()
  expect(Math.abs(t! - (releasedAt + IDLE_AFTER_MS))).toBeLessThanOrEqual(FRAME_MS)
}

describe('idle clock', () => {
  const nothingUp = (): Partial<IdleHolds> => ({})
  const boot = (reveal: number) => (t: number) => ({
    bootPhase: (t < 300 ? 'checking' : t < reveal ? 'booting' : 'ready') as BootPhase,
  })

  it('times idleness from the reveal, not page load: the boot overlay keeps the clock fresh', () => {
    // timed from page load, a 5 s boot would start the drift a second after the reveal
    expectIdleAfter(firstIdle(nothingUp, 60_000), 0)
    expectIdleAfter(firstIdle(boot(5000), 60_000), 5000)
    expectIdleAfter(firstIdle(boot(30_000), 60_000), 30_000)
  })

  it.each<[string, (t: number) => Partial<IdleHolds>]>([
    ['a reader', (t) => ({ modal: t >= 7000 && t < 12_000 ? READER : null })],
    ['the dock', (t) => ({ dockOpen: t >= 7000 && t < 12_000 })],
    ['a lost device', (t) => ({ bootPhase: t >= 7000 && t < 12_000 ? 'lost' : 'ready' })],
  ])('holds off through %s, then waits the full stretch after it closes', (_, ui) => {
    expectIdleAfter(firstIdle(ui, 60_000), 0) // idle already before it opened
    expectIdleAfter(firstIdle(ui, 60_000, 7000), 12_000) // not while it is up, nor right after
  })

  it('leaves look input alone while nothing holds the clock, so a drag restarts the wait', () => {
    const ready: IdleHolds = { modal: null, dockOpen: false, bootPhase: 'ready' }
    expect(nextLastInputAt(4200, 9000, ready)).toBe(4200)
    expect(isIdle(4200, 4200 + IDLE_AFTER_MS, false)).toBe(false)
    expect(isIdle(4200, 4200 + IDLE_AFTER_MS + 1, false)).toBe(true)
  })

  it('never idles under reduced motion', () => {
    expect(firstIdle(nothingUp, 60_000, 0, true)).toBeUndefined()
  })
})

describe('easeAttract', () => {
  it('runs 0 → 1 and clamps outside the ramp', () => {
    expect(easeAttract(0)).toBe(0)
    expect(easeAttract(0.5)).toBe(0.5)
    expect(easeAttract(1)).toBe(1)
    expect(easeAttract(-1)).toBe(0)
    expect(easeAttract(2)).toBe(1)
    expect(easeAttract(Number.NaN)).toBe(0)
  })

  it('is monotone, so the drift only ever speeds up while it eases in', () => {
    let prev = 0
    for (let r = 0; r <= 1; r += 1 / 256) {
      const g = easeAttract(r)
      expect(g).toBeGreaterThanOrEqual(prev)
      prev = g
    }
  })

  it('leaves rest and meets the ceiling with zero slope (no acceleration kink)', () => {
    const h = 1e-4
    expect(easeAttract(h) / h).toBeLessThan(1e-3)
    expect((1 - easeAttract(1 - h)) / h).toBeLessThan(1e-3)
  })
})

describe('attract onset', () => {
  it(`creeps off rest and reaches the 0.2°/s ceiling after ${ATTRACT_RAMP_S} s`, () => {
    const rates = onset(ATTRACT_RAMP_S + 1)
    // first frame: a linear ramp would already be at 1/120 of the ceiling; eased it is ~1/5000
    expect(rates[0]).toBeLessThan(MAX_IDLE_SPIN / 4000)
    // about a sixth of the ceiling half a second in (a linear ramp would be at a quarter)
    expect(rates[FPS / 2 - 1]).toBeLessThan(MAX_IDLE_SPIN * 0.16)
    expect(rates[ATTRACT_RAMP_S * FPS - 1]).toBeCloseTo(MAX_IDLE_SPIN, 12)
    expect(Math.max(...rates)).toBeLessThanOrEqual(MAX_IDLE_SPIN)
  })

  it('changes rate gently: no frame-to-frame jump bigger than the eased peak acceleration', () => {
    const rates = onset(ATTRACT_RAMP_S + 1)
    // smoothstep's peak slope is 1.5x the linear ramp's, reached mid-ease
    const peak = (1.5 * MAX_IDLE_SPIN) / ATTRACT_RAMP_S / FPS
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i] - rates[i - 1]).toBeLessThanOrEqual(peak + 1e-15)
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1])
    }
  })

  it('keeps the sky inside the shared 0.2°/s budget at every point of the ease', () => {
    for (const drift of [0, 0.003, MAX_IDLE_SPIN, 0.03]) {
      for (const hold of [0, 0.5, 1]) {
        for (let r = 0; r <= 1; r += 1 / 64) {
          const g = easeAttract(r)
          const sky = attractSpin(g) + panoramaSpin(drift, hold, g)
          expect(sky).toBeLessThanOrEqual(MAX_IDLE_SPIN + 1e-12)
        }
      }
    }
  })
})
