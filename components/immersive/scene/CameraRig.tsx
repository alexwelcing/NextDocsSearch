// First-person look controls for the 360 scene: pointer/touch drag with inertia, wheel FOV zoom,
// and a gentle idle drift after inactivity. The camera stays at the origin — the world turns
// around the viewer.

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { PerspectiveCamera } from 'three'
import { useImmersiveStore } from '@/stores/immersiveStore'

const LOOK_SPEED = 0.0032
const TOUCH_SPEED = 0.0044
const DAMPING = 4.5 // velocity decay per second
const PITCH_LIMIT = Math.PI / 2 - 0.12
const FOV_MIN = 45
const FOV_MAX = 85
const IDLE_AFTER_MS = 6000
const IDLE_DRIFT = 0.012 // rad/s yaw

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
      // idle drift
      if (!reducedMotion && performance.now() - s.lastInputAt > IDLE_AFTER_MS) {
        s.yaw += IDLE_DRIFT * delta
      }
    }
    camera.rotation.set(s.pitch, s.yaw, 0, 'YXZ')
    if (Math.abs(camera.fov - s.targetFov) > 0.05) {
      camera.fov += (s.targetFov - camera.fov) * Math.min(1, delta * 8)
      camera.updateProjectionMatrix()
    }
  })

  return null
}
