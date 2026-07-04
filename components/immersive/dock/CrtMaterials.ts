// TSL materials for the ARC CRT: the phosphor screen base and the scanline/rolling-bar/vignette
// overlay. Built once per module load; every screen instance shares them.

import * as THREE from 'three/webgpu'
import { abs, float, fract, hash, mix, sin, smoothstep, time, uv, vec3, vec4 } from 'three/tsl'
import { ARC } from '@/lib/immersive/theme'

// vec3 from a hex string (TSL's vec3 typings don't accept THREE.Color directly)
function c3(hex: string) {
  const c = new THREE.Color(hex)
  return vec3(c.r, c.g, c.b)
}

/** Dark phosphor glass: radial falloff + faint grid + idle glow breathing. */
export function createScreenBaseMaterial(): THREE.NodeMaterial {
  const material = new THREE.NodeMaterial()
  const u = uv()
  const centered = u.sub(0.5)
  const r2 = centered.dot(centered)

  const bg = c3(ARC.screenBg)
  const glowTint = c3(ARC.greenFaint)

  // faint aperture grid
  const grid = sin(u.y.mul(560))
    .mul(0.5)
    .add(0.5)
    .mul(0.06)
    .add(sin(u.x.mul(720)).mul(0.5).add(0.5).mul(0.03))
  // center glow breathing very slightly
  const breathe = sin(time.mul(0.8)).mul(0.05).add(0.95)
  const glow = smoothstep(0.55, 0.0, r2).mul(0.5).mul(breathe)

  material.colorNode = vec4(bg.add(glowTint.mul(glow)).add(vec3(grid).mul(glowTint)), 1)
  material.side = THREE.FrontSide
  material.fog = false // emissive screen — scene fog must not haze it
  return material
}

/** Multiply overlay: scanlines, slow rolling bar, vignette, occasional flicker dip. */
export function createScanlineOverlayMaterial(): THREE.NodeMaterial {
  const material = new THREE.NodeMaterial()
  const u = uv()

  // scanlines (multiply toward 1 = no-op, dips darken)
  const scan = sin(u.y.mul(float(400)).add(time.mul(2)))
    .mul(0.5)
    .add(0.5)
    .mul(0.18)
  // rolling bar sweeping every ~6s
  const barPos = fract(time.mul(0.16))
  const bar = smoothstep(0.06, 0.0, abs(u.y.sub(barPos))).mul(0.12)
  // vignette
  const centered = u.sub(0.5)
  const vig = centered.dot(centered).mul(0.32)
  // stochastic frame flicker (rare, subtle)
  const flick = smoothstep(0.985, 1.0, hash(time.mul(60).floor())).mul(0.08)

  const darken = scan.add(bar).add(vig).add(flick).clamp(0, 0.6)
  material.colorNode = vec4(vec3(float(1).sub(darken)), 1)
  material.blending = THREE.MultiplyBlending
  material.premultipliedAlpha = true // WebGPU requires it for multiply blending
  material.transparent = true
  material.depthWrite = false
  material.fog = false // multiply overlay: fogging it would brighten, not haze
  return material
}

/** Additive overlay: phosphor bloom in the center + sparse static sparkle. */
export function createGlowOverlayMaterial(): THREE.NodeMaterial {
  const material = new THREE.NodeMaterial()
  const u = uv()
  const centered = u.sub(0.5)
  const r2 = centered.dot(centered)

  const halo = smoothstep(0.5, 0.0, r2).mul(0.05)
  const staticNoise = hash(u.mul(vec3(913, 517, 1).xy).add(time.mul(9).floor())).mul(0.03)

  const tint = c3(ARC.green)
  material.colorNode = vec4(tint.mul(halo.add(staticNoise)), 1)
  material.blending = THREE.AdditiveBlending
  material.transparent = true
  material.depthWrite = false
  material.fog = false // additive overlay: fog would add haze color, not attenuate
  return material
}
