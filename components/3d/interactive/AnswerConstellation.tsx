import React, { useMemo, useRef, useState } from 'react'
import { Billboard, Line, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { InstantAnswerItem, ShipStructuredAnswer } from '@/lib/chat/shipAnswer'

interface AnswerConstellationProps {
  structuredAnswer: ShipStructuredAnswer | null
  instantResults: InstantAnswerItem[]
  visible: boolean
  onOpenArticle?: (slug: string) => void
}

interface SatelliteNode {
  id: string
  label: string
  detail: string
  position: [number, number, number]
  color: string
  sourceSlug?: string
}

function createStoryPosition(index: number, total: number): [number, number, number] {
  const spread = Math.max(total - 1, 1)
  const normalized = spread === 0 ? 0 : index / spread
  const x = -4.8 + normalized * 9.6
  const arch = Math.sin(normalized * Math.PI) * 2.2
  const z = -11.6 + Math.cos(normalized * Math.PI) * 0.9
  return [x, 1.2 + arch, z]
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

export default function AnswerConstellation({
  structuredAnswer,
  instantResults,
  visible,
  onOpenArticle,
}: AnswerConstellationProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const nodes = useMemo<SatelliteNode[]>(() => {
    const diagramNodes = structuredAnswer?.diagram.nodes.slice(1, 6) ?? []
    const isStory = structuredAnswer?.mode === 'story'

    return diagramNodes.map((node, index) => {
      const angle = (index / Math.max(diagramNodes.length, 1)) * Math.PI * 2
      const radius = 5 + index * 0.45
      const position = isStory
        ? createStoryPosition(index, diagramNodes.length)
        : [Math.cos(angle) * radius, 1.6 + (index % 2) * 1.35, -11 + Math.sin(angle) * 1.8] as [number, number, number]
      return {
        id: node.id,
        label: truncate(node.label, 26),
        detail: truncate(node.detail, 84),
        position,
        color: isStory
          ? node.tone === 'supporting'
            ? '#ffb266'
            : '#ff7b72'
          : node.tone === 'supporting'
            ? '#ffd37a'
            : '#78e8ff',
        sourceSlug: node.sourceSlug,
      }
    })
  }, [structuredAnswer])

  const instantLabels = useMemo(() => instantResults.slice(0, 4), [instantResults])
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null

  useFrame((_, delta) => {
    if (!groupRef.current || !visible) return
    groupRef.current.rotation.y += delta * 0.05
    groupRef.current.position.y = 8 + Math.sin(Date.now() * 0.0005) * 0.2
  })

  if (!visible || (!structuredAnswer && instantLabels.length === 0)) {
    return null
  }

  const summary = structuredAnswer?.summary || 'Scanning the archive for the right answer.'
  const isStory = structuredAnswer?.mode === 'story'
  const coreColor = isStory ? '#ff9955' : '#60dfff'
  const coreEmissive = isStory ? '#ff6a3d' : '#1ec8ff'
  const auraColor = isStory ? '#ff8c4d' : '#4ed8ff'

  return (
    <group ref={groupRef} position={[0, 8, 0]}>
      <mesh position={[0, 0, -12]}>
        <sphereGeometry args={[0.95, 28, 28]} />
        <meshStandardMaterial color={coreColor} emissive={coreEmissive} emissiveIntensity={1.4} metalness={0.25} roughness={0.25} />
      </mesh>

      <mesh position={[0, 0, -12]} scale={1.8}>
        <sphereGeometry args={[1, 18, 18]} />
        <meshBasicMaterial color={auraColor} transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {isStory && nodes.length > 1 && (
        <Line
          points={nodes.map((node) => node.position)}
          color="#ffb266"
          lineWidth={1.2}
          transparent
          opacity={0.45}
        />
      )}

      <Billboard position={[0, 1.9, -12]}>
        <Text maxWidth={5.4} fontSize={0.34} lineHeight={1.35} color="#dff9ff" anchorX="center" textAlign="center" outlineColor="#06131b" outlineWidth={0.015}>
          {truncate(summary, 124)}
        </Text>
      </Billboard>

      {nodes.map((node) => (
        <group key={node.id} position={node.position}>
          <Line
            points={[[0, 0, 0], [-node.position[0], -node.position[1], -node.position[2] - 12]]}
            color={selectedNodeId === node.id || hoveredNodeId === node.id ? '#dff9ff' : 'rgba(120,232,255,0.45)'}
            lineWidth={1}
            transparent
            opacity={selectedNodeId === node.id || hoveredNodeId === node.id ? 0.9 : 0.45}
          />
          <mesh
            scale={selectedNodeId === node.id ? 1.35 : hoveredNodeId === node.id ? 1.18 : 1}
            onPointerOver={() => {
              setHoveredNodeId(node.id)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              setHoveredNodeId((current) => (current === node.id ? null : current))
              document.body.style.cursor = 'auto'
            }}
            onClick={() => {
              if (selectedNodeId === node.id && node.sourceSlug) {
                onOpenArticle?.(node.sourceSlug)
                return
              }
              setSelectedNodeId((current) => (current === node.id ? null : node.id))
            }}
          >
            <sphereGeometry args={[0.28, 18, 18]} />
            <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={1.1} roughness={0.35} />
          </mesh>
          <Billboard position={[0, 0.55, 0]}>
            <Text maxWidth={2.5} fontSize={0.18} color="#f6fbff" anchorX="center" textAlign="center" outlineColor="#031017" outlineWidth={0.012}>
              {node.label}
            </Text>
          </Billboard>
        </group>
      ))}

      {selectedNode && (
        <Billboard position={[0, -1.35, -10.4]}>
          <group>
            <mesh position={[0, 0, -0.02]}>
              <planeGeometry args={[4.8, 1.8]} />
              <meshBasicMaterial color="#05131c" transparent opacity={0.84} />
            </mesh>
            <Text maxWidth={4.1} fontSize={0.16} color="#effcff" anchorX="center" textAlign="center" outlineColor="#031017" outlineWidth={0.01}>
              {selectedNode.detail}
            </Text>
            {selectedNode.sourceSlug && (
              <Text position={[0, -0.66, 0.02]} maxWidth={4.2} fontSize={0.12} color="#97ffd5" anchorX="center" textAlign="center" outlineColor="#031017" outlineWidth={0.008}>
                {`Click again to open ${selectedNode.sourceSlug}`}
              </Text>
            )}
          </group>
        </Billboard>
      )}

      {instantLabels.map((item, index) => (
        <group
          key={item.slug}
          position={[-4.2 + index * 2.8, -2.4, -10.5]}
          onPointerOver={() => {
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto'
          }}
          onClick={() => onOpenArticle?.(item.slug)}
        >
          <Billboard>
            <Text maxWidth={1.8} fontSize={0.15} color="#97ffd5" anchorX="center" textAlign="center" outlineColor="#04110d" outlineWidth={0.01}>
              {truncate(item.title, 28)}
            </Text>
          </Billboard>
        </group>
      ))}
    </group>
  )
}