/**
 * NodeRenderer — Generic interactive 3D point with state machine
 *
 * Handles hover/select state transitions, smooth scaling, glow halos,
 * and billboard labels. Caller provides the visual content via children
 * or uses the default icosahedron.
 */

import React, { useRef, useState, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

export type NodeState = 'idle' | 'hover' | 'selected' | 'highlight'

export interface NodeRendererProps {
  position: [number, number, number]
  color: THREE.Color | string
  state?: NodeState
  /** 0–1 intensity for highlight glow (search relevance, etc.) */
  highlightIntensity?: number
  label?: string
  sublabel?: string
  /** Show label only when hovered/selected/highlighted above threshold */
  labelThreshold?: number
  onClick?: () => void
  children?: ReactNode
}

const SCALE: Record<NodeState, number> = {
  idle: 0.4,
  hover: 0.7,
  selected: 1.8,
  highlight: 1.2,
}

const EMISSIVE: Record<NodeState, number> = {
  idle: 0.15,
  hover: 0.5,
  selected: 2.0,
  highlight: 1.2,
}

export default function NodeRenderer({
  position,
  color,
  state = 'idle',
  highlightIntensity = 0,
  label,
  sublabel,
  labelThreshold = 0.5,
  onClick,
  children,
}: NodeRendererProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)

  const effectiveState = hovered && state === 'idle' ? 'hover' : state
  const targetScale =
    effectiveState === 'highlight'
      ? 1.0 + highlightIntensity * 0.8
      : SCALE[effectiveState]
  const targetEmissive =
    effectiveState === 'highlight'
      ? 0.8 + highlightIntensity * 1.2
      : EMISSIVE[effectiveState]

  const showLabel =
    effectiveState === 'selected' ||
    effectiveState === 'hover' ||
    highlightIntensity > labelThreshold

  const threeColor =
    typeof color === 'string' ? new THREE.Color(color) : color

  useFrame((_s, delta) => {
    if (!meshRef.current) return
    const t = 1 - Math.pow(0.001, delta)

    const s = meshRef.current.scale.x
    meshRef.current.scale.setScalar(s + (targetScale - s) * t)

    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    if (mat.emissiveIntensity !== undefined) {
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * t
    }

    if (glowRef.current) {
      glowRef.current.scale.setScalar(meshRef.current.scale.x * 2.5)
      const gMat = glowRef.current.material as THREE.MeshBasicMaterial
      const targetOpacity =
        effectiveState === 'selected' || highlightIntensity > 0 ? 0.25 : 0.05
      gMat.opacity += (targetOpacity - gMat.opacity) * t
    }
  })

  return (
    <group position={position}>
      {/* Core mesh — use children or default icosahedron */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {children ?? (
          <>
            <icosahedronGeometry args={[0.5, 1]} />
            <meshStandardMaterial
              color={threeColor}
              emissive={threeColor}
              emissiveIntensity={0.15}
              metalness={0.6}
              roughness={0.3}
              transparent
              opacity={0.9}
            />
          </>
        )}
      </mesh>

      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial
          color={threeColor}
          transparent
          opacity={0.05}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Billboard label */}
      {showLabel && label && (
        <Billboard position={[0, 1.2, 0]}>
          <Text
            fontSize={0.35}
            color={effectiveState === 'selected' ? '#ffffff' : '#cccccc'}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.02}
            outlineColor="#000000"
            maxWidth={8}
          >
            {label}
          </Text>
          {sublabel && (
            <Text
              fontSize={0.2}
              color="#00ffcc"
              anchorX="center"
              anchorY="top"
              position={[0, -0.15, 0]}
            >
              {sublabel}
            </Text>
          )}
        </Billboard>
      )}
    </group>
  )
}
