import React, { useRef, useMemo, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface GameOrbProps {
  position: [number, number, number];
  onHit: (points: number) => void;
  onMiss: () => void;
  isGolden?: boolean;
  lifetime?: number; // Seconds before auto-despawn
  clickRadiusMultiplier?: number; // Cosmic power bonus - enlarges hit area
  cosmicPowerActive?: boolean; // Visual indicator for cosmic power
}

const GameOrb: React.FC<GameOrbProps> = ({
  position,
  onHit,
  onMiss,
  isGolden = false,
  lifetime = 3, // Default 3 seconds lifetime
  clickRadiusMultiplier = 1, // Default normal click radius
  cosmicPowerActive = false, // Default no cosmic power visual effects
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const hitZoneRef = useRef<THREE.Mesh>(null);
  const cosmicRingRef = useRef<THREE.Mesh>(null);
  const timeAliveRef = useRef(0);
  const [isVisible, setIsVisible] = useState(true);

  // Randomize initial phase for pulsing animation
  const initialPhase = useMemo(() => Math.random() * Math.PI * 2, []);

  // Base radius and scaled hit radius
  const baseRadius = 0.5;
  const hitRadius = baseRadius * clickRadiusMultiplier;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!isVisible) return;

    const points = isGolden ? 30 : 10;
    onHit(points);
    setIsVisible(false);
  };

  useFrame((state, delta) => {
    if (!meshRef.current || !isVisible) return;

    // Track lifetime
    timeAliveRef.current += delta;

    // Despawn after lifetime expires
    if (timeAliveRef.current >= lifetime) {
      setIsVisible(false);
      onMiss();
      return;
    }

    // Pulsing scale animation - more intense with cosmic power
    const pulseSpeed = isGolden ? 3 : 2;
    const basePulseAmount = isGolden ? 0.2 : 0.15;
    const pulseAmount = cosmicPowerActive ? basePulseAmount * 1.5 : basePulseAmount;
    const scale = 1 + Math.sin(state.clock.elapsedTime * pulseSpeed + initialPhase) * pulseAmount;
    meshRef.current.scale.setScalar(scale);

    // Gentle rotation
    meshRef.current.rotation.y += delta * 0.5;
    meshRef.current.rotation.x += delta * 0.3;

    // Animate cosmic power ring
    if (cosmicRingRef.current && cosmicPowerActive) {
      cosmicRingRef.current.rotation.z += delta * 3;
      cosmicRingRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 2) * 0.3;
      // Pulsing opacity for the cosmic ring
      const ringMaterial = cosmicRingRef.current.material as THREE.MeshBasicMaterial;
      ringMaterial.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 4) * 0.15;
    }

    // Fade out in last 0.5 seconds
    if (timeAliveRef.current > lifetime - 0.5) {
      const fadeProgress = (lifetime - timeAliveRef.current) / 0.5;
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = fadeProgress;
    }
  });

  if (!isVisible) return null;

  // Colors with cosmic power enhancement
  const baseColor = isGolden ? '#FFD700' : '#00BFFF';
  const emissiveColor = isGolden ? '#FFA500' : '#0080FF';
  const emissiveIntensity = cosmicPowerActive
    ? (isGolden ? 1.2 : 0.9)
    : (isGolden ? 0.8 : 0.5);

  return (
    <group position={position} onClick={handleClick}>
      {/* Invisible enlarged hit zone when cosmic power is active */}
      {clickRadiusMultiplier > 1 && (
        <mesh ref={hitZoneRef}>
          <sphereGeometry args={[hitRadius, 8, 8]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Main orb */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[baseRadius, 12, 12]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={1}
        />
        {/* Outer glow effect */}
        <mesh scale={1.3}>
          <sphereGeometry args={[baseRadius, 8, 8]} />
          <meshBasicMaterial
            color={baseColor}
            transparent
            opacity={0.2}
            side={THREE.BackSide}
          />
        </mesh>
      </mesh>

      {/* Cosmic power visual effects */}
      {cosmicPowerActive && (
        <>
          {/* Rotating cosmic ring */}
          <mesh ref={cosmicRingRef}>
            <torusGeometry args={[hitRadius * 0.8, 0.03, 8, 32]} />
            <meshBasicMaterial
              color={isGolden ? '#ff00ff' : '#00ffff'}
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Hit zone indicator - subtle glow showing enlarged area */}
          <mesh scale={clickRadiusMultiplier}>
            <sphereGeometry args={[baseRadius, 16, 16]} />
            <meshBasicMaterial
              color={isGolden ? '#ffd700' : '#00ffff'}
              transparent
              opacity={0.08}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.BackSide}
            />
          </mesh>

          {/* Electric arc particles around the orb */}
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[hitRadius * 0.6, 0.02, 6, 24]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </group>
  );
};

export default GameOrb;
