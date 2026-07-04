// Anchors children to the camera with a soft spring, so camera-mounted UI (the ARC dock) trails
// the view with a little physical weight instead of being welded to the lens.

import { ReactNode, useRef } from 'react'
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
