import React, { useRef, useMemo, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface GameOrbProps {
  position: [number, number, number];
  onHit: (points: number) => void;
  onMiss: () => void;
  isGolden?: boolean;
  lifetime?: number; // Seconds before auto-despawn
}

const GameOrb: React.FC<GameOrbProps> = ({
  position,
  onHit,
  onMiss,
  isGolden = false,
  lifetime = 3, // Default 3 seconds lifetime
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeAliveRef = useRef(0);
  const [isVisible, setIsVisible] = useState(true);

  // Randomize initial phase for pulsing animation
  const initialPhase = useMemo(() => Math.random() * Math.PI * 2, []);

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

    // Pulsing scale animation
    const pulseSpeed = isGolden ? 3 : 2;
    const pulseAmount = isGolden ? 0.2 : 0.15;
    const scale = 1 + Math.sin(state.clock.elapsedTime * pulseSpeed + initialPhase) * pulseAmount;
    meshRef.current.scale.setScalar(scale);

    // Gentle rotation
    meshRef.current.rotation.y += delta * 0.5;
    meshRef.current.rotation.x += delta * 0.3;

    // Fade out in last 0.5 seconds
    if (timeAliveRef.current > lifetime - 0.5) {
      const fadeProgress = (lifetime - timeAliveRef.current) / 0.5;
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = fadeProgress;
    }
  });

  if (!isVisible) return null;

  return (
    <mesh ref={meshRef} position={position} onClick={handleClick}>
      <sphereGeometry args={[0.5, 12, 12]} />
      <meshStandardMaterial
        color={isGolden ? '#FFD700' : '#00BFFF'}
        emissive={isGolden ? '#FFA500' : '#0080FF'}
        emissiveIntensity={isGolden ? 0.8 : 0.5}
        metalness={0.7}
        roughness={0.3}
        transparent
        opacity={1}
      />
      {/* Outer glow effect */}
      <mesh scale={1.3}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshBasicMaterial
          color={isGolden ? '#FFD700' : '#00BFFF'}
          transparent
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>
    </mesh>
  );
};

export default GameOrb;
