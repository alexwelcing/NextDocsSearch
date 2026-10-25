import { describe, expect, it } from 'vitest'
import {
  ATTRACT_RAMP_S,
  MAX_IDLE_SPIN,
  attractSpin,
  panoramaSpin,
  stepAttract,
} from '@/lib/immersive/drift'
import { easeAttract } from './CameraRig'

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
