import { describe, expect, it } from 'vitest'
import { ARC, rgba } from './theme'

describe('rgba', () => {
  it('decodes palette hex from sRGB into the linear working space', () => {
    const [r, g, b, a] = rgba(ARC.green)
    // #70ff8f: 112/255 and 143/255 through the sRGB EOTF, 255 stays 1
    expect(r).toBeCloseTo(0.162, 3)
    expect(g).toBeCloseTo(1, 6)
    expect(b).toBeCloseTo(0.275, 3)
    expect(a).toBe(1)
  })

  it('is not the raw /255 encoding that renders as pale mint', () => {
    const [r] = rgba(ARC.green)
    expect(r).not.toBeCloseTo(112 / 255, 2)
  })

  it('passes alpha through and keeps black and white fixed', () => {
    expect(rgba('#ffffff', 0.96)).toEqual([1, 1, 1, 0.96])
    expect(rgba('#000000', 0.5)).toEqual([0, 0, 0, 0.5])
  })

  it('returns a fresh tuple per call', () => {
    expect(rgba(ARC.red)).not.toBe(rgba(ARC.red))
  })
})
