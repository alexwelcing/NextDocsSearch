/**
 * TargetOrb - Clickable game target
 *
 * A clean, performant game orb with:
 * - Shader-based glow effect
 * - Smooth animations
 * - Hit detection with configurable radius
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface TargetOrbProps {
  position: [number, number, number];
  isGolden?: boolean;
  lifetime?: number;
  hitRadius?: number;
  onHit: (points: number) => void;
  onMiss: () => void;
}

const TargetOrb: React.FC<TargetOrbProps> = ({
  position,
  isGolden = false,
  lifetime = 3,
  hitRadius = 1,
  onHit,
  onMiss,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [visible, setVisible] = useState(true);
  const timeRef = useRef(0);
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  const baseColor = isGolden ? '#ffd700' : '#00d4ff';
  const glowColor = isGolden ? '#ffaa00' : '#0088ff';
  const points = isGolden ? 30 : 10;

  // Handle click
  const handleClick = useCallback(
    (e?: ThreeEvent<MouseEvent>) => {
      e?.stopPropagation();
      if (!visible) return;
      setVisible(false);
      onHit(points);
    },
    [visible, points, onHit]
  );

  // Animation loop
  useFrame((state, delta) => {
    if (!visible || !meshRef.current) return;

    timeRef.current += delta;

    // Check lifetime
    if (timeRef.current >= lifetime) {
      setVisible(false);
      onMiss();
      return;
    }

    const t = state.clock.elapsedTime + phaseRef.current;

    // Pulsing scale
    const pulse = 1 + Math.sin(t * 3) * 0.15;
    meshRef.current.scale.setScalar(pulse);

    // Rotation
    meshRef.current.rotation.y += delta * 0.5;
    meshRef.current.rotation.x += delta * 0.3;

    // Glow pulse
    if (glowRef.current?.material) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.2 + Math.sin(t * 4) * 0.1;
    }

    // Fade out in last 0.5s
    if (timeRef.current > lifetime - 0.5 && meshRef.current.material) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = (lifetime - timeRef.current) / 0.5;
    }
  });

  if (!visible) return null;

  return (
    <group position={position}>
      {/* Hit zone (invisible, larger) */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[hitRadius, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Visible orb */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={0.5}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={1}
        />
      </mesh>

      {/* Glow effect */}
      <mesh ref={glowRef} scale={1.5}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
};

export default TargetOrb;
