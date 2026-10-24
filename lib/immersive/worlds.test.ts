import { describe, expect, it } from 'vitest'
import { WORLDS, worldById, worldByPanorama } from './worlds'

describe('world exposure', () => {
  it('gives every world a finite, bounded panorama gain', () => {
    for (const w of WORLDS) {
      expect(Number.isFinite(w.exposure)).toBe(true)
      expect(w.exposure).toBeGreaterThanOrEqual(0.7)
      expect(w.exposure).toBeLessThanOrEqual(2)
    }
  })

  it('lifts the darkest panorama and tames the brightest toward mid-grey', () => {
    expect(worldById('the-stacks').exposure).toBeGreaterThan(1)
    expect(worldById('night-train').exposure).toBeLessThan(1)
  })
})

describe('worldByPanorama', () => {
  it('maps a panorama pathname back to its world', () => {
    for (const w of WORLDS) expect(worldByPanorama(w.panorama)?.id).toBe(w.id)
  })

  it('returns undefined for anything that is not a world panorama', () => {
    expect(worldByPanorama('/images/hero.jpg')).toBeUndefined()
  })
})
