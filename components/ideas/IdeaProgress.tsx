/**
 * IdeaProgress - Constellation visualization for the idea journey
 *
 * Renders a persistent constellation of "explored" nodes in the background.
 * Each node represents a completed interaction (read article, passed quiz, etc.)
 */

import React, { useMemo } from 'react';
import { Line, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { ORB_COLORS } from './types';
import type { ConstellationNode, OrbContentType } from './types';

interface IdeaProgressProps {
  nodes: ConstellationNode[];
  position?: [number, number, number];
  opacity?: number;
}

export default function IdeaProgress({
  nodes,
  position = [0, 0, -10],
  opacity = 0.6,
}: IdeaProgressProps) {
  // Generate connections between nodes
  const connections = useMemo(() => {
    const lines: Array<[THREE.Vector3, THREE.Vector3, string]> = [];
    
    nodes.forEach((node) => {
      node.connectedTo.forEach((targetId) => {
        const target = nodes.find((n) => n.id === targetId);
        if (target) {
          lines.push([
            new THREE.Vector3(...node.position),
            new THREE.Vector3(...target.position),
            node.type
          ]);
        }
      });
    });
    
    return lines;
  }, [nodes]);

  if (nodes.length === 0) return null;

  return (
    <group position={position}>
      {/* Nodes */}
      {nodes.map((node) => (
        <ConstellationNodeItem key={node.id} node={node} opacity={opacity} />
      ))}

      {/* Connection Lines */}
      {connections.map(([start, end, type], i) => (
        <Line
          key={`line-${i}`}
          points={[start, end]}
          color={ORB_COLORS[type as OrbContentType] || '#ffffff'}
          lineWidth={0.5}
          transparent
          opacity={opacity * 0.3}
        />
      ))}

      {/* Background glow for the whole constellation */}
      <Sphere args={[15, 32, 32]}>
        <meshBasicMaterial
          color="#1a1a3a"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  );
}

function ConstellationNodeItem({
  node,
  opacity
}: {
  node: ConstellationNode;
  opacity: number;
}) {
  const color = ORB_COLORS[node.type] || ORB_COLORS.active;
  
  return (
    <group position={node.position}>
      <Sphere args={[0.15, 12, 12]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * node.brightness}
        />
      </Sphere>
      
      {/* Halo */}
      <Sphere args={[0.3, 12, 12]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * node.brightness * 0.2}
        />
      </Sphere>
      
      {/* Subtle light */}
      <pointLight
        color={color}
        intensity={node.brightness * 0.5}
        distance={2}
      />
    </group>
  );
}
