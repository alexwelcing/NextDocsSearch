// First-person look controls for the 360 scene: pointer/touch drag with inertia, wheel FOV zoom,
// and a gentle idle drift after inactivity — never while a reader/modal or the dock is up, since
// keyboard reading (page turns, typing a query) doesn't count as look input, and never timed
// from behind the boot overlay. The drift eases in from rest and shares one 0.2°/s rotation
// budget with the panorama's spin (see lib/immersive/drift.ts). The camera stays at the
// origin — the world turns around the viewer — except under the ?depth=1 debug flag, where a
// small pointer-driven head-lean gives the depth-parallax experiment something to show.

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { useImmersiveStore, type BootPhase, type ImmersiveModal } from '@/stores/immersiveStore'
import { attractDrift, attractSpin, stepAttract } from '@/lib/immersive/drift'
import { SKY_DEBUG, skyDebugHandle } from '@/lib/immersive/sky/debug'

const LOOK_SPEED = 0.0032
const TOUCH_SPEED = 0.0044
const DAMPING = 4.5 // velocity decay per second
const PITCH_LIMIT = Math.PI / 2 - 0.12
const FOV_MIN = 45
const FOV_MAX = 85
export const IDLE_AFTER_MS = 6000
const DEG = Math.PI / 180
// DEBUG (?depth=1) head-lean: camera translation in the yaw frame, scene units (sky radius 60,
// nearest depth 4), damped toward the pointer. Off under reduced motion.
const LEAN_X = 0.3
const LEAN_Y = 0.12
const LEAN_RATE = 6 // 1/s

/** The UI that holds the idle drift off: a reader/modal, the dock, or the boot overlay. */
export interface IdleHolds {
  modal: ImmersiveModal
  dockOpen: boolean
  bootPhase: BootPhase
}

/**
 * One frame of the idle clock: when the visitor last counts as active. UI keeps it fresh, so
 * closing a long read doesn't start the room turning that same instant — and the boot overlay
 * counts as UI, so idleness is timed from the reveal, not from page load, and the room doesn't
 * start turning a second after it appears, under the arriving world's title card.
 */
export function nextLastInputAt(lastInputAt: number, now: number, ui: IdleHolds): number {
  return ui.modal || ui.dockOpen || ui.bootPhase !== 'ready' ? now : lastInputAt
}

/** Whether the attract drift may run: IDLE_AFTER_MS without look input, and never under
 *  reduced motion. */
export function isIdle(lastInputAt: number, now: number, reducedMotion: boolean): boolean {
  return !reducedMotion && now - lastInputAt > IDLE_AFTER_MS
}

/**
 * Attract gain from its linear ramp (drift.ts stepAttract): smoothstep, so the drift's rate
 * leaves rest and arrives at the 0.2°/s ceiling with zero acceleration — no kink at either end
 * of the ease. Published as the shared gain, so the panorama yields by the same amount and the
 * two still sum to at most the ceiling.
 */
export function easeAttract(ramp: number): number {
  const t = ramp > 0 ? (ramp < 1 ? ramp : 1) : 0
  return t * t * (3 - 2 * t)
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const reducedMotion = useImmersiveStore((s) => s.reducedMotion)

  const state = useRef({
    yaw: 0,
    pitch: 0,
    velYaw: 0,
    velPitch: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    targetFov: 70,
    lastInputAt: 0,
    /** Linear 0..1 attract ramp; attractDrift.gain is its eased value. */
    attract: 0,
    lean: { x: 0, y: 0, tx: 0, ty: 0 },
  })

  // Debug: a fixed starting view (?look=yaw,pitch[,fov], degrees) and, for probes, a setter.
  useEffect(() => {
    const s = state.current
    const look = (yawDeg: number, pitchDeg: number, fov?: number | null) => {
      s.yaw = -yawDeg * DEG // +yaw turns right; camera yaw is counter-clockwise
      s.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitchDeg * DEG))
      s.velYaw = s.velPitch = 0
      if (fov) {
        s.targetFov = camera.fov = fov
        camera.updateProjectionMatrix()
      }
    }
    if (SKY_DEBUG.look) look(SKY_DEBUG.look.yaw, SKY_DEBUG.look.pitch, SKY_DEBUG.look.fov)
    const h = skyDebugHandle()
    if (h) h.look = look
  }, [camera])

  // Debug: pointer-driven head-lean for the depth-parallax experiment.
  useEffect(() => {
    if (!SKY_DEBUG.depth) return
    const s = state.current
    const onMove = (e: PointerEvent) => {
      if (s.dragging) return
      s.lean.tx = (e.clientX / window.innerWidth) * 2 - 1
      s.lean.ty = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useEffect(() => {
    const el = gl.domElement
    const s = state.current
    s.targetFov = camera.fov

    const onPointerDown = (e: PointerEvent) => {
      // Dock/modal meshes stop propagation via R3F events; anything reaching here grabs the view.
      s.dragging = true
      s.lastX = e.clientX
      s.lastY = e.clientY
      s.lastInputAt = performance.now()
      el.setPointerCapture(e.pointerId)
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!s.dragging) return
      const speed = e.pointerType === 'touch' ? TOUCH_SPEED : LOOK_SPEED
      const dx = e.clientX - s.lastX
      const dy = e.clientY - s.lastY
      s.lastX = e.clientX
      s.lastY = e.clientY
      s.velYaw = -dx * speed * 60
      s.velPitch = -dy * speed * 60
      s.yaw += -dx * speed
      s.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, s.pitch - dy * speed))
      s.lastInputAt = performance.now()
    }
    const onPointerUp = (e: PointerEvent) => {
      s.dragging = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      s.targetFov = Math.max(FOV_MIN, Math.min(FOV_MAX, s.targetFov + e.deltaY * 0.04))
      s.lastInputAt = performance.now()
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      s.attract = 0
      attractDrift.gain = 0
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl, camera])

  useFrame((_, delta) => {
    const s = state.current
    if (!s.dragging) {
      // inertia
      s.yaw += s.velYaw * delta
      s.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, s.pitch + s.velPitch * delta))
      const decay = Math.exp(-DAMPING * delta)
      s.velYaw *= decay
      s.velPitch *= decay
      // idle drift — held off (and its idle timer kept fresh) while UI or the boot overlay is up
      // (nextLastInputAt). It eases in, and turns the same way as the panorama spin, which
      // yields to it (drift.ts) so the two never stack.
      const now = performance.now()
      s.lastInputAt = nextLastInputAt(s.lastInputAt, now, useImmersiveStore.getState())
      const idle = isIdle(s.lastInputAt, now, reducedMotion || SKY_DEBUG.still)
      s.attract = stepAttract(s.attract, idle, delta)
      attractDrift.gain = easeAttract(s.attract)
      s.yaw -= attractSpin(attractDrift.gain) * delta
    } else {
      s.attract = 0
      attractDrift.gain = 0
    }
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ')
    if (SKY_DEBUG.depth && !reducedMotion) {
      const l = s.lean
      const k = 1 - Math.exp(-LEAN_RATE * delta)
      l.x += (l.tx - l.x) * k
      l.y += (l.ty - l.y) * k
      // Lean in the yaw frame: camera right = (cos yaw, 0, −sin yaw).
      const ox = l.x * LEAN_X
      camera.position.set(ox * Math.cos(s.yaw), l.y * LEAN_Y, -ox * Math.sin(s.yaw))
    }
    if (Math.abs(camera.fov - s.targetFov) > 0.05) {
      camera.fov += (s.targetFov - camera.fov) * Math.min(1, delta * 8)
      camera.updateProjectionMatrix()
    }
  })

  return null
}
