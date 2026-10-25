import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fitScale } from '@/lib/immersive/fit'
import { FONT } from '@/lib/immersive/theme'
import { WORLDS } from '@/lib/immersive/worlds'
import { layoutText, measureText } from '@/lib/windfoil/layout'
import type { AtlasManifest, FontAtlas, GlyphEntry } from '@/lib/windfoil/types'
import { BLURB_SIZE, RULE_W, TITLE_SIZE, balancedWrapWidth, cardSpan } from './WorldTitleCard'

const PHONE = 390 / 844
const DESKTOP = 1600 / 900
const FOV = 70

/** The committed atlas metrics (layout never reads the curve/row blocks, so they stay empty). */
function atlas(name: string): FontAtlas {
  const path = join(process.cwd(), 'public/fonts', `${name}.wfa.json`)
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as AtlasManifest
  const glyphs = new Map<string, GlyphEntry>()
  for (const [ch, g] of Object.entries(manifest.glyphs)) {
    glyphs.set(ch, {
      rowBase: g[0],
      bandCount: g[1],
      y0: g[2],
      invH: g[3],
      advance: g[4],
      bbox: [g[5], g[6], g[7], g[8]],
    })
  }
  return { manifest, glyphs, curves: new Float32Array(0), rows: new Uint32Array(0) }
}

const display = atlas(FONT.display)
const mono = atlas(FONT.mono)
const measureBlurb = (s: string) => measureText(mono, s, BLURB_SIZE)
const blurbLayout = (text: string, maxWidth?: number) =>
  layoutText(mono, text, { fontSize: BLURB_SIZE, maxWidth })

/** The card's widest element as the component measures it (title, wrapped blurb, rule). */
function cardWidth(name: string, blurb: string, aspect: number) {
  const wrap = balancedWrapWidth(blurb, cardSpan(FOV, aspect), measureBlurb)
  const title = layoutText(display, name, { fontSize: TITLE_SIZE }).width
  // centred text reports its wrap width as the block width
  const blurbW = layoutText(mono, blurb, { fontSize: BLURB_SIZE, maxWidth: wrap, align: 'center' })
  return Math.max(title, blurbW.width, RULE_W)
}

describe('cardSpan', () => {
  it("is the width fit.ts lets a panel fill at the card's distance", () => {
    for (const aspect of [PHONE, 1, DESKTOP]) {
      const span = cardSpan(FOV, aspect)
      expect(fitScale({ vFov: FOV, aspect, distance: 7, width: span })).toBeCloseTo(1, 10)
      expect(fitScale({ vFov: FOV, aspect, distance: 7, width: 2 * span })).toBeCloseTo(0.5, 10)
    }
  })
})

describe('balancedWrapWidth', () => {
  const chars = (s: string) => s.length // a monospace stand-in: one unit per character

  it('leaves a caption that fits on one line alone', () => {
    expect(balancedWrapWidth('in transit.', 11, chars)).toBeUndefined()
    expect(balancedWrapWidth('unbreakable', 4, chars)).toBeUndefined() // nothing to break at
  })

  it('splits evenly where a greedy wrap would leave an orphan', () => {
    // greedy at 15 packs "aaaa bbbb cccc" and strands "dd"; even is "aaaa bbbb" / "cccc dd"
    const w = balancedWrapWidth('aaaa bbbb cccc dd', 15, chars)!
    expect(w).toBeGreaterThanOrEqual(9)
    expect(w).toBeLessThan(10)
    expect(balancedWrapWidth('aaaa bbbb cccc dd ee ff', 9, chars)).toBeCloseTo(9, 6) // 3 lines
  })

  it('never goes narrower than the widest word, which the layout cannot break', () => {
    expect(balancedWrapWidth('aa bbbbbb', 7, chars)).toBe(6)
    // a word wider than the span keeps its own line; the card's fit scale covers the overflow
    expect(balancedWrapWidth('aa bbbbbbbbbb', 7, chars)).toBe(10)
  })

  it('treats runs of spaces like the layout does', () => {
    // "aa  bb" is 6 wide on one line; split, each line holds one word
    expect(balancedWrapWidth('aa  bb', 5, chars)).toBe(2)
    expect(balancedWrapWidth('aa  bb', 6, chars)).toBeUndefined()
  })

  it('reproduces the line count of a wrap at the full span in the real layout, tightly', () => {
    const span = cardSpan(FOV, PHONE)
    for (const { blurb } of WORLDS) {
      const w = balancedWrapWidth(blurb, span, measureBlurb)
      const greedy = blurbLayout(blurb, span)
      if (w === undefined) {
        expect(greedy.lineCount).toBe(1)
        continue
      }
      const balanced = blurbLayout(blurb, w)
      expect(balanced.lineCount).toBe(greedy.lineCount)
      expect(balanced.width).toBeLessThanOrEqual(w)
      expect(w).toBeLessThanOrEqual(span)
      // any narrower and it needs another line: the longest line is as short as it can be
      expect(blurbLayout(blurb, w * 0.999).lineCount).toBeGreaterThan(balanced.lineCount)
    }
  })
})

describe('title card fit', () => {
  it('fits the hero title and blurb of every world on a 390x844 portrait phone', () => {
    const span = cardSpan(FOV, PHONE)
    let wrapped = 0
    for (const { name, blurb } of WORLDS) {
      if (balancedWrapWidth(blurb, span, measureBlurb) !== undefined) wrapped++
      const width = cardWidth(name, blurb, PHONE)
      const s = fitScale({ vFov: FOV, aspect: PHONE, distance: 7, width })
      expect(s * width).toBeLessThanOrEqual(span * (1 + 1e-9))
      // the blurb breaks into lines instead of dragging the title down with it
      expect(s).toBeGreaterThan(0.85)
      expect(blurbLayout(blurb, span).lineCount).toBeLessThanOrEqual(2)
    }
    expect(wrapped).toBeGreaterThan(0) // the case this exists for: most blurbs outgrow the view
  })

  it('keeps the desktop card exactly as authored: one-line blurb, scale 1', () => {
    for (const aspect of [DESKTOP, 4 / 3]) {
      const span = cardSpan(FOV, aspect)
      for (const { name, blurb } of WORLDS) {
        expect(balancedWrapWidth(blurb, span, measureBlurb)).toBeUndefined()
        const width = cardWidth(name, blurb, aspect)
        expect(fitScale({ vFov: FOV, aspect, distance: 7, width })).toBe(1)
      }
    }
    // wheel-zoomed all the way in (fov 45) on 16:9 still fits untouched
    const zoomed = cardSpan(45, DESKTOP)
    for (const { blurb } of WORLDS) {
      expect(balancedWrapWidth(blurb, zoomed, measureBlurb)).toBeUndefined()
    }
  })
})
