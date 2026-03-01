/**
 * SearchPulse — Expanding ring that fires when a search executes
 *
 * Placed at the search centroid, the ring scales outward and fades,
 * giving immediate visual feedback that a query landed.
 */

import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export interface SearchPulseProps {
  center: [number, number, number]
  active: boolean
  color?: string
  maxRadius?: number
  speed?: number
}

export default function SearchPulse({
  center,
  active,
  color = '#00ffcc',
  maxRadius = 30,
  speed = 25,
}: SearchPulseProps) {
  const ringRef = useRef<THREE.Mesh>(null!)
  const scaleRef = useRef(0)

  useFrame((_state, delta) => {
    if (!ringRef.current) return
    if (active && scaleRef.current < maxRadius) {
      scaleRef.current += delta * speed
      ringRef.current.scale.setScalar(scaleRef.current)
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.3 - scaleRef.current / 100)
    } else if (!active) {
      scaleRef.current = 0
      ringRef.current.scale.setScalar(0)
    }
  })

  return (
    <mesh ref={ringRef} position={center} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1.0, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
