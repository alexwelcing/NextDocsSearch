import React, { useState, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
import TerminalInterface from './TerminalInterface';

interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
}

interface SceneryOption {
  id: string;
  name: string;
  type: 'image' | 'splat';
  path: string;
  thumbnail?: string;
}

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  articles?: ArticleData[];
  onStartGame?: () => void;
  cinematicRevealProgress?: number;
  // Scenery props
  onChangeScenery?: (scenery: SceneryOption) => void;
  availableScenery?: SceneryOption[];
  currentScenery?: string;
}

export default function InteractiveTablet({
  initialPosition = [0, 2.5, 4],
  isGamePlaying = false,
  articles = [],
  onStartGame,
  cinematicRevealProgress = 1,
  onChangeScenery,
  availableScenery = [],
  currentScenery,
}: InteractiveTabletProps) {
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);

  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Tablet dimensions
  const tabletWidth = 4;
  const tabletHeight = 3;
  const tabletDepth = 0.15;

  // Physics body
  const [ref, api] = useBox(() => ({
    mass: 0,
    position: initialPosition,
    args: [tabletWidth, tabletHeight, tabletDepth],
  }));

  const handleTabletClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPoweredOn) {
      setTerminalOpen(true);
    }
  }, [isPoweredOn]);

  useFrame((state) => {
    if (groupRef.current && ref.current) {
      const time = state.clock.elapsedTime;

      // Billboard - face camera
      const cameraPos = new THREE.Vector3();
      camera.getWorldPosition(cameraPos);
      groupRef.current.lookAt(cameraPos);
      ref.current.rotation.copy(groupRef.current.rotation);

      // Subtle float
      const floatY = Math.sin(time * 0.4) * 0.1;
      api.position.set(initialPosition[0], initialPosition[1] + floatY, initialPosition[2]);
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);

      // Pulse for hint
      setPulsePhase(Math.sin(time * 1.5) * 0.5 + 0.5);

      // Reveal animation
      const scale = easeOutCubic(Math.min(cinematicRevealProgress, 1));
      groupRef.current.scale.setScalar(scale);
    }
  });

  const togglePower = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPoweredOn((prev) => {
      if (prev && terminalOpen) setTerminalOpen(false);
      return !prev;
    });
  }, [terminalOpen]);

  // Hide during gameplay
  if (isGamePlaying) return null;

  const screenOn = isPoweredOn;
  const glowIntensity = hovered ? 0.8 : 0.5;

  return (
    <>
      <group ref={groupRef}>
        {/* Tablet Body */}
        <RoundedBox
          ref={ref as unknown as React.RefObject<THREE.Mesh>}
          args={[tabletWidth, tabletHeight, tabletDepth]}
          radius={0.1}
          smoothness={4}
          onClick={handleTabletClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <meshStandardMaterial
            color="#111"
            metalness={0.8}
            roughness={0.2}
          />
        </RoundedBox>

        {/* Screen */}
        <mesh position={[0, 0, tabletDepth / 2 + 0.005]}>
          <planeGeometry args={[tabletWidth - 0.3, tabletHeight - 0.3]} />
          <meshStandardMaterial
            color={screenOn ? '#1a1a1a' : '#0a0a0a'}
            emissive={screenOn ? '#0f0' : '#000'}
            emissiveIntensity={screenOn ? glowIntensity * 0.15 : 0}
          />
        </mesh>

        {/* Screen glow effect */}
        {screenOn && (
          <pointLight
            position={[0, 0, 1]}
            color="#0f0"
            intensity={glowIntensity * 1.5}
            distance={6}
            decay={2}
          />
        )}

        {/* Power indicator */}
        <mesh
          position={[-tabletWidth / 2 + 0.2, -tabletHeight / 2 + 0.15, tabletDepth / 2 + 0.01]}
          onClick={togglePower}
        >
          <circleGeometry args={[0.06, 12]} />
          <meshBasicMaterial color={isPoweredOn ? '#0f0' : '#600'} />
        </mesh>

        {/* Screen content */}
        {screenOn && (
          <>
            {/* Terminal prompt icon */}
            <Text
              position={[0, 0.3, tabletDepth / 2 + 0.02]}
              fontSize={0.35}
              color="#0f0"
              anchorX="center"
              anchorY="middle"
            >
              {'>_'}
            </Text>

            {/* Title */}
            <Text
              position={[0, -0.2, tabletDepth / 2 + 0.02]}
              fontSize={0.14}
              color="#0f0"
              anchorX="center"
              anchorY="middle"
            >
              TERMINAL
            </Text>

            {/* Hint - pulsing */}
            <Text
              position={[0, -0.6, tabletDepth / 2 + 0.02]}
              fontSize={0.09}
              color={new THREE.Color(0x00ff00).multiplyScalar(0.4 + pulsePhase * 0.4)}
              anchorX="center"
              anchorY="middle"
            >
              {hovered ? '[ CLICK TO OPEN ]' : 'click to open'}
            </Text>

            {/* Menu items preview */}
            <Text
              position={[-0.8, 0.8, tabletDepth / 2 + 0.02]}
              fontSize={0.06}
              color="#666"
              anchorX="center"
              anchorY="middle"
            >
              chat
            </Text>
            <Text
              position={[0, 0.8, tabletDepth / 2 + 0.02]}
              fontSize={0.06}
              color="#666"
              anchorX="center"
              anchorY="middle"
            >
              game
            </Text>
            <Text
              position={[0.8, 0.8, tabletDepth / 2 + 0.02]}
              fontSize={0.06}
              color="#666"
              anchorX="center"
              anchorY="middle"
            >
              scene
            </Text>
          </>
        )}
      </group>

      {/* Terminal Interface Overlay */}
      <TerminalInterface
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        articles={articles}
        onStartGame={onStartGame}
        onChangeScenery={onChangeScenery}
        availableScenery={availableScenery}
        currentScenery={currentScenery}
      />
    </>
  );
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
