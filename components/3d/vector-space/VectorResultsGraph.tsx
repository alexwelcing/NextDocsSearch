/**
 * VectorResultsGraph — Mini R3F scene for the terminal VECTORS tab
 *
 * Renders search results as glowing nodes in 3D space.
 * The query sits at center; results orbit by relevance score.
 * Click a node to navigate to its article.
 */

import React, { useMemo, useRef, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface SearchResult {
  slug: string
  score: number
  heading?: string | null
}

interface VectorResultsGraphProps {
  results: SearchResult[]
  query: string
  isSearching: boolean
  onSelectArticle?: (slug: string) => void
}

// ── Position computation ──────────────────────────────────────

function computeRadialPositions(
  results: SearchResult[]
): Map<string, [number, number, number]> {
  const map = new Map<string, [number, number, number]>()
  const maxScore = Math.max(...results.map((r) => r.score), 0.01)

  results.forEach((r, i) => {
    const normalized = r.score / maxScore
    // Higher score → closer to center; minimum distance 2, max ~8
    const distance = 2 + (1 - normalized) * 6
    // Golden-angle spread for even distribution
    const angle = i * 2.399963 // golden angle in radians
    // Slight vertical offset based on index for depth
    const y = (i % 3 - 1) * 1.5 + Math.sin(i * 0.7) * 0.8
    const x = Math.cos(angle) * distance
    const z = Math.sin(angle) * distance
    map.set(r.slug, [x, y, z])
  })

  return map
}

// ── Result Node ───────────────────────────────────────────────

function ResultNode({
  position,
  label,
  score,
  maxScore,
  onClick,
}: {
  position: [number, number, number]
  label: string
  score: number
  maxScore: number
  onClick: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = React.useState(false)

  const intensity = maxScore > 0 ? score / maxScore : 0.5
  const color = useMemo(() => {
    const c = new THREE.Color()
    // Cyan → gold gradient based on score
    c.lerpColors(new THREE.Color('#336688'), new THREE.Color('#00ffcc'), intensity)
    return c
  }, [intensity])

  const targetScale = hovered ? 1.4 : 0.5 + intensity * 0.7

  useFrame((_s, delta) => {
    if (!meshRef.current) return
    const t = 1 - Math.pow(0.001, delta)
    const s = meshRef.current.scale.x
    meshRef.current.scale.setScalar(s + (targetScale - s) * t)

    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const targetEmissive = hovered ? 2.0 : 0.4 + intensity * 1.5
    mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * t

    if (glowRef.current) {
      glowRef.current.scale.setScalar(meshRef.current.scale.x * 3)
      const gMat = glowRef.current.material as THREE.MeshBasicMaterial
      const targetOp = hovered ? 0.3 : 0.05 + intensity * 0.15
      gMat.opacity += (targetOp - gMat.opacity) * t
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.6}
          roughness={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.05}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Label — always visible for top results, hover for others */}
      {(hovered || intensity > 0.4) && (
        <Billboard position={[0, 1.2, 0]}>
          <Text
            fontSize={0.35}
            color={hovered ? '#ffffff' : '#cccccc'}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.02}
            outlineColor="#000000"
            maxWidth={6}
          >
            {label.length > 40 ? label.slice(0, 37) + '...' : label}
          </Text>
          <Text
            fontSize={0.2}
            color="#00ffcc"
            anchorX="center"
            anchorY="top"
            position={[0, -0.15, 0]}
          >
            {Math.round(intensity * 100)}%
          </Text>
        </Billboard>
      )}
    </group>
  )
}

// ── Query center node ─────────────────────────────────────────

function QueryNode({ query }: { query: string }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)

  useFrame((_s, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3
      meshRef.current.rotation.x += delta * 0.15
    }
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.5
      const mat = ringRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + Math.sin(Date.now() * 0.003) * 0.1
    }
  })

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial
          color="#ffd700"
          emissive="#ffd700"
          emissiveIntensity={1.5}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* Pulse ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.15, 32]} />
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <Billboard position={[0, 1.3, 0]}>
        <Text
          fontSize={0.28}
          color="#ffd700"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.02}
          outlineColor="#000000"
          maxWidth={6}
        >
          {query.length > 30 ? query.slice(0, 27) + '...' : query}
        </Text>
      </Billboard>
    </group>
  )
}

// ── Connection lines ──────────────────────────────────────────

function Connections({
  positions,
  results,
}: {
  positions: Map<string, [number, number, number]>
  results: SearchResult[]
}) {
  const lineRef = useRef<THREE.LineSegments>(null!)

  const geometry = useMemo(() => {
    const hits = results.filter((r) => positions.has(r.slug))
    if (hits.length === 0) return null

    const points: number[] = []
    // Connect each result to center
    for (const hit of hits) {
      const p = positions.get(hit.slug)!
      points.push(0, 0, 0, p[0], p[1], p[2])
    }
    // Connect top results to each other
    const top = hits.slice(0, 5)
    for (let i = 0; i < top.length - 1; i++) {
      const a = positions.get(top[i].slug)!
      const b = positions.get(top[i + 1].slug)!
      points.push(a[0], a[1], a[2], b[0], b[1], b[2])
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geo
  }, [positions, results])

  useFrame(() => {
    if (!lineRef.current) return
    const mat = lineRef.current.material as THREE.LineBasicMaterial
    mat.opacity = 0.08 + Math.sin(Date.now() * 0.002) * 0.04
  })

  if (!geometry) return null

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        color="#00ffcc"
        transparent
        opacity={0.1}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

// ── Scanning animation ────────────────────────────────────────

function ScanningIndicator() {
  const ringRef = useRef<THREE.Mesh>(null!)
  const scaleRef = useRef(0)

  useFrame((_s, delta) => {
    if (!ringRef.current) return
    scaleRef.current += delta * 8
    if (scaleRef.current > 15) scaleRef.current = 0
    ringRef.current.scale.setScalar(scaleRef.current)
    const mat = ringRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = Math.max(0, 0.25 - scaleRef.current / 60)
  })

  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.9, 1.0, 32]} />
      <meshBasicMaterial
        color="#00ffcc"
        transparent
        opacity={0.25}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// ── Auto-frame camera ─────────────────────────────────────────

function AutoCamera({ hasResults }: { hasResults: boolean }) {
  const { camera } = useThree()
  const initialized = useRef(false)

  useFrame(() => {
    if (!initialized.current) {
      camera.position.set(0, 4, 14)
      camera.lookAt(0, 0, 0)
      initialized.current = true
    }
    if (hasResults && !initialized.current) {
      const t = 0.02
      camera.position.lerp(new THREE.Vector3(0, 4, 14), t)
    }
  })

  return null
}

// ── Background particles ──────────────────────────────────────

function BackgroundDust({ count = 200 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null!)

  const geometry = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30
      arr[i * 3 + 1] = (Math.random() - 0.5) * 20
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
    return geo
  }, [count])

  useFrame((_s, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.01
    }
  })

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color="#334466"
        size={0.04}
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// ── Main scene content ────────────────────────────────────────

function GraphScene({
  results,
  query,
  isSearching,
  onSelectArticle,
}: {
  results: SearchResult[]
  query: string
  isSearching: boolean
  onSelectArticle: (slug: string) => void
}) {
  const positions = useMemo(() => computeRadialPositions(results), [results])
  const maxScore = useMemo(
    () => Math.max(...results.map((r) => r.score), 0.01),
    [results]
  )

  return (
    <>
      <ambientLight intensity={0.1} color="#334466" />
      <pointLight position={[10, 10, 10]} intensity={0.3} color="#88aaff" />
      <pointLight position={[-10, -5, -10]} intensity={0.15} color="#ff8866" />

      <BackgroundDust />

      {isSearching && <ScanningIndicator />}

      {results.length > 0 && (
        <>
          <QueryNode query={query} />
          <Connections positions={positions} results={results} />
          {results.slice(0, 15).map((result) => {
            const pos = positions.get(result.slug)
            if (!pos) return null
            return (
              <ResultNode
                key={result.slug}
                position={pos}
                label={result.heading || result.slug}
                score={result.score}
                maxScore={maxScore}
                onClick={() => onSelectArticle(result.slug)}
              />
            )
          })}
        </>
      )}

      <AutoCamera hasResults={results.length > 0} />
      <OrbitControls
        enableZoom
        enablePan={false}
        minDistance={5}
        maxDistance={25}
        autoRotate={results.length > 0}
        autoRotateSpeed={0.3}
      />
    </>
  )
}

// ── Exported Canvas wrapper ───────────────────────────────────

export default function VectorResultsGraph({
  results,
  query,
  isSearching,
  onSelectArticle,
}: VectorResultsGraphProps) {
  const handleSelect = useCallback(
    (slug: string) => {
      if (onSelectArticle) {
        onSelectArticle(slug)
      } else {
        window.location.href = `/articles/${slug}`
      }
    },
    [onSelectArticle]
  )

  return (
    <Canvas
      style={{ width: '100%', height: '100%', background: '#050510' }}
      camera={{ position: [0, 4, 14], fov: 50, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false }}
    >
      <GraphScene
        results={results}
        query={query}
        isSearching={isSearching}
        onSelectArticle={handleSelect}
      />
    </Canvas>
  )
}
