/**
 * VectorSpaceExplorer - 3D visualization of the article knowledge space
 *
 * Articles are positioned using semantic axes derived from metadata:
 *   X = polarity (catastrophic → positive outcomes)
 *   Y = horizon (near-term → far future, log-scaled)
 *   Z = topic cluster (derived from mechanics/category)
 *
 * When the user searches, matching articles glow brighter and the
 * camera animates to the centroid of the results. Connections between
 * related articles pulse based on similarity strength.
 */

import React, { useMemo, useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface VectorArticle {
  id: string
  title: string
  polarity?: number
  horizon?: string
  category?: string
  mechanics?: string[]
}

export interface SearchHit {
  slug: string
  score: number
  heading?: string | null
}

interface VectorSpaceExplorerProps {
  articles: VectorArticle[]
  searchResults?: SearchHit[]
  recommendations?: Record<string, { similar: { slug: string; score: number }[] }>
  onArticleSelect?: (article: VectorArticle) => void
  selectedArticleId?: string | null
  cameraTarget?: [number, number, number] | null
  isSearching?: boolean
}

// ═══════════════════════════════════════════════════════════════
// POSITIONING
// ═══════════════════════════════════════════════════════════════

const HORIZON_MAP: Record<string, number> = {
  NQ: 1,
  NY: 2,
  N5: 5,
  N20: 12,
  N50: 18,
  N100: 24,
}

const MECHANIC_ANGLES: Record<string, number> = {
  'labor-substitution': 0,
  'discovery-compression': 0.9,
  'governance-lag': 1.8,
  'epistemic-erosion': 2.7,
  'scarcity-inversion': 3.6,
  'competence-erosion': 4.5,
  'identity-dissolution': 5.4,
}

function articlePosition(article: VectorArticle): [number, number, number] {
  // X: polarity — -3 to +3 mapped to -15 to +15
  const x = (article.polarity ?? 0) * 5

  // Y: horizon — log-scaled height
  const h = article.horizon ? HORIZON_MAP[article.horizon] ?? 8 : 8
  const y = h - 12

  // Z: primary mechanic determines angular offset, spread by category hash
  const mechanic = article.mechanics?.[0]
  const angle = mechanic ? MECHANIC_ANGLES[mechanic] ?? 0 : 0
  const categoryHash = article.category
    ? (article.category.charCodeAt(0) * 7 + article.category.charCodeAt(1) * 13) % 100
    : 50
  const radial = 4 + (categoryHash / 100) * 10
  const z = radial * Math.sin(angle) + (Math.random() - 0.5) * 2

  return [x + (Math.random() - 0.5) * 1.5, y + (Math.random() - 0.5) * 1.5, z]
}

// ═══════════════════════════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════════════════════════

const POLARITY_COLORS: Record<number, string> = {
  [-3]: '#ff2244',
  [-2]: '#ff5566',
  [-1]: '#ff8899',
  0: '#888899',
  1: '#88cccc',
  2: '#44ddee',
  3: '#00ffcc',
}

function getNodeColor(polarity: number): THREE.Color {
  const color = POLARITY_COLORS[Math.round(polarity)] ?? '#888899'
  return new THREE.Color(color)
}

// ═══════════════════════════════════════════════════════════════
// ARTICLE NODE
// ═══════════════════════════════════════════════════════════════

const _tempColor = new THREE.Color()

function ArticleNode({
  article,
  position,
  hitScore,
  isSelected,
  onSelect,
}: {
  article: VectorArticle
  position: [number, number, number]
  hitScore: number
  isSelected: boolean
  onSelect: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHovered] = useState(false)
  const baseColor = useMemo(() => getNodeColor(article.polarity ?? 0), [article.polarity])

  const isHit = hitScore > 0
  const targetScale = isSelected ? 1.8 : isHit ? 1.0 + hitScore * 0.8 : hovered ? 0.7 : 0.4
  const targetEmissive = isSelected ? 2.0 : isHit ? 0.8 + hitScore * 1.2 : hovered ? 0.5 : 0.15

  useFrame((_state, delta) => {
    if (!meshRef.current) return
    const t = 1 - Math.pow(0.001, delta)

    // Smooth scale
    const s = meshRef.current.scale.x
    const ns = s + (targetScale - s) * t
    meshRef.current.scale.setScalar(ns)

    // Smooth emissive
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * t

    // Glow
    if (glowRef.current) {
      glowRef.current.scale.setScalar(ns * 2.5)
      const gMat = glowRef.current.material as THREE.MeshBasicMaterial
      gMat.opacity += ((isHit || isSelected ? 0.25 : 0.05) - gMat.opacity) * t
    }
  })

  return (
    <group position={position}>
      {/* Core orb */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onSelect()
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <icosahedronGeometry args={[0.5, 1]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={0.15}
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
          color={baseColor}
          transparent
          opacity={0.05}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Label */}
      {(hovered || isSelected || hitScore > 0.5) && (
        <Billboard position={[0, 1.2, 0]}>
          <Text
            fontSize={0.35}
            color={isSelected ? '#ffffff' : '#cccccc'}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.02}
            outlineColor="#000000"
            maxWidth={8}
          >
            {article.title}
          </Text>
          {hitScore > 0 && (
            <Text
              fontSize={0.2}
              color="#00ffcc"
              anchorX="center"
              anchorY="top"
              position={[0, -0.15, 0]}
            >
              {`relevance: ${Math.round(hitScore * 100)}%`}
            </Text>
          )}
        </Billboard>
      )}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════
// CONNECTION LINES
// ═══════════════════════════════════════════════════════════════

function SearchConnections({
  positions,
  searchResults,
}: {
  positions: Map<string, [number, number, number]>
  searchResults: SearchHit[]
}) {
  const lineRef = useRef<THREE.LineSegments>(null!)

  const geometry = useMemo(() => {
    const hits = searchResults.filter((r) => r.slug && positions.has(r.slug))
    if (hits.length < 2) return null

    const points: number[] = []
    for (let i = 0; i < hits.length - 1; i++) {
      for (let j = i + 1; j < Math.min(hits.length, 8); j++) {
        const a = positions.get(hits[i].slug)!
        const b = positions.get(hits[j].slug)!
        points.push(a[0], a[1], a[2], b[0], b[1], b[2])
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geo
  }, [positions, searchResults])

  useFrame((_state, _delta) => {
    if (!lineRef.current) return
    const mat = lineRef.current.material as THREE.LineBasicMaterial
    mat.opacity = 0.15 + Math.sin(Date.now() * 0.002) * 0.1
  })

  if (!geometry) return null

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial
        color="#00ffcc"
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}

// ═══════════════════════════════════════════════════════════════
// GRID + AXES
// ═══════════════════════════════════════════════════════════════

function SemanticAxes() {
  return (
    <group>
      {/* X axis: Polarity */}
      <group position={[0, -14, 0]}>
        <mesh>
          <boxGeometry args={[30, 0.02, 0.02]} />
          <meshBasicMaterial color="#ff4466" transparent opacity={0.15} />
        </mesh>
        <Billboard position={[-16, 0.5, 0]}>
          <Text fontSize={0.4} color="#ff4466" anchorX="right" outlineWidth={0.01} outlineColor="#000">
            CATASTROPHIC
          </Text>
        </Billboard>
        <Billboard position={[16, 0.5, 0]}>
          <Text fontSize={0.4} color="#00ffcc" anchorX="left" outlineWidth={0.01} outlineColor="#000">
            POSITIVE
          </Text>
        </Billboard>
      </group>

      {/* Y axis: Horizon */}
      <group position={[-16, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.02, 28, 0.02]} />
          <meshBasicMaterial color="#4488ff" transparent opacity={0.15} />
        </mesh>
        <Billboard position={[0, -14.5, 0]}>
          <Text fontSize={0.35} color="#4488ff" anchorX="center" outlineWidth={0.01} outlineColor="#000">
            NEAR-TERM
          </Text>
        </Billboard>
        <Billboard position={[0, 14.5, 0]}>
          <Text fontSize={0.35} color="#4488ff" anchorX="center" outlineWidth={0.01} outlineColor="#000">
            FAR FUTURE
          </Text>
        </Billboard>
      </group>

      {/* Faint grid floor */}
      <gridHelper args={[40, 20, '#222233', '#111122']} position={[0, -14, 0]} />
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════
// SEARCH PULSE — Visual feedback when a search fires
// ═══════════════════════════════════════════════════════════════

function SearchPulse({
  center,
  active,
}: {
  center: [number, number, number]
  active: boolean
}) {
  const ringRef = useRef<THREE.Mesh>(null!)
  const scaleRef = useRef(0)

  useFrame((_state, delta) => {
    if (!ringRef.current) return
    if (active && scaleRef.current < 30) {
      scaleRef.current += delta * 25
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
        color="#00ffcc"
        transparent
        opacity={0.3}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// ═══════════════════════════════════════════════════════════════
// CAMERA CONTROLLER
// ═══════════════════════════════════════════════════════════════

function CameraNavigator({
  target,
  isActive,
}: {
  target: [number, number, number] | null
  isActive: boolean
}) {
  const { camera } = useThree()
  const currentTarget = useRef(new THREE.Vector3(0, 0, 0))
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    if (target && isActive) {
      desiredTarget.current.set(target[0], target[1], target[2])
    }
  }, [target, isActive])

  useFrame((_state, delta) => {
    if (!isActive) return

    const t = 1 - Math.pow(0.005, delta)
    currentTarget.current.lerp(desiredTarget.current, t)

    // Move camera to look at target from an offset
    const offset = new THREE.Vector3(8, 5, 12)
    const desiredPos = currentTarget.current.clone().add(offset)
    camera.position.lerp(desiredPos, t * 0.5)
    camera.lookAt(currentTarget.current)
  })

  return null
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function VectorSpaceExplorer({
  articles,
  searchResults = [],
  onArticleSelect,
  selectedArticleId,
  cameraTarget,
  isSearching = false,
}: VectorSpaceExplorerProps) {
  // Pre-compute positions
  const positions = useMemo(() => {
    const map = new Map<string, [number, number, number]>()
    articles.forEach((a) => {
      map.set(a.id, articlePosition(a))
    })
    return map
  }, [articles])

  // Build score lookup from search results
  const hitScores = useMemo(() => {
    const map = new Map<string, number>()
    if (searchResults.length === 0) return map
    const maxScore = Math.max(...searchResults.map((r) => r.score))
    searchResults.forEach((r) => {
      if (r.slug) map.set(r.slug, maxScore > 0 ? r.score / maxScore : 0)
    })
    return map
  }, [searchResults])

  // Compute centroid of search results for camera target
  const searchCentroid = useMemo<[number, number, number] | null>(() => {
    const hits = searchResults.filter((r) => r.slug && positions.has(r.slug))
    if (hits.length === 0) return null

    let x = 0,
      y = 0,
      z = 0
    hits.forEach((h) => {
      const p = positions.get(h.slug)!
      x += p[0]
      y += p[1]
      z += p[2]
    })
    return [x / hits.length, y / hits.length, z / hits.length]
  }, [searchResults, positions])

  const effectiveTarget = cameraTarget ?? searchCentroid

  return (
    <group>
      {/* Semantic axis labels + grid */}
      <SemanticAxes />

      {/* Ambient scene lighting */}
      <ambientLight intensity={0.15} color="#334466" />
      <pointLight position={[20, 20, 20]} intensity={0.4} color="#88aaff" />
      <pointLight position={[-20, -10, -20]} intensity={0.2} color="#ff8866" />

      {/* Article nodes */}
      {articles.map((article) => {
        const pos = positions.get(article.id)
        if (!pos) return null
        return (
          <ArticleNode
            key={article.id}
            article={article}
            position={pos}
            hitScore={hitScores.get(article.id) ?? 0}
            isSelected={selectedArticleId === article.id}
            onSelect={() => onArticleSelect?.(article)}
          />
        )
      })}

      {/* Search result connections */}
      {searchResults.length > 1 && (
        <SearchConnections positions={positions} searchResults={searchResults} />
      )}

      {/* Search pulse animation */}
      {effectiveTarget && <SearchPulse center={effectiveTarget} active={isSearching} />}

      {/* Camera animation */}
      <CameraNavigator target={effectiveTarget} isActive={searchResults.length > 0} />
    </group>
  )
}
