import { describe, expect, it } from 'vitest'
import { DOCK_FIT } from '@/components/immersive/dock/ArcDock'
import { MODAL_DIST, MODAL_H, MODAL_W } from '@/components/immersive/modals/ModalShell'
import { FIT_MARGIN, LOW_TIER_SCREEN_PX, fitScale, horizontalFov, qualityHint } from './fit'

const deg = (rad: number) => (rad * 180) / Math.PI

// The in-scene panels exactly as the components fit them, so a change to either panel's
// dimensions re-runs these checks: the reader slab (1.72 x 1.04 m at 1.5 m) and the ARC dock
// (0.74 m chassis + grips at 0.85 m, tilted so its key row sits ~0.12 m nearer the eye).
const READER = { distance: MODAL_DIST, width: MODAL_W, height: MODAL_H }
const DOCK = DOCK_FIT
const PHONE = 390 / 844
const DESKTOP = 1600 / 900

/** Half-width of a fitted panel's near edge as a fraction of the visible half-width there. */
function fill(
  s: number,
  p: { distance: number; width: number; nearOffset?: number },
  vFov: number,
  aspect: number
) {
  const tanH = Math.tan((vFov * Math.PI) / 180 / 2) * aspect
  return ((p.width / 2) * s) / ((p.distance - (p.nearOffset ?? 0) * s) * tanH)
}

describe('horizontalFov', () => {
  it('matches the vertical fov at aspect 1', () => {
    expect(deg(horizontalFov(70, 1))).toBeCloseTo(70, 6)
  })

  it('collapses to ~36° on a 390x844 portrait phone with the 70° camera', () => {
    expect(deg(horizontalFov(70, PHONE))).toBeCloseTo(35.9, 1)
  })

  it('widens past 100° on a 16:9 desktop', () => {
    expect(deg(horizontalFov(70, DESKTOP))).toBeGreaterThan(100)
  })
})

describe('fitScale', () => {
  it('never enlarges: landscape panels keep their authored size', () => {
    expect(fitScale({ vFov: 70, aspect: DESKTOP, ...READER })).toBe(1)
    expect(fitScale({ vFov: 70, aspect: DESKTOP, ...DOCK })).toBe(1)
    // wheel-zoomed all the way in (fov 45) on desktop still fits
    expect(fitScale({ vFov: 45, aspect: DESKTOP, ...READER })).toBe(1)
  })

  it('matches the closed form min(1, m·2·d·tan(hFov/2)/W) for a flat panel', () => {
    const hFov = horizontalFov(70, PHONE)
    const expected = (FIT_MARGIN * 2 * READER.distance * Math.tan(hFov / 2)) / READER.width
    const flat = { distance: READER.distance, width: READER.width }
    expect(fitScale({ vFov: 70, aspect: PHONE, ...flat })).toBeCloseTo(expected, 10)
  })

  it('shrinks the reader on a portrait phone until it spans exactly the margin', () => {
    const s = fitScale({ vFov: 70, aspect: PHONE, ...READER })
    expect(s).toBeGreaterThan(0.45)
    expect(s).toBeLessThan(0.6)
    expect(fill(s, READER, 70, PHONE)).toBeCloseTo(FIT_MARGIN, 10)
  })

  it('accounts for a tilted near edge so the dock corners stay inside the view', () => {
    const s = fitScale({ vFov: 70, aspect: PHONE, ...DOCK })
    expect(s).toBeLessThan(1)
    expect(fill(s, DOCK, 70, PHONE)).toBeCloseTo(FIT_MARGIN, 10)
    // the flat-panel formula alone would let the near corners poke past the margin
    const flat = fitScale({ vFov: 70, aspect: PHONE, distance: DOCK.distance, width: DOCK.width })
    expect(fill(flat, DOCK, 70, PHONE)).toBeGreaterThan(FIT_MARGIN)
  })

  it('enforces the vertical fit only when a height is given', () => {
    const wide = 4 // a very wide, short viewport: width is never the constraint
    const tall = { distance: 1, width: 0.5, height: 2 }
    expect(fitScale({ vFov: 70, aspect: wide, distance: 1, width: 0.5 })).toBe(1)
    const s = fitScale({ vFov: 70, aspect: wide, ...tall })
    const tanV = Math.tan((35 * Math.PI) / 180)
    expect(s).toBeCloseTo((FIT_MARGIN * tanV * 1) / 1, 10)
  })

  it('degrades to 1 on degenerate input instead of NaN/0', () => {
    expect(fitScale({ vFov: 70, aspect: 0, ...READER })).toBe(1)
    expect(fitScale({ vFov: 70, aspect: Number.NaN, ...READER })).toBe(1)
    expect(fitScale({ vFov: 70, aspect: PHONE, distance: 0, width: 1 })).toBe(1)
    expect(fitScale({ vFov: 70, aspect: PHONE, distance: 1, width: 0 })).toBe(1)
  })
})

describe('qualityHint', () => {
  const desktop = { coarsePointer: false, screenWidth: 1920, devicePixelRatio: 1 }

  it('keeps fine-pointer desktops with enough physical pixels on high', () => {
    expect(qualityHint(desktop)).toBe('high')
    expect(qualityHint({ ...desktop, screenWidth: 1440, devicePixelRatio: 2 })).toBe('high')
    expect(qualityHint({ ...desktop, deviceMemory: 8 })).toBe('high')
  })

  it('starts touch-first devices low, however many pixels they have', () => {
    expect(
      qualityHint({ ...desktop, coarsePointer: true, screenWidth: 1024, devicePixelRatio: 2 })
    ).toBe('low')
  })

  it(`starts screens under ${LOW_TIER_SCREEN_PX} physical px wide low`, () => {
    expect(qualityHint({ ...desktop, screenWidth: 1366 })).toBe('low')
    expect(qualityHint({ ...desktop, screenWidth: 1400 })).toBe('high')
    expect(qualityHint({ ...desktop, screenWidth: 0 })).toBe('high') // unknown screen
  })

  it('keeps the small-heap signal', () => {
    expect(qualityHint({ ...desktop, deviceMemory: 4 })).toBe('low')
  })
})
