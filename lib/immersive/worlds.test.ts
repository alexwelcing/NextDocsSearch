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

  it('maps the absolute src a loaded image reports, whatever the origin, query or hash', () => {
    // what WorldExposure feeds it: HTMLImageElement.src, resolved against location.href
    const page = 'https://alexwelcing.com/articles/some-record?ref=x'
    expect(worldByPanorama('https://alexwelcing.com/background/train.jpg', page)?.id).toBe(
      'night-train'
    )
    expect(
      worldByPanorama('https://preview-abc.vercel.app/background/the-stacks.jpg?v=2#top', page)
        ?.exposure
    ).toBe(worldById('the-stacks').exposure)
    expect(worldByPanorama('background/cave.jpg', 'https://alexwelcing.com/')?.id).toBe(
      'undercroft'
    )
  })

  it('returns undefined for anything that is not a world panorama', () => {
    expect(worldByPanorama('/images/hero.jpg')).toBeUndefined()
    expect(worldByPanorama('https://alexwelcing.com/images/hero.jpg')).toBeUndefined()
    // a hashed/re-encoded asset or an ImageBitmap's blob: URL can't be attributed to a world
    expect(worldByPanorama('/_next/static/media/the-stacks.3f2a1c.jpg')).toBeUndefined()
    expect(worldByPanorama('/background/the-stacks.ktx2')).toBeUndefined()
    expect(worldByPanorama('blob:https://alexwelcing.com/0b1c-4e')).toBeUndefined()
    expect(worldByPanorama('http://[bad')).toBeUndefined()
  })
})
