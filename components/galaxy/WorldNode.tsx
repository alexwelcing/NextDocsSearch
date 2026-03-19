/**
 * WorldNode - Visual representation of a world in the galaxy
 * 
 * Renders as a glowing orb with:
 * - Different colors based on world type
 * - Size based on importance/type
 * - Hover effects
 * - Selection state
 * - Label that always faces camera
 */

import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { World, WorldType } from '@/lib/galaxy/world-registry';

interface WorldNodeProps {
  world: World;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick?: (world: World) => void;
  onHover?: (world: World | null) => void;
}

const TYPE_COLORS: Record<WorldType, string> = {
  immersive: '#00d4ff', // Cyan
  article: '#ffd700',   // Gold
  game: '#ff4757',      // Red
  memory: '#a55eea',    // Purple
};

const TYPE_SIZES: Record<WorldType, number> = {
  immersive: 1.5,
  article: 0.8,
  game: 2,
  memory: 1.2,
};

export function WorldNode({ world, isSelected, isHovered, onClick, onHover }: WorldNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [localHover, setLocalHover] = useState(false);
  
  const isActive = isSelected || isHovered || localHover;
  
  const color = TYPE_COLORS[world.type];
  const baseSize = TYPE_SIZES[world.type];
  
  // Pulse animation
  useFrame(({ clock }) => {
    if (!meshRef.current || !glowRef.current) return;
    
    const time = clock.getElapsedTime();
    const pulseSpeed = world.type === 'game' ? 3 : 1.5;
    const pulse = Math.sin(time * pulseSpeed) * 0.1 + 1;
    
    const scale = isActive ? 1.3 * pulse : 1;
    meshRef.current.scale.setScalar(scale);
    
    // Glow layer pulses more
    const glowScale = isActive ? 1.8 * pulse : 1.5;
    glowRef.current.scale.setScalar(glowScale);
    
    // Rotate slowly
    meshRef.current.rotation.y += 0.005;
    meshRef.current.rotation.x += 0.002;
  });

  const handlePointerEnter = () => {
    setLocalHover(true);
    onHover?.(world);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerLeave = () => {
    setLocalHover(false);
    onHover?.(null);
    document.body.style.cursor = 'default';
  };

  const handleClick = () => {
    onClick?.(world);
  };

  return (
    <group position={world.position}>
      {/* Main sphere */}
      <mesh
        ref={meshRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <sphereGeometry args={[baseSize, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.8 : 0.4}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Glow layer */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[baseSize * 1.5, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isActive ? 0.3 : 0.15}
          side={THREE.BackSide}
        />
      </mesh>
      
      {/* Outer glow for selected/hovered */}
      {isActive && (
        <mesh>
          <sphereGeometry args={[baseSize * 2.5, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.1}
            side={THREE.BackSide}
          />
        </mesh>
      )}
      
      {/* Label */}
      <Html
        distanceFactor={15}
        position={[0, baseSize * 2, 0]}
        style={{
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            background: isActive ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.7)',
            border: `1px solid ${isActive ? color : 'transparent'}`,
            padding: '8px 16px',
            borderRadius: 0,
            color: '#fff',
            fontSize: '14px',
            fontFamily: 'var(--font-mono, monospace)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
            transform: 'translateX(-50%)',
            transition: 'all 0.2s ease',
            boxShadow: isActive ? `0 0 20px ${color}40` : 'none',
          }}
        >
          <div style={{ fontWeight: 700 }}>{world.title}</div>
          {isActive && (
            <div style={{ 
              fontSize: '11px', 
              color: '#aaa', 
              marginTop: '4px',
              textTransform: 'none',
              letterSpacing: '0',
              maxWidth: '200px',
              whiteSpace: 'normal',
            }}>
              {world.description}
            </div>
          )}
        </div>
      </Html>
      
      {/* Connection indicator (small dot in center) */}
      {world.connections.length > 0 && (
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[baseSize * 0.2, 8, 8]} />
          <meshBasicMaterial color="#fff" />
        </mesh>
      )}
    </group>
  );
}

export default WorldNode;
