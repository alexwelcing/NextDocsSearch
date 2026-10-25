// Sky v2 TSL: a direction-sampled equirect sky with a two-slot crossfade. One mesh, one material,
// one pipeline for every world and tier — swapping a slot's texture (`texA.value = …`) never
// recompiles, because every texture it ever holds (placeholder, WebP, JPEG, KTX2) is a filterable
// sRGB 2D texture with the same bind-group layout.
//
// Sampling is per fragment by view direction, so geometry density no longer shapes the image (no
// UV-sphere meridian kinks at the poles, a 64x32 shell is plenty), and the u=0|1 seam is drawn
// with seam-safe gradients (equirect.ts seamSafeAzimuthDelta is the CPU twin, with tests).
//
// Node API (uniforms) for the transition and lighting work that builds on it (H1-C):
//   uMix        0 shows slot A, 1 shows slot B
//   uYaw        sky turn, radians (idle drift); positive slides the sky left
//   uGrad       gradient scale: 1 = hardware mip choice, >1 blurs (a desktop LOD bias, or defocus)
//   a/b.exposure  linear gain per slot (WorldDef.exposure), so a crossfade keeps both worlds' gain
//   a/b.offset    heroOffset(heroU) per slot: where each image's start view is

import * as THREE from 'three/webgpu'
import {
  Discard,
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
  vec4,
} from 'three/tsl'

/** Sky shell radius, scene units (inside the camera far plane of 300, outside everything else). */
export const SKY_RADIUS = 60

const INV_TAU = 1 / (2 * Math.PI)
const INV_PI = 1 / Math.PI

/** The canvas clear colour (#020403), as the stand-in for an empty slot. */
const PLACEHOLDER_RGBA = [2, 4, 3, 255]

/**
 * A 1x1 stand-in for an empty slot. It must be Linear-filtered like a real sky: three's WGSL
 * builder only declares a sampler for filterable textures, and a grad sample against a
 * sampler-less placeholder fails WGSL validation ('unresolved value nodeUniform0_sampler'). Same
 * filterability and colour space also keep every later swap on the same bind-group layout.
 *
 * Each slot needs its OWN placeholder: three dedupes texture bindings by the texture's uuid at
 * build time (TextureNode.getUniformHash), so two slots built on one placeholder compile to a
 * single binding, and slot B silently samples whatever slot A holds.
 */
export function createPlaceholder(colorSpace: string = THREE.SRGBColorSpace): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(PLACEHOLDER_RGBA), 1, 1)
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.RepeatWrapping
  t.colorSpace = colorSpace
  t.needsUpdate = true
  return t
}

type TexNode = ReturnType<typeof texture>
const floatUniform = (value: number) => uniform(value)
/** A float uniform node (`.value` is a number). */
export type FloatUniform = ReturnType<typeof floatUniform>
// TSL's typings for intermediate nodes are deep generics; the builders below only need them as
// opaque values to pass along.
type N = any

/** Equirect coordinates of a unit direction before the per-slot hero offset: `base` is
 *  (azimuth + yaw)/2π (unwrapped), `v` = 0.5 − asin(y)/π (row 0 = zenith). */
export function equirectBase(dir: N, yaw: N): { base: N; v: N } {
  return {
    base: atan(dir.z, dir.x).add(yaw).mul(INV_TAU),
    v: float(0.5).sub(asin(dir.y.clamp(-1, 1)).mul(INV_PI)),
  }
}

/**
 * Screen-space gradients of (u, v) with the seam handled: atan2(z, x) jumps by 2π at −x and
 * atan2(−z, −x) at +x, and per axis the smaller derivative of the two is the true one. Neither
 * yaw nor the hero offset changes a derivative, so one pair serves both slots.
 */
export function seamSafeGradients(dir: N, v: N, scale: N): { gx: N; gy: N } {
  const a = atan(dir.z, dir.x)
  const b = atan(dir.z.negate(), dir.x.negate())
  const ax = dFdx(a)
  const ay = dFdy(a)
  const bx = dFdx(b)
  const by = dFdy(b)
  const dux = select(abs(ax).lessThan(abs(bx)), ax, bx).mul(INV_TAU)
  const duy = select(abs(ay).lessThan(abs(by)), ay, by).mul(INV_TAU)
  return {
    gx: vec2(dux, dFdx(v)).mul(scale),
    gy: vec2(duy, dFdy(v)).mul(scale),
  }
}

export interface SkySlotUniforms {
  exposure: FloatUniform
  offset: FloatUniform
}

export interface SkyNodes {
  texA: TexNode
  texB: TexNode
  /** Each slot's stand-in while empty, [A, B] — distinct objects (see createPlaceholder). */
  placeholders: readonly [THREE.DataTexture, THREE.DataTexture]
  mix: FloatUniform
  yaw: FloatUniform
  grad: FloatUniform
  a: SkySlotUniforms
  b: SkySlotUniforms
  /** Fragment colour: mix(A·expA, B·expB, uMix) sampled along the view direction. */
  color: N
  /** The same colour graph with the gradients scaled by `gradScale` (a defocused copy). */
  colorAt(gradScale: N): N
}

/** Build the sky's node graph. Call once per sky; the textures/uniforms are its whole API. */
export function createSkyNodes(): SkyNodes {
  const placeholders = [createPlaceholder(), createPlaceholder()] as const
  const texA = texture(placeholders[0])
  const texB = texture(placeholders[1])
  const uMix = floatUniform(0)
  const uYaw = floatUniform(0)
  const uGrad = floatUniform(1)
  const a = { exposure: floatUniform(1), offset: floatUniform(0) }
  const b = { exposure: floatUniform(1), offset: floatUniform(0) }

  const colorAt = (gradScale: N): N =>
    Fn(() => {
      const dir = normalize(positionLocal)
      const { base, v } = equirectBase(dir, uYaw)
      const { gx, gy } = seamSafeGradients(dir, v, gradScale)
      const cA = texA
        .sample(vec2(fract(base.add(a.offset)), v))
        .grad(gx, gy)
        .rgb.mul(a.exposure)
      const cB = texB
        .sample(vec2(fract(base.add(b.offset)), v))
        .grad(gx, gy)
        .rgb.mul(b.exposure)
      return vec4(mix(cA, cB, uMix), 1)
    })()

  return {
    texA,
    texB,
    placeholders,
    mix: uMix,
    yaw: uYaw,
    grad: uGrad,
    a,
    b,
    color: colorAt(uGrad),
    colorAt,
  }
}

/** The sky shell's material: unlit, fog-free, behind everything (no depth write). */
export function createSkyMaterial(nodes: SkyNodes): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
  material.colorNode = nodes.color
  return material
}

// ---- Depth parallax: DEBUG ONLY (?depth=1). The H1 spike's verifier ruled it NO-GO for shipping:
// over the 1440p budget (+0.62-0.66 ms vs 0.4), silhouettes ghost when looking down, and far=60
// makes 'infinity' parallax too. Kept as an H2 experiment behind the flag.

export interface DepthUniforms {
  /** Radius (scene units) a disparity of 1 maps to. */
  near: FloatUniform
  /** Radius a disparity of 0 maps to (the sky shell). */
  far: FloatUniform
  /** heroOffset of the world the depth map belongs to. */
  offset: FloatUniform
}

/** Above this max/min neighbour-radius ratio a triangle straddles a depth edge and is dropped. */
export const STRETCH_DISCARD = 1.18

/**
 * Radial displacement of a dense sphere by an equirect 8-bit disparity map (1 = near, 0 = far):
 * disparity, not distance, because parallax goes as 1/r. Returns the displaced position and a
 * per-vertex stretch metric (max/min radius over its 4 neighbours) varying'd to the fragment
 * stage for edge discard.
 */
export function depthDisplacement(
  depthTex: TexNode,
  u: DepthUniforms,
  yaw: N,
  segments: readonly [number, number]
): { position: N; stretch: N } {
  const radiusAt = (uvn: N): N => {
    const s = depthTex.sample(vec2(fract(uvn.x), uvn.y.clamp(0, 1))).level(float(0)).r
    return float(1).div(mix(float(1).div(u.far), float(1).div(u.near), s))
  }
  const dir = normalize(positionLocal)
  const { base, v } = equirectBase(dir, yaw)
  const uv0 = vec2(base.add(u.offset), v)
  const r = radiusAt(uv0)
  const du = 1 / segments[0]
  const dv = 1 / segments[1]
  const rL = radiusAt(uv0.add(vec2(-du, 0)))
  const rR = radiusAt(uv0.add(vec2(du, 0)))
  const rU = radiusAt(uv0.add(vec2(0, -dv)))
  const rD = radiusAt(uv0.add(vec2(0, dv)))
  const rMax = max(max(max(rL, rR), max(rU, rD)), r)
  const rMin = min(min(min(rL, rR), min(rU, rD)), r)
  return { position: dir.mul(r), stretch: varying(rMax.div(rMin), 'vSkyStretch') }
}

/** Debug depth material: the same colour graph on a displaced mesh, edges discarded. */
export function createDepthSkyMaterial(
  nodes: SkyNodes,
  depthTex: TexNode,
  u: DepthUniforms,
  segments: readonly [number, number]
): THREE.MeshBasicNodeMaterial {
  const material = new THREE.MeshBasicNodeMaterial({
    side: THREE.DoubleSide,
    depthWrite: true,
    fog: false,
  })
  const d = depthDisplacement(depthTex, u, nodes.yaw, segments)
  material.positionNode = d.position
  material.colorNode = Fn(() => {
    Discard(d.stretch.greaterThan(STRETCH_DISCARD))
    return nodes.color
  })()
  return material
}
