// SPIKE (H1 sky): TSL building blocks for a direction-sampled equirect sky with optional depth
// displacement. Sampling is per-fragment by view direction, so geometry density no longer
// shapes the image (no UV-sphere pole zig-zag) and the same shader serves a 64x32 shell or a
// 1024x512 displaced mesh.

import * as THREE from 'three/webgpu'
import {
  Fn,
  abs,
  asin,
  atan,
  dFdx,
  dFdy,
  float,
  fract,
  max,
  min,
  mix,
  normalize,
  positionLocal,
  select,
  texture,
  uniform,
  varying,
  vec2,
} from 'three/tsl'

type TexNode = ReturnType<typeof texture>
type N = any

const INV_TAU = 1 / (2 * Math.PI)
const INV_PI = 1 / Math.PI

/**
 * Equirect UV for a unit direction in the sky group's frame. Matches the legacy
 * PanoramaSphere mapping (scale -1,1,1 UV sphere) so A/B screenshots line up:
 * u = atan2(z, x)/2π — the start view (-z) is u=0.75 and the image seam (u=0|1) is at +x;
 * v = 0.5 - asin(y)/π — row 0 is the zenith, i.e. textures are sampled with flipY=false, the
 * only orientation compressed textures support, so JPEG/WebP tiers use flipY=false too.
 * Returns u in (-0.5, 0.5]; callers fract() it.
 */
export const dirToEquirect = (d: N): N =>
  vec2(atan(d.z, d.x).mul(INV_TAU), float(0.5).sub(asin(d.y.clamp(-1, 1)).mul(INV_PI)))

/**
 * Sample an equirect with seam-safe gradients (Tarini's two-branch u): atan2 jumps by 1 at -x
 * and fract(u) jumps at +x; per pixel, take derivatives from whichever branch is continuous.
 * Without this the hardware picks the 1x1 mip along a column at the jump — a visible seam line.
 * `blur` scales the gradients (cheap defocus for a hole-fill shell).
 */
export function sampleEquirect(texNode: TexNode, dir: N, blur = 1, naive = false): N {
  const uv0 = dirToEquirect(dir)
  if (naive) return texNode.sample(vec2(fract(uv0.x), uv0.y))
  const uA = uv0.x
  const uB = fract(uA)
  const dAx = dFdx(uA)
  const dAy = dFdy(uA)
  const dBx = dFdx(uB)
  const dBy = dFdy(uB)
  const useA = abs(dAx)
    .add(abs(dAy))
    .lessThan(abs(dBx).add(abs(dBy)))
  const dux = select(useA, dAx, dBx)
  const duy = select(useA, dAy, dBy)
  const gx = vec2(dux, dFdx(uv0.y)).mul(blur)
  const gy = vec2(duy, dFdy(uv0.y)).mul(blur)
  return texNode.sample(vec2(uB, uv0.y)).grad(gx, gy)
}

export interface DepthParams {
  /** Nearest radius (scene units) the depth map's 1.0 maps to. */
  near: { value: number }
  /** Far radius (sky) the depth map's 0.0 maps to. */
  far: { value: number }
  /** 0..1 blend from flat shell (0) to full displacement (1). */
  amount: { value: number }
}

/**
 * Radial displacement of a unit-sphere-ish mesh by an equirect *disparity* map (8-bit:
 * 1 = near, 0 = far). Disparity, not distance, is stored because parallax is proportional
 * to 1/r: 8 bits of disparity give uniform sub-pixel parallax precision for a head-lean of a
 * few tenths of a unit, where 8 bits of distance would band the foreground.
 * Returns { position, stretch } — stretch is the max/min radius ratio over the vertex's
 * neighbourhood (1 = smooth), varying'd to the fragment stage for edge handling.
 */
export function depthDisplacement(
  depthNode: TexNode,
  p: { near: N; far: N; amount: N },
  segments: [number, number]
) {
  const radiusAt = (uv: N): N => {
    const s = depthNode.sample(vec2(fract(uv.x), uv.y.clamp(0, 1))).level(float(0)).r
    const inv = mix(float(1).div(p.far), float(1).div(p.near), s)
    return mix(p.far, float(1).div(inv), p.amount)
  }
  const dir = normalize(positionLocal)
  const uv = dirToEquirect(dir)
  const r = radiusAt(uv)
  const du = 1 / segments[0]
  const dv = 1 / segments[1]
  const rL = radiusAt(uv.add(vec2(-du, 0)))
  const rR = radiusAt(uv.add(vec2(du, 0)))
  const rU = radiusAt(uv.add(vec2(0, -dv)))
  const rD = radiusAt(uv.add(vec2(0, dv)))
  const rMax = max(max(max(rL, rR), max(rU, rD)), r)
  const rMin = min(min(min(rL, rR), min(rU, rD)), r)
  const stretch = varying(rMax.div(rMin), 'vSkyStretch')
  return { position: dir.mul(r), stretch }
}

export function makeDepthUniforms(near: number, far: number) {
  return { near: uniform(near), far: uniform(far), amount: uniform(1) }
}

export type { THREE }
