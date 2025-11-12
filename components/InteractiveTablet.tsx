import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox, Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useSupabaseData } from './SupabaseDataContext';

interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
}

export type TabletMode = 'ask' | 'browse' | 'play' | 'quiet' | null;

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  articles?: ArticleData[];
  onModeChange?: (mode: TabletMode) => void;
  cinematicRevealProgress?: number;
  quietMode?: boolean;
}

export default function InteractiveTablet({
  initialPosition = [0, 2, 5],
  isGamePlaying = false,
  articles = [],
  onModeChange,
  cinematicRevealProgress = 1,
  quietMode = false,
}: InteractiveTabletProps) {
  const [currentMode, setCurrentMode] = useState<TabletMode>(null);
  const [pulseAnimation, setPulseAnimation] = useState(0);
  const [revealScale, setRevealScale] = useState(cinematicRevealProgress);

  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Tablet dimensions - more industrial, rectangular
  const tabletWidth = 3;
  const tabletHeight = 4;
  const tabletDepth = 0.3;

  // Physics body
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    mass: 0,
    position: initialPosition,
    args: [tabletWidth, tabletHeight, tabletDepth],
    material: {
      friction: 0.8,
      restitution: 0.1
    }
  }));

  const handleModeClick = useCallback((mode: TabletMode) => (e: any) => {
    e.stopPropagation();
    const newMode = currentMode === mode ? null : mode;
    setCurrentMode(newMode);
    onModeChange?.(newMode);
  }, [currentMode, onModeChange]);

  // Billboard effect and animations
  useFrame((state) => {
    if (groupRef.current && ref.current) {
      const cameraWorldPos = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPos);
      groupRef.current.lookAt(cameraWorldPos);
      ref.current.rotation.copy(groupRef.current.rotation);

      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);

      setPulseAnimation(Math.sin(state.clock.elapsedTime * 2) * 0.5 + 0.5);

      // Handle quiet mode - tablet moves down out of view
      if (quietMode) {
        const currentPos = groupRef.current.position;
        const targetY = -5; // Move down below view
        groupRef.current.position.y = THREE.MathUtils.lerp(currentPos.y, targetY, 0.05);
      } else {
        const currentPos = groupRef.current.position;
        const targetY = initialPosition[1];
        groupRef.current.position.y = THREE.MathUtils.lerp(currentPos.y, targetY, 0.05);
      }

      // Cinematic reveal
      const targetScale = cinematicRevealProgress;
      setRevealScale(prev => THREE.MathUtils.lerp(prev, targetScale, 0.1));
      const easeScale = easeOutElastic(revealScale);
      groupRef.current.scale.set(easeScale, easeScale, easeScale);
    }
  });

  // Hide during gameplay (except in quiet mode where tablet is just lowered)
  if (isGamePlaying && !quietMode) {
    return null;
  }

  // Mode button configuration
  const modes = [
    {
      name: 'ask' as TabletMode,
      label: 'ASK',
      color: '#00ff88',
      position: [0, 1.2, 0] as [number, number, number],
      description: 'NAVAL INTERFACE'
    },
    {
      name: 'browse' as TabletMode,
      label: 'BROWSE',
      color: '#4488ff',
      position: [0, 0.4, 0] as [number, number, number],
      description: 'ARTICLE DATABASE'
    },
    {
      name: 'play' as TabletMode,
      label: 'PLAY',
      color: '#ffaa00',
      position: [0, -0.4, 0] as [number, number, number],
      description: 'SPHERE HUNTER'
    },
    {
      name: 'quiet' as TabletMode,
      label: 'QUIET',
      color: '#ff4444',
      position: [0, -1.2, 0] as [number, number, number],
      description: 'OBSERVATION MODE'
    },
  ];

  return (
    <group ref={groupRef}>
      {/* Main metal body - industrial dark steel */}
      <RoundedBox
        ref={ref}
        args={[tabletWidth, tabletHeight, tabletDepth]}
        radius={0.05}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#1a1a1a"
          metalness={0.9}
          roughness={0.4}
          envMapIntensity={1.5}
        />
      </RoundedBox>

      {/* Brushed metal panel on front */}
      <mesh position={[0, 0, tabletDepth / 2 + 0.01]}>
        <planeGeometry args={[tabletWidth - 0.3, tabletHeight - 0.3]} />
        <meshStandardMaterial
          color="#2a2a2a"
          metalness={0.8}
          roughness={0.6}
        />
      </mesh>

      {/* Mode buttons and indicators */}
      {modes.map((mode) => {
        const isActive = currentMode === mode.name;

        return (
          <group key={mode.label} position={mode.position}>
            {/* Glass indicator light - cylinder */}
            <mesh position={[-0.8, 0, tabletDepth / 2 + 0.03]}>
              <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
              <meshStandardMaterial
                color={isActive ? mode.color : '#222222'}
                emissive={isActive ? mode.color : '#000000'}
                emissiveIntensity={isActive ? 0.8 : 0}
                metalness={0.1}
                roughness={0.1}
                transparent={true}
                opacity={0.9}
              />
            </mesh>

            {/* Glass cover rim - darker metal */}
            <mesh position={[-0.8, 0, tabletDepth / 2 + 0.05]}>
              <torusGeometry args={[0.09, 0.015, 8, 24]} />
              <meshStandardMaterial
                color="#0a0a0a"
                metalness={0.95}
                roughness={0.3}
              />
            </mesh>

            {/* Point light when active */}
            {isActive && (
              <pointLight
                position={[-0.8, 0, 0.5]}
                color={mode.color}
                intensity={1.5}
                distance={3}
              />
            )}

            {/* Engraved label text */}
            <Text
              position={[0.2, 0.08, tabletDepth / 2 + 0.02]}
              fontSize={0.18}
              color="#888888"
              anchorX="left"
              anchorY="middle"
              font="/fonts/RobotoMono-Bold.ttf"
              letterSpacing={0.1}
            >
              {mode.label}
            </Text>

            {/* Smaller description text */}
            <Text
              position={[0.2, -0.08, tabletDepth / 2 + 0.02]}
              fontSize={0.08}
              color="#555555"
              anchorX="left"
              anchorY="middle"
              font="/fonts/RobotoMono-Regular.ttf"
            >
              {mode.description}
            </Text>

            {/* Invisible clickable area */}
            <mesh
              position={[0, 0, tabletDepth / 2 + 0.02]}
              onClick={handleModeClick(mode.name)}
            >
              <planeGeometry args={[2.2, 0.5]} />
              <meshBasicMaterial
                transparent={true}
                opacity={0}
              />
            </mesh>
          </group>
        );
      })}

      {/* Decorative screws in corners */}
      {[
        [-1.2, 1.7],
        [1.2, 1.7],
        [-1.2, -1.7],
        [1.2, -1.7],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, y, tabletDepth / 2 + 0.01]}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 6]} />
          <meshStandardMaterial
            color="#1a1a1a"
            metalness={0.9}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* Serial number engraving - bottom */}
      <Text
        position={[0, -1.7, tabletDepth / 2 + 0.02]}
        fontSize={0.06}
        color="#333333"
        anchorX="center"
        anchorY="middle"
        font="/fonts/RobotoMono-Regular.ttf"
      >
        MK-IV CONTROL PANEL • SN: 2024-NDX-001
      </Text>
    </group>
  );
}

function easeOutElastic(x: number): number {
  const c4 = (2 * Math.PI) / 3;
  return x === 0
    ? 0
    : x === 1
    ? 1
    : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}
