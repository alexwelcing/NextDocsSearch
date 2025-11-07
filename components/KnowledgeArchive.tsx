/**
 * KNOWLEDGE ARCHIVE
 *
 * A 3D interactive portal to the R3F Knowledge Base
 * Styled as a futuristic data archive from 2045
 */

import React, { useRef, useState, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Text, RoundedBox, MeshDistortMaterial, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface KnowledgeArchiveProps {
  position?: [number, number, number];
  onClick?: () => void;
}

export default function KnowledgeArchive({
  position = [0, 0, -5],
  onClick
}: KnowledgeArchiveProps) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  // Animated rotation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002;
    }
    if (coreRef.current) {
      coreRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      coreRef.current.rotation.z = Math.cos(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setActive(!active);
    onClick?.();
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  // Glowing color based on state
  const glowColor = useMemo(() => {
    if (active) return '#00ffff'; // Cyan when active
    if (hovered) return '#00ff88'; // Green when hovered
    return '#0088ff'; // Blue default
  }, [hovered, active]);

  return (
    <group ref={groupRef} position={position}>
      {/* Floating animation */}
      <Float
        speed={1.5}
        rotationIntensity={0.2}
        floatIntensity={0.5}
      >
        {/* Outer rotating rings */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2, 0.05, 16, 100]} />
          <meshStandardMaterial
            color={glowColor}
            emissive={glowColor}
            emissiveIntensity={hovered ? 1.5 : 0.8}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        <mesh rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[2.2, 0.03, 16, 100]} />
          <meshStandardMaterial
            color={glowColor}
            emissive={glowColor}
            emissiveIntensity={hovered ? 1.2 : 0.6}
            metalness={0.8}
            roughness={0.2}
            opacity={0.7}
            transparent
          />
        </mesh>

        {/* Central crystal core */}
        <mesh
          ref={coreRef}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <octahedronGeometry args={[1, 0]} />
          <MeshDistortMaterial
            color={glowColor}
            emissive={glowColor}
            emissiveIntensity={hovered ? 2 : 1}
            metalness={0.9}
            roughness={0.1}
            distort={0.3}
            speed={2}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Inner glow sphere */}
        <mesh>
          <sphereGeometry args={[0.8, 32, 32]} />
          <meshBasicMaterial
            color={glowColor}
            transparent
            opacity={0.2}
          />
        </mesh>

        {/* Sparkles effect */}
        <Sparkles
          count={hovered ? 100 : 50}
          scale={3}
          size={hovered ? 3 : 2}
          speed={0.4}
          color={glowColor}
        />

        {/* Holographic data rings */}
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={[0, 0, 0]}
            rotation={[0, 0, (Math.PI / 4) * i]}
          >
            <ringGeometry args={[1.5, 1.6, 32]} />
            <meshBasicMaterial
              color={glowColor}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {/* Title text */}
        <Text
          position={[0, 2.5, 0]}
          fontSize={0.3}
          color={glowColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          R3F KNOWLEDGE ARCHIVE
        </Text>

        {/* Subtitle */}
        <Text
          position={[0, 2.1, 0]}
          fontSize={0.15}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.8}
        >
          Tales from the Future
        </Text>

        {/* Year marker */}
        <Text
          position={[0, -2.3, 0]}
          fontSize={0.2}
          color={glowColor}
          anchorX="center"
          anchorY="middle"
          font="/fonts/monospace.woff"
        >
          EST. 2045
        </Text>

        {/* Interaction hint */}
        {hovered && (
          <Text
            position={[0, -2.7, 0]}
            fontSize={0.15}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            fillOpacity={0.8}
          >
            ▶ CLICK TO ACCESS ◀
          </Text>
        )}

        {/* Data stream particles */}
        {active && (
          <>
            {Array.from({ length: 20 }).map((_, i) => (
              <DataParticle
                key={i}
                index={i}
                color={glowColor}
              />
            ))}
          </>
        )}
      </Float>

      {/* Point light for glow effect */}
      <pointLight
        position={[0, 0, 0]}
        intensity={hovered ? 2 : 1}
        distance={10}
        color={glowColor}
      />
    </group>
  );
}

/**
 * Data particle component for active state
 */
function DataParticle({ index, color }: { index: number; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime + index * 0.5;
      const radius = 2 + Math.sin(t) * 0.5;
      const angle = t * 0.5 + index * (Math.PI * 2) / 20;

      meshRef.current.position.x = Math.cos(angle) * radius;
      meshRef.current.position.y = Math.sin(t * 0.3) * 2;
      meshRef.current.position.z = Math.sin(angle) * radius;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

/**
 * Compact version for mobile or low-power mode
 */
export function KnowledgeArchiveSimple({
  position = [0, 0, -5],
  onClick
}: KnowledgeArchiveProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.();
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  return (
    <group position={position}>
      <Float speed={1} floatIntensity={0.3}>
        <RoundedBox
          args={[2, 2.5, 0.3]}
          radius={0.1}
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshStandardMaterial
            color={hovered ? '#00ff88' : '#0088ff'}
            emissive={hovered ? '#00ff88' : '#0088ff'}
            emissiveIntensity={hovered ? 0.8 : 0.4}
            metalness={0.8}
            roughness={0.2}
          />
        </RoundedBox>

        <Text
          position={[0, 0.3, 0.2]}
          fontSize={0.25}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          R3F Archive
        </Text>

        <Text
          position={[0, -0.1, 0.2]}
          fontSize={0.15}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.8}
        >
          Knowledge Base
        </Text>

        {hovered && (
          <Text
            position={[0, -0.6, 0.2]}
            fontSize={0.12}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            Click to explore
          </Text>
        )}
      </Float>

      <pointLight
        position={[0, 0, 0.5]}
        intensity={hovered ? 1 : 0.5}
        distance={5}
        color={hovered ? '#00ff88' : '#0088ff'}
      />
    </group>
  );
}
