/**
 * IdeaOrb - Unified orb component for the idea experience
 *
 * A single orb that can be:
 * - Dormant (waiting to awaken)
 * - A game target (during awakening game)
 * - Interactive content (article, quiz, etc.)
 * - Part of the constellation (completed)
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbState, OrbContent, IdeaOrbData, OrbContentType } from './types';
import { ORB_COLORS, EASINGS } from './types';

interface IdeaOrbProps {
  data: IdeaOrbData;
  /** Called when orb is clicked in game mode */
  onAwaken?: (id: string, points: number) => void;
  /** Called when orb is clicked for content */
  onEngage?: (id: string, content: OrbContent) => void;
  /** Called when orb lifetime expires in game */
  onExpire?: (id: string) => void;
  /** Whether the orb should be clickable */
  interactive?: boolean;
  /** Game mode - affects visual behavior */
  gameActive?: boolean;
  /** Lifetime in seconds for game orbs */
  lifetime?: number;
}

/**
 * Get color based on orb state and content type
 */
function getOrbColor(state: OrbState, contentType: OrbContentType, isRare: boolean): string {
  if (isRare) return ORB_COLORS.rare;
  if (state === 'dormant') return ORB_COLORS.dormant;
  if (state === 'awakening') return ORB_COLORS.awakening;
  if (state === 'explored') return ORB_COLORS.explored;
  return ORB_COLORS[contentType] || ORB_COLORS.active;
}

/**
 * Get emissive intensity based on state
 */
function getEmissiveIntensity(state: OrbState, isRare: boolean): number {
  if (isRare) return 1.2;
  switch (state) {
    case 'dormant': return 0.1;
    case 'awakening': return 0.8;
    case 'active': return 0.5;
    case 'engaged': return 1.0;
    case 'explored': return 0.3;
    default: return 0.3;
  }
}

export default function IdeaOrb({
  data,
  onAwaken,
  onEngage,
  onExpire,
  interactive = true,
  gameActive = false,
  lifetime = 3,
}: IdeaOrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const spawnTime = useRef(Date.now());
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  const { id, state, content, position, size = 0.5 } = data;
  const isRare = content.isRare ?? false;

  // Colors
  const color = useMemo(
    () => getOrbColor(state, content.type, isRare),
    [state, content.type, isRare]
  );
  const emissiveIntensity = useMemo(
    () => getEmissiveIntensity(state, isRare),
    [state, isRare]
  );

  // Animation state refs
  const scaleRef = useRef(1);
  const rotationRef = useRef(0);
  const pulseRef = useRef(0);

  // Handle click
  const handleClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      if (!interactive || clicked) return;

      setClicked(true);

      if (gameActive && state === 'awakening' && onAwaken) {
        const points = isRare ? 30 : 10;
        onAwaken(id, points);
      } else if (state === 'active' && onEngage) {
        onEngage(id, content);
      }
    },
    [interactive, clicked, gameActive, state, onAwaken, onEngage, id, isRare, content]
  );

  // Animation frame
  useFrame((frameState, delta) => {
    if (!meshRef.current) return;

    const elapsed = (Date.now() - spawnTime.current) / 1000;

    // Check lifetime expiry for game orbs
    if (gameActive && state === 'awakening' && !clicked) {
      if (elapsed >= lifetime && onExpire) {
        onExpire(id);
        return;
      }
    }

    // Pulse animation
    pulseRef.current += delta * (isRare ? 4 : 2);
    const pulse = Math.sin(pulseRef.current) * (isRare ? 0.15 : 0.1);

    // Rotation
    rotationRef.current += delta * (state === 'awakening' ? 2 : 0.5);
    meshRef.current.rotation.y = rotationRef.current;

    // Scale based on state
    let targetScale = 1;
    if (state === 'dormant') targetScale = 0.7;
    if (state === 'awakening') targetScale = 1 + pulse;
    if (state === 'active') targetScale = 1 + pulse * 0.5;
    if (state === 'engaged') targetScale = 1.2;
    if (hovered) targetScale *= 1.1;

    // Smooth scale transition
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, targetScale, 0.1);
    meshRef.current.scale.setScalar(scaleRef.current * size);

    // Glow sphere animation
    if (glowRef.current) {
      glowRef.current.scale.setScalar(scaleRef.current * size * 1.4);
      const glowMaterial = glowRef.current.material as THREE.MeshBasicMaterial;
      glowMaterial.opacity = 0.15 + Math.sin(pulseRef.current * 1.5) * 0.1;
    }

    // Fade out near end of lifetime (game mode)
    if (gameActive && state === 'awakening' && !clicked) {
      const remaining = lifetime - elapsed;
      if (remaining < 0.5) {
        const fadeOpacity = remaining / 0.5;
        const material = meshRef.current.material as THREE.MeshStandardMaterial;
        material.opacity = fadeOpacity;
      }
    }
  });

  // Don't render if clicked in game mode
  if (clicked && gameActive) return null;

  return (
    <group position={position}>
      {/* Main orb */}
      <Sphere
        ref={meshRef}
        args={[1, 24, 24]}
        onClick={handleClick}
        onPointerOver={() => interactive && setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.3}
          roughness={0.4}
          transparent
          opacity={state === 'dormant' ? 0.6 : 1}
        />
      </Sphere>

      {/* Glow sphere */}
      <Sphere ref={glowRef} args={[1, 16, 16]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Content type indicator (when active) */}
      {state === 'active' && content.title && (
        <Html
          center
          distanceFactor={8}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.8)',
              color: color,
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              border: `1px solid ${color}`,
            }}
          >
            {content.title}
          </div>
        </Html>
      )}

      {/* Rare indicator */}
      {isRare && state === 'awakening' && (
        <pointLight
          color={ORB_COLORS.rare}
          intensity={2}
          distance={3}
        />
      )}
    </group>
  );
}

/**
 * Mini orb for constellation/progress display
 */
export function ConstellationOrb({
  position,
  type,
  brightness = 0.5,
  size = 0.1,
}: {
  position: THREE.Vector3Tuple;
  type: OrbContentType;
  brightness?: number;
  size?: number;
}) {
  const color = ORB_COLORS[type] || ORB_COLORS.active;

  return (
    <Sphere args={[size, 8, 8]} position={position}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={brightness}
      />
    </Sphere>
  );
}
