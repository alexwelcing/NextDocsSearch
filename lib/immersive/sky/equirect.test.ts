import { describe, expect, it } from 'vitest'
import {
  HERO_U_DEFAULT,
  LEGACY_HERO_U,
  dirToEquirect,
  equirectToDir,
  fract,
  heroOffset,
  mipLevel,
  naiveAzimuthDelta,
  seamSafeAzimuthDelta,
  wrapAngle,
  type Vec3,
} from './equirect'

const DEG = Math.PI / 180
/** Horizontal view direction for a yaw in degrees (0 = start view −z, +90 = right, +x). */
const heading = (deg: number, pitchDeg = 0): Vec3 => {
  const c = Math.cos(pitchDeg * DEG)
  return [c * Math.sin(deg * DEG), Math.sin(pitchDeg * DEG), -c * Math.cos(deg * DEG)]
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps
/** Distance between two u values on the circle. */
const du = (a: number, b: number) => Math.abs(wrapAngle((a - b) * 2 * Math.PI)) / (2 * Math.PI)

describe('dirToEquirect conventions', () => {
  it('faces the hero at the start view and puts the seam behind (new worlds)', () => {
    expect(dirToEquirect(heading(0)).u).toBeCloseTo(HERO_U_DEFAULT, 12)
    // u = 0|1 straight behind the viewer
    expect(du(dirToEquirect(heading(180)).u, 0)).toBeLessThan(1e-12)
  })

  it('keeps the legacy framing: start view on u = 0.75, seam 90° to the right', () => {
    expect(dirToEquirect(heading(0), 0, LEGACY_HERO_U).u).toBeCloseTo(0.75, 12)
    expect(du(dirToEquirect(heading(90), 0, LEGACY_HERO_U).u, 0)).toBeLessThan(1e-12)
  })

  it("matches the old inverted UV sphere's mapping, u = fract(atan2(z, x)/2π), for legacy worlds", () => {
    for (let deg = -180; deg <= 180; deg += 7.5) {
      const d = heading(deg, 20)
      const legacy = fract(Math.atan2(d[2], d[0]) / (2 * Math.PI))
      expect(du(dirToEquirect(d, 0, LEGACY_HERO_U).u, legacy)).toBeLessThan(1e-12)
    }
  })

  it('reads the image left to right as the view turns right', () => {
    const u0 = dirToEquirect(heading(0)).u
    const u1 = dirToEquirect(heading(10)).u
    expect(u1 - u0).toBeCloseTo(10 / 360, 12)
  })

  it('puts the zenith on row 0 and the nadir on the last row (flipY = false)', () => {
    expect(dirToEquirect([0, 1, 0]).v).toBeCloseTo(0, 12)
    expect(dirToEquirect([0, -1, 0]).v).toBeCloseTo(1, 12)
    expect(dirToEquirect(heading(0)).v).toBeCloseTo(0.5, 12)
    expect(dirToEquirect(heading(0, 80)).v).toBeCloseTo(0.5 - 80 / 180, 12)
    expect(dirToEquirect(heading(0, -80)).v).toBeCloseTo(0.5 + 80 / 180, 12)
  })

  it('turns with yaw: positive yaw slides the sky left (the start view sees higher u)', () => {
    const y = 15 * DEG
    expect(dirToEquirect(heading(0), y).u).toBeCloseTo(HERO_U_DEFAULT + 15 / 360, 12)
    expect(du(dirToEquirect(heading(0), y).u, dirToEquirect(heading(15)).u)).toBeLessThan(1e-12)
  })

  it('round-trips through equirectToDir for any yaw and hero offset', () => {
    for (const heroU of [0, 0.25, 0.5, 0.75, 0.9]) {
      for (const yaw of [0, 1.3, -2.2]) {
        for (const [u, v] of [
          [0.01, 0.5],
          [0.5, 0.1],
          [0.99, 0.93],
          [0.33, 0.62],
        ]) {
          const d = equirectToDir(u, v, yaw, heroU)
          expect(Math.hypot(...d)).toBeCloseTo(1, 12)
          const back = dirToEquirect(d, yaw, heroU)
          expect(du(back.u, u)).toBeLessThan(1e-9)
          expect(back.v).toBeCloseTo(v, 9)
        }
      }
    }
  })

  it('heroOffset wraps into [0, 1)', () => {
    expect(heroOffset(0.5)).toBeCloseTo(0.75, 12)
    expect(heroOffset(0.75)).toBe(0)
    expect(heroOffset(0.9)).toBeCloseTo(0.15, 12)
  })
})

describe('seam-safe gradients', () => {
  // Two neighbouring fragments 0.05° apart (a pixel at fov 70 / 1600 px is ~0.044°).
  const pixel = 0.05

  it('give the true azimuth step everywhere, including across the u=0|1 seam', () => {
    for (const heroU of [HERO_U_DEFAULT, LEGACY_HERO_U, 0.25]) {
      for (let deg = -180; deg < 180; deg += 0.37) {
        const a = heading(deg, 10)
        const b = heading(deg + pixel, 10)
        const safe = seamSafeAzimuthDelta(a, b)
        expect(near(Math.abs(safe), pixel * DEG, 1e-6)).toBe(true)
      }
      // ...and right on top of the seam for this framing
      // u = heroU + heading/360, so u = 0 sits at heading −360·heroU
      const seamDeg = -360 * heroU - pixel / 2
      expect(du(dirToEquirect(heading(seamDeg + pixel / 2), 0, heroU).u, 0)).toBeLessThan(1e-9)
      const s = seamSafeAzimuthDelta(heading(seamDeg), heading(seamDeg + pixel))
      expect(Math.abs(s)).toBeCloseTo(pixel * DEG, 9)
    }
  })

  it('stay correct at both branch cuts (±x), where one of the two branches jumps by 2π', () => {
    for (const deg of [90, -90]) {
      const a = heading(deg - pixel / 2)
      const b = heading(deg + pixel / 2)
      expect(Math.abs(seamSafeAzimuthDelta(a, b))).toBeCloseTo(pixel * DEG, 9)
    }
  })

  it('fix what the naive derivative gets wrong: a ~2π step and the 1x1 mip at the seam', () => {
    const a = heading(180 - pixel / 2)
    const b = heading(180 + pixel / 2)
    const naive = naiveAzimuthDelta(a, b)
    expect(Math.abs(naive)).toBeGreaterThan(Math.PI) // the whole texture in one pixel
    const width = 4096
    const naiveMip = mipLevel(naive / (2 * Math.PI), 0, width)
    const safeMip = mipLevel(seamSafeAzimuthDelta(a, b) / (2 * Math.PI), 0, width)
    expect(naiveMip).toBeGreaterThan(Math.log2(width) - 1) // ~level 12: the 1x1 tail
    expect(safeMip).toBeLessThan(1) // full detail
  })

  it('is independent of yaw and hero offset (one gradient pair serves both slots)', () => {
    const a = heading(37)
    const b = heading(37 + pixel)
    const s = seamSafeAzimuthDelta(a, b)
    for (const yaw of [0, 1, 2, 3]) {
      for (const heroU of [0.1, 0.5, 0.75]) {
        const n = naiveAzimuthDelta(a, b, yaw, heroU)
        // away from the seam the naive derivative agrees with the seam-safe one
        if (Math.abs(n) < 1) expect(n).toBeCloseTo(s, 9)
      }
    }
  })
})
