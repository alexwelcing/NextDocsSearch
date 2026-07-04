// ARC Terminal phosphor palette + type scale, shared by every in-scene UI surface.

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

export const rgba = (hex: string, a = 1): RGBA => {
  const n = parseInt(hex.slice(1), 16)
  // display-ready values: windfoil text writes straight to the framebuffer
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a]
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
