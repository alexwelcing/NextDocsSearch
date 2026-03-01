/**
 * VectorConnections — Lines between search result nodes
 *
 * Builds line geometry from search results and their positions,
 * pulsing opacity to indicate active search relationships.
 */

import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { SearchHit } from './types'

export interface VectorConnectionsProps {
  positions: Map<string, [number, number, number]>
  searchResults: SearchHit[]
  color?: string
  maxConnections?: number
}

export default function VectorConnections({
  positions,
  searchResults,
  color = '#00ffcc',
  maxConnections = 8,
}: VectorConnectionsProps) {
  const lineRef = useRef<THREE.LineSegments>(null!)

  const geometry = useMemo(() => {
    const hits = searchResults.filter((r) => r.slug && positions.has(r.slug))
    if (hits.length < 2) return null

    const points: number[] = []
    for (let i = 0; i < hits.length - 1; i++) {
      for (let j = i + 1; j < Math.min(hits.length, maxConnections); j++) {
        const a = positions.get(hits[i].slug)!
        const b = positions.get(hits[j].slug)!
        points.push(a[0], a[1], a[2], b[0], b[1], b[2])
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geo
  }, [positions, searchResults, maxConnections])

  useFrame(() => {
    if (!lineRef.current) return
    const mat = lineRef.current.material as THREE.LineBasicMaterial
    mat.opacity = 0.15 + Math.sin(Date.now() * 0.002) * 0.1
  })

  if (!geometry) return null

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}
