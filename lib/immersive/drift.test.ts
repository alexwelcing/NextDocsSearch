import { describe, expect, it } from 'vitest'
import { WORLDS } from './worlds'
import { ATTRACT_RAMP_S, MAX_IDLE_SPIN, attractSpin, panoramaSpin, stepAttract } from './drift'

const DEG_PER_S = (rad: number) => (rad * 180) / Math.PI

describe('MAX_IDLE_SPIN', () => {
  it('is 0.2°/s', () => {
    expect(DEG_PER_S(MAX_IDLE_SPIN)).toBeCloseTo(0.2, 10)
  })
})

describe('stepAttract', () => {
  it(`eases in linearly over ${ATTRACT_RAMP_S} s while idle`, () => {
    let g = 0
    for (let i = 0; i < 60; i++) g = stepAttract(g, true, 1 / 60)
    expect(g).toBeCloseTo(1 / ATTRACT_RAMP_S, 6)
    for (let i = 0; i < 600; i++) g = stepAttract(g, true, 1 / 60)
    expect(g).toBe(1)
  })

  it('drops to rest the moment input, a modal or the dock takes over', () => {
    expect(stepAttract(1, false, 1 / 60)).toBe(0)
    expect(stepAttract(0.4, false, 0)).toBe(0)
  })

  it('ignores a negative frame delta', () => {
    expect(stepAttract(0.5, true, -1)).toBe(0.5)
  })
})

describe('idle rotation budget', () => {
  const drifts = [0, 0.001, 0.003, MAX_IDLE_SPIN, 0.006, 0.03]
  const gains = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]

  it('never lets the sky turn faster than 0.2°/s, however the two sources mix', () => {
    for (const d of drifts) {
      for (const hold of gains) {
        for (const a of gains) {
          const sky = attractSpin(a) + panoramaSpin(d, hold, a)
          expect(sky).toBeLessThanOrEqual(MAX_IDLE_SPIN + 1e-12)
          expect(sky).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('caps every registered world spin, including any faster than the ceiling', () => {
    for (const w of WORLDS) expect(panoramaSpin(w.drift, 1, 0)).toBeLessThanOrEqual(MAX_IDLE_SPIN)
    expect(panoramaSpin(0.03, 1, 0)).toBe(MAX_IDLE_SPIN) // the old ×10 rate
  })

  it('holds the panorama still behind a modal or the dock', () => {
    expect(panoramaSpin(0.003, 0, 0)).toBe(0)
  })

  it('hands the whole budget to the attract drift once it has eased in', () => {
    expect(panoramaSpin(0.003, 1, 1)).toBe(0)
    expect(attractSpin(1)).toBe(MAX_IDLE_SPIN)
    expect(attractSpin(0)).toBe(0)
  })

  it('clamps out-of-range gains instead of overshooting or reversing', () => {
    expect(attractSpin(2)).toBe(MAX_IDLE_SPIN)
    expect(attractSpin(-1)).toBe(0)
    expect(attractSpin(Number.NaN)).toBe(0)
    expect(panoramaSpin(0.003, 2, -1)).toBe(0.003)
    expect(panoramaSpin(-0.003, 1, 0)).toBe(0)
  })
})
