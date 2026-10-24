// First-person look controls for the 360 scene: pointer/touch drag with inertia, wheel FOV zoom,
// and a gentle idle drift after inactivity — never while a reader/modal or the dock is up, since
// keyboard reading (page turns, typing a query) doesn't count as look input. The drift eases in
// and shares one rotation budget with the panorama's spin (see lib/immersive/drift.ts). The
// camera stays at the origin — the world turns around the viewer.

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
      // read doesn't start the room turning that same instant. It eases in, and turns the same
      // way as the panorama spin, which yields to it (drift.ts) so the two never stack.
      const now = performance.now()
      const { modal, dockOpen } = useImmersiveStore.getState()
      if (modal || dockOpen) s.lastInputAt = now
      const idle = !reducedMotion && now - s.lastInputAt > IDLE_AFTER_MS
      attractDrift.gain = stepAttract(attractDrift.gain, idle, delta)
      s.yaw -= attractSpin(attractDrift.gain) * delta
    } else {
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
