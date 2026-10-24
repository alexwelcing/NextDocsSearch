// Viewport fit for the camera-anchored in-scene UI, plus the device-class quality hint.
//
// three's PerspectiveCamera.fov is VERTICAL, so the horizontal view shrinks with the aspect: the
// 70° camera on a 390x844 portrait phone sees only ~36° across, while the reader slab spans ~60°
// and the ARC dock ~47°. fitScale shrinks a panel just enough to sit inside the view (never
// enlarges it), so landscape layouts are untouched and portrait phones stop clipping.

import type { QualityTier } from '@/stores/immersiveStore'

const DEG = Math.PI / 180

/** Fraction of the view a fitted panel may span — leaves a sliver of world at the edges. */
export const FIT_MARGIN = 0.92

/** Horizontal field of view (radians) for a vertical fov in degrees and an aspect (w / h). */
export function horizontalFov(vFovDeg: number, aspect: number): number {
  return 2 * Math.atan(Math.tan((vFovDeg * DEG) / 2) * aspect)
}

export interface FitInput {
  /** Camera vertical field of view, degrees (PerspectiveCamera.fov). */
  vFov: number
  /** Viewport aspect, width / height. */
  aspect: number
  /** Camera → panel-anchor distance along the view axis, metres. */
  distance: number
  /** Panel width at scale 1, metres. */
  width: number
  /** Panel height at scale 1, metres. Vertical fit is only enforced when given. */
  height?: number
  /** How far the panel's widest edge sits in front of its anchor plane at scale 1 (a tilted
   *  console's near edge), metres. Scales with the panel. */
  nearOffset?: number
  /** Fraction of the view the panel may fill. */
  margin?: number
}

/**
 * Uniform scale (≤ 1) that keeps a panel inside the camera frustum. For a flat, centred panel
 * this is min(1, margin·2·d·tan(hFov/2) / W); a near edge pulled toward the camera by
 * `nearOffset` is solved exactly: (W/2)·s ≤ margin·tan(hFov/2)·(d − nearOffset·s).
 */
export function fitScale({
  vFov,
  aspect,
  distance,
  width,
  height,
  nearOffset = 0,
  margin = FIT_MARGIN,
}: FitInput): number {
  if (!(aspect > 0) || !(distance > 0) || !(width > 0) || !(vFov > 0)) return 1
  const tanV = Math.tan((vFov * DEG) / 2)
  const tanH = tanV * aspect // tan(hFov / 2)
  let s = (margin * tanH * distance) / (width / 2 + margin * tanH * nearOffset)
  if (height && height > 0) {
    s = Math.min(s, (margin * tanV * distance) / (height / 2 + margin * tanV * nearOffset))
  }
  return Math.min(1, s)
}

/** Below this many physical horizontal screen pixels a device starts on the 'low' tier. */
export const LOW_TIER_SCREEN_PX = 1400

export interface DeviceHints {
  /** matchMedia('(pointer: coarse)') — the primary pointer is a finger. */
  coarsePointer: boolean
  /** screen.width in CSS px (the device, not the window — a narrow desktop window is not a
   *  weak GPU). */
  screenWidth: number
  devicePixelRatio: number
  /** navigator.deviceMemory (Chromium only; GiB, capped at 8). */
  deviceMemory?: number
}

/** Initial render-quality tier from coarse device signals: touch-first devices and small
 *  physical screens start 'low' (no PostFX, capped DPR, fewer motes). */
export function qualityHint({
  coarsePointer,
  screenWidth,
  devicePixelRatio,
  deviceMemory,
}: DeviceHints): QualityTier {
  if (coarsePointer) return 'low'
  if (screenWidth > 0 && screenWidth * (devicePixelRatio || 1) < LOW_TIER_SCREEN_PX) return 'low'
  if (deviceMemory !== undefined && deviceMemory <= 4) return 'low'
  return 'high'
}
