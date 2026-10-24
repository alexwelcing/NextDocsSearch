// Idle-motion budget for the 360 scene. Two things turn the room while nobody touches it: the
// panorama's own slow spin (PanoramaSphere, per-world `drift`) and CameraRig's attract drift
// after a stretch of idleness. Both draw on ONE ceiling, so together they never read as a
// screensaver — and both turn the view the same way, so the sky never reverses when the attract
// drift takes over.
//
// Direction: PanoramaSphere spins its group +y, which slides the sky left across the screen;
// the camera's attract drift is applied as yaw −= rate, which slides the whole room left too.

/** Ceiling on any idle rotation the visitor sees, rad/s — 0.2°/s. */
export const MAX_IDLE_SPIN = (0.2 * Math.PI) / 180

/** Seconds the attract drift takes to ease in from rest. */
export const ATTRACT_RAMP_S = 2

/**
 * How far the camera's attract drift has eased in, 0..1. Written by CameraRig every frame and
 * read by PanoramaSphere in its own frame callback — a plain shared value rather than store
 * state, so a per-frame number never notifies React subscribers.
 */
export const attractDrift = { gain: 0 }

/** One frame of the attract gain: ramps 0→1 over ATTRACT_RAMP_S while idle, and drops to 0
 *  the moment input, a modal or the dock takes over. */
export function stepAttract(gain: number, idle: boolean, delta: number): number {
  if (!idle) return 0
  return Math.min(1, gain + Math.max(delta, 0) / ATTRACT_RAMP_S)
}

/** Camera attract-drift rate, rad/s, for an attract gain. */
export function attractSpin(attract: number): number {
  return MAX_IDLE_SPIN * clamp01(attract)
}

/**
 * Panorama spin rate, rad/s: the world's own drift, capped, scaled by the hold gain (eases to 0
 * behind a modal or the dock) and yielded to the attract drift — so the sky's total turn,
 * attractSpin(a) + panoramaSpin(d, h, a), stays within MAX_IDLE_SPIN.
 */
export function panoramaSpin(worldDrift: number, hold: number, attract: number): number {
  const own = Math.min(Math.max(worldDrift, 0), MAX_IDLE_SPIN)
  return own * clamp01(hold) * (1 - clamp01(attract))
}

function clamp01(v: number): number {
  return v > 0 ? (v < 1 ? v : 1) : 0
}
