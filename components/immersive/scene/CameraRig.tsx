// First-person look controls for the 360 scene: pointer/touch drag with inertia, wheel FOV zoom,
// and a gentle idle drift after inactivity — never while a reader/modal or the dock is up, since
// keyboard reading (page turns, typing a query) doesn't count as look input, and never timed
// from behind the boot overlay. The drift eases in from rest and shares one 0.2°/s rotation
// budget with the panorama's spin (see lib/immersive/drift.ts). The camera stays at the
// origin — the world turns around the viewer.

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { attractDrift, attractSpin, stepAttract } from '@/lib/immersive/drift'

const LOOK_SPEED = 0.0032
const TOUCH_SPEED = 0.0044
const DAMPING = 4.5 // velocity decay per second
const PITCH_LIMIT = Math.PI / 2 - 0.12
const FOV_MIN = 45
const FOV_MAX = 85
const IDLE_AFTER_MS = 6000

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
  })

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
      // idle drift — held off (and its idle timer kept fresh) while UI is up, so closing a long
      // read doesn't start the room turning that same instant. The boot overlay counts as UI:
      // idleness is timed from the reveal, not from page load, so the room doesn't start
      // turning a second after it appears, under the arriving world's title card. It eases in,
      // and turns the same way as the panorama spin, which yields to it (drift.ts) so the two
      // never stack.
      const now = performance.now()
      const { modal, dockOpen, bootPhase } = useImmersiveStore.getState()
      if (modal || dockOpen || bootPhase !== 'ready') s.lastInputAt = now
      const idle = !reducedMotion && now - s.lastInputAt > IDLE_AFTER_MS
      s.attract = stepAttract(s.attract, idle, delta)
      attractDrift.gain = easeAttract(s.attract)
      s.yaw -= attractSpin(attractDrift.gain) * delta
    } else {
      s.attract = 0
      attractDrift.gain = 0
    }
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ')
    if (Math.abs(camera.fov - s.targetFov) > 0.05) {
      camera.fov += (s.targetFov - camera.fov) * Math.min(1, delta * 8)
      camera.updateProjectionMatrix()
    }
  })

  return null
}
