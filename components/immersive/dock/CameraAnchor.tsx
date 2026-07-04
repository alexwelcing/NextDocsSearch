// Camera-attachment strategies for in-scene UI.
//
// CameraAnchor: full 6-DOF spring lock — the object trails the exact gaze. Right for modals and
// HUD chips that must always be readable at screen-center.
//
// LeashedAnchor: yaw is WORLD-anchored inside a deadband — summon the dock and it stays put in
// the room while you look around, like a console you glanced down at, only sliding along on a
// slack leash once your gaze drifts past the deadband edge. Pitch stays camera-referenced (a
// soft spring), so the dock never strands itself out of vertical reach when you look up or down.
// This is the classic HMD "lazy follow" split: yaw feels physical, pitch stays ergonomic.

import { ReactNode, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'

const tmpPos = new THREE.Vector3()
const tmpQuat = new THREE.Quaternion()

export function CameraAnchor({
  children,
  stiffness = 14,
}: {
  children: ReactNode
  /** Higher = tighter follow; ~10-20 feels handheld. */
  stiffness?: number
}) {
  const group = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const initialized = useRef(false)

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    camera.getWorldPosition(tmpPos)
    camera.getWorldQuaternion(tmpQuat)
    if (!initialized.current) {
      g.position.copy(tmpPos)
      g.quaternion.copy(tmpQuat)
      initialized.current = true
      return
    }
    const t = 1 - Math.exp(-stiffness * delta)
    g.position.lerp(tmpPos, t)
    g.quaternion.slerp(tmpQuat, t)
  })

  return <group ref={group}>{children}</group>
}

/** Shortest signed angular difference a → b, wrapped to [-π, π]. */
function angleDelta(a: number, b: number): number {
  const d = b - a
  return Math.atan2(Math.sin(d), Math.cos(d))
}

export function LeashedAnchor({
  children,
  yawDeadband = 0.55,
  leashStiffness = 4.5,
  pitchStiffness = 14,
  recenterOn,
}: {
  children: ReactNode
  /** Half-width of the world-anchored yaw zone, radians (~31° default). */
  yawDeadband?: number
  /** How quickly the anchor is dragged once outside the deadband. */
  leashStiffness?: number
  pitchStiffness?: number
  /** Whenever this value changes, the anchor snaps back to the current gaze yaw (e.g. pass
   *  dockOpen so summoning always presents the dock centered). */
  recenterOn?: unknown
}) {
  const group = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const anchorYaw = useRef<number | null>(null)
  const pitch = useRef(0)
  const wantRecenter = useRef(true)

  useEffect(() => {
    wantRecenter.current = true
  }, [recenterOn])

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    // CameraRig writes camera.rotation as (pitch, yaw, 0, 'YXZ') every frame, so the euler
    // components are directly readable — no quaternion decomposition needed.
    const camYaw = camera.rotation.y
    const camPitch = camera.rotation.x

    if (anchorYaw.current === null || wantRecenter.current) {
      anchorYaw.current = camYaw
      pitch.current = camPitch
      wantRecenter.current = false
    } else {
      const delta_ = angleDelta(anchorYaw.current, camYaw)
      const excess =
        Math.abs(delta_) > yawDeadband ? delta_ - Math.sign(delta_) * yawDeadband : 0
      if (excess !== 0) {
        anchorYaw.current += excess * (1 - Math.exp(-leashStiffness * delta))
        anchorYaw.current = Math.atan2(Math.sin(anchorYaw.current), Math.cos(anchorYaw.current))
      }
      pitch.current += (camPitch - pitch.current) * (1 - Math.exp(-pitchStiffness * delta))
    }

    camera.getWorldPosition(tmpPos)
    g.position.copy(tmpPos)
    g.rotation.set(pitch.current, anchorYaw.current, 0, 'YXZ')
  })

  return <group ref={group}>{children}</group>
}
