// ARC Terminal phosphor palette + type scale, shared by every in-scene UI surface.

import { Color } from 'three/webgpu'
import type { RGBA } from '@/components/immersive/text/WindfoilText'

export const ARC = {
  green: '#70ff8f',
  greenBright: '#a8ffbe',
  greenDim: '#2f7a44',
  greenFaint: '#173824',
  amber: '#ffb454',
  amberDim: '#8a5b24',
  red: '#ff5c47',
  screenBg: '#04130a',
  chassis: '#232a24',
  chassisDark: '#161b17',
  bezel: '#0c100d',
} as const

const scratch = new Color()

/** Palette token → straight-alpha RGBA in the LINEAR working space. Windfoil text (like every
 *  material) renders linear into the frame target and only becomes sRGB in the renderer's
 *  full-frame output pass (tone map + encode), so a raw 0..255/255 hex would be encoded twice and
 *  wash #70ff8f out to pale mint. THREE.Color decodes CSS hex from sRGB, which keeps windfoil on
 *  the same color path as every meshBasicMaterial/CRT tint built from the same tokens. */
export const rgba = (hex: string, a = 1): RGBA => {
  scratch.set(hex)
  return [scratch.r, scratch.g, scratch.b, a]
}

/** Windfoil font sizes for the dock screen (world units; screen is ~0.62 wide). */
export const TYPE = {
  header: 0.03,
  row: 0.0225,
  body: 0.02,
  small: 0.017,
  micro: 0.0145,
} as const

export const FONT = {
  display: 'vt323',
  mono: 'share-tech-mono',
} as const
