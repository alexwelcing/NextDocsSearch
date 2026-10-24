import { describe, expect, it } from 'vitest'
import { FLOATS_PER_INSTANCE, type TextLayout } from '@/lib/windfoil/types'
import { haloLayout } from './WindfoilText'

/** Two glyphs on one line: place(penX, baselineY, unitsToLocal, fill) · bbox(font units, y-down). */
function twoGlyphs(): TextLayout {
  const instances = new Float32Array(2 * FLOATS_PER_INSTANCE)
  instances.set([0, 0, 0.001, 0, 50, -700, 450, 0], 0)
  instances.set([2, 0, 0.001, 0, 40, -720, 520, 10], FLOATS_PER_INSTANCE)
  return { instances, glyphCount: 2, width: 2.6, height: 1, lineCount: 1 }
}

/** Ink-box centre and size of glyph i in block-local units. */
function box(layout: TextLayout, i: number) {
  const v = layout.instances.subarray(i * FLOATS_PER_INSTANCE)
  const [px, py, k, , x0, y0, x1, y1] = v
  return { cx: px + (k * (x0 + x1)) / 2, cy: py + (k * (y0 + y1)) / 2, w: k * (x1 - x0) }
}

describe('haloLayout', () => {
  it('grows each glyph about its own centre instead of the block centre', () => {
    const base = twoGlyphs()
    const halo = haloLayout(base, 1.55)
    for (const i of [0, 1]) {
      const a = box(base, i)
      const b = box(halo, i)
      expect(b.cx).toBeCloseTo(a.cx, 6)
      expect(b.cy).toBeCloseTo(a.cy, 6)
      expect(b.w).toBeCloseTo(a.w * 1.55, 6)
    }
  })

  it('leaves the source layout untouched and keeps colour/band data', () => {
    const base = twoGlyphs()
    base.instances[8] = 0.5
    const before = Array.from(base.instances)
    const halo = haloLayout(base, 1.22)
    expect(Array.from(base.instances)).toEqual(before)
    expect(halo.instances[8]).toBe(0.5)
    expect(halo.glyphCount).toBe(2)
  })
})
