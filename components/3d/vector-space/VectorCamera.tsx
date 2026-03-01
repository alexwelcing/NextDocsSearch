/**
 * VectorCamera — Smooth camera navigation toward search centroids
 *
 * When a search returns results the camera lerps toward the centroid
 * from a fixed offset, giving a "fly-to" feel without disorienting
 * the user.
 */

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

export interface VectorCameraProps {
  target: [number, number, number] | null
  isActive: boolean
  offset?: [number, number, number]
  lerpSpeed?: number
}

export default function VectorCamera({
  target,
  isActive,
  offset = [8, 5, 12],
  lerpSpeed = 0.5,
}: VectorCameraProps) {
  const { camera } = useThree()
  const currentTarget = useRef(new THREE.Vector3(0, 0, 0))
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0))
  const offsetVec = useRef(new THREE.Vector3(...offset))

  useEffect(() => {
    offsetVec.current.set(...offset)
  }, [offset])

  useEffect(() => {
    if (target && isActive) {
      desiredTarget.current.set(target[0], target[1], target[2])
    }
  }, [target, isActive])

  useFrame((_state, delta) => {
    if (!isActive) return

    const t = 1 - Math.pow(0.005, delta)
    currentTarget.current.lerp(desiredTarget.current, t)

    const desiredPos = currentTarget.current.clone().add(offsetVec.current)
    camera.position.lerp(desiredPos, t * lerpSpeed)
    camera.lookAt(currentTarget.current)
  })

  return null
}
