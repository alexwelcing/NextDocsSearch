// Pure equirect math for the Sky v2 runtime — the CPU mirror of lib/immersive/sky/nodes.ts, so the
// conventions the shader relies on are pinned by unit tests rather than by screenshots alone.
//
// Conventions (scene frame: camera at the origin, start view −z, right +x, up +y):
//  - v = 0.5 − asin(y)/π: row 0 of the image is the zenith. Textures are sampled with flipY=false,
//    the only orientation compressed (KTX2) textures support, so every tier uses it.
//  - u grows as the view turns right, and the start view faces u = heroU. New worlds author their
//    hero at u = 0.5, which puts the image seam (u = 0|1) directly behind the viewer. Legacy JPEG
//    worlds keep heroU = 0.75 — the column today's inverted UV sphere showed at the start view —
//    so their framing does not move.
//  - yaw (radians) turns the sky about +y; positive yaw slides the sky left across the screen,
//    the same way PanoramaSphere's drift spun its group (lib/immersive/drift.ts).

export type Vec3 = readonly [number, number, number]

/** Where the start view looks in a new world's image: the hero, with the seam behind. */
export const HERO_U_DEFAULT = 0.5
/** Where the start view has always looked in the 12 legacy JPEG worlds. */
export const LEGACY_HERO_U = 0.75

const TAU = Math.PI * 2

/** fract() as WGSL defines it: x − floor(x), always in [0, 1). */
export function fract(x: number): number {
  return x - Math.floor(x)
}

/** Azimuth of a direction in the xz-plane, atan2(z, x) in (−π, π]. −z (the start view) is −π/2. */
export function azimuth(d: Vec3): number {
  return Math.atan2(d[2], d[0])
}

/**
 * The u offset added to azimuth/2π so that the start view lands on `heroU`. atan2 puts −z at
 * −0.25 turns, so the offset is heroU + 0.25 (mod 1). The shader receives it per sky slot.
 */
export function heroOffset(heroU: number): number {
  return fract(heroU + 0.25)
}

/** Equirect (u, v) for a direction, with the sky turned by `yaw` and framed on `heroU`. */
export function dirToEquirect(d: Vec3, yaw = 0, heroU = HERO_U_DEFAULT): { u: number; v: number } {
  const len = Math.hypot(d[0], d[1], d[2]) || 1
  const y = Math.min(1, Math.max(-1, d[1] / len))
  return {
    u: fract((azimuth(d) + yaw) / TAU + heroOffset(heroU)),
    v: 0.5 - Math.asin(y) / Math.PI,
  }
}

/** Inverse of dirToEquirect: the unit direction that samples (u, v). */
export function equirectToDir(u: number, v: number, yaw = 0, heroU = HERO_U_DEFAULT): Vec3 {
  const phi = (u - heroOffset(heroU)) * TAU - yaw
  const lat = (0.5 - v) * Math.PI
  const c = Math.cos(lat)
  return [c * Math.cos(phi), Math.sin(lat), c * Math.sin(phi)]
}

/** An angle difference wrapped into [−π, π]. */
export function wrapAngle(a: number): number {
  return a - TAU * Math.round(a / TAU)
}

/**
 * Seam-safe screen-space derivative of the azimuth between two neighbouring fragments — the CPU
 * twin of the shader's two-branch gradient (Tarini). atan2(z, x) jumps by 2π at −x and its
 * mirror atan2(−z, −x) jumps at +x; the two never jump at the same place, and away from their
 * jumps both have the same derivative. Taking whichever difference is smaller in magnitude gives
 * the true derivative everywhere, whatever yaw or hero offset is added afterwards, so the hardware
 * never sees a whole-texture footprint and never drops to the 1x1 mip along the seam column.
 */
export function seamSafeAzimuthDelta(a: Vec3, b: Vec3): number {
  const dA = Math.atan2(b[2], b[0]) - Math.atan2(a[2], a[0])
  const dB = Math.atan2(-b[2], -b[0]) - Math.atan2(-a[2], -a[0])
  return Math.abs(dA) < Math.abs(dB) ? dA : dB
}

/** The derivative the hardware would take of the sampled u (fract'ed), in radians — wrong by
 *  about 2π wherever the seam falls between the two fragments. */
export function naiveAzimuthDelta(a: Vec3, b: Vec3, yaw = 0, heroU = HERO_U_DEFAULT): number {
  return (dirToEquirect(b, yaw, heroU).u - dirToEquirect(a, yaw, heroU).u) * TAU
}

/**
 * Mip level a 2D sampler picks for an equirect `width` px wide, from the u/v footprint of one
 * screen pixel (ignoring anisotropy). Used by tests to show the naive seam drops to the 1x1 level.
 */
export function mipLevel(duPx: number, dvPx: number, width: number): number {
  const rho = Math.max(Math.abs(duPx) * width, Math.abs(dvPx) * (width / 2))
  return Math.max(0, Math.log2(Math.max(rho, 1e-12)))
}
