import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox, Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
import { useSupabaseData } from './SupabaseDataContext';
import QuizSystem from './QuizSystem';
import TerminalInterface from './TerminalInterface';

interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
}

interface LeaderboardEntry {
  id: number;
  player_name: string;
  score: number;
  combo_max: number;
  accuracy: number;
  created_at: string;
}

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  articles?: ArticleData[];
  onStartGame?: () => void;
}

export default function InteractiveTablet({
  initialPosition = [0, 2, 5],
  isGamePlaying = false,
  articles = [],
  onStartGame
}: InteractiveTabletProps) {
  // State management
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [pulseAnimation, setPulseAnimation] = useState(0);

  // Data from context (for preview display)
  const { chatData } = useSupabaseData();

  // Use provided articles or fallback to default
  const displayArticles = articles.length > 0 ? articles : [
    { title: "Getting Started", date: "2024-10-01", author: ["Team"] },
    { title: "Advanced Features", date: "2024-10-15", author: ["Team"] },
    { title: "Best Practices", date: "2024-10-20", author: ["Team"] },
  ];

  // Three.js hooks
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // Fixed tablet dimensions
  const tabletWidth = 4;
  const tabletHeight = 3;
  const tabletDepth = 0.2;

  // Physics body for the tablet (mass: 0 = no gravity)
  const [ref, api] = useBox<THREE.Mesh>(() => ({
    mass: 0,
    position: initialPosition,
    args: [tabletWidth, tabletHeight, tabletDepth],
    material: {
      friction: 0.5,
      restitution: 0.3
    }
  }));

  // Handle tablet click to open terminal
  const handleTabletClick = useCallback((e: any) => {
    e.stopPropagation();
    if (!isPoweredOn) return;
    setTerminalOpen(true);
  }, [isPoweredOn]);

  // Handle billboard effect and animations
  useFrame((state) => {
    if (groupRef.current && ref.current) {
      // Make tablet always face the camera (billboard effect)
      const cameraWorldPos = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPos);
      groupRef.current.lookAt(cameraWorldPos);

      // Sync physics body rotation with visual rotation
      ref.current.rotation.copy(groupRef.current.rotation);

      // Keep position stable
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);

      // Pulse animation for hint text
      setPulseAnimation(Math.sin(state.clock.elapsedTime * 2) * 0.5 + 0.5);
    }
  });

  // Toggle power
  const togglePower = useCallback((e: any) => {
    e.stopPropagation();
    setIsPoweredOn(prev => !prev);
    if (terminalOpen) {
      setTerminalOpen(false); // Close terminal if powered off
    }
  }, [terminalOpen]);

  // Hide during gameplay
  if (isGamePlaying) {
    return null;
  }

  // Screen colors based on state
  const screenEmissive = isPoweredOn ? new THREE.Color(0x4488ff) : new THREE.Color(0x000000);
  const screenColor = isPoweredOn ? new THREE.Color(0x88ccff) : new THREE.Color(0x222222);

  return (
    <>
      <group ref={groupRef}>
        {/* Main tablet body */}
        <mesh ref={ref} onClick={handleTabletClick}>
          <RoundedBox args={[tabletWidth, tabletHeight, tabletDepth]} radius={0.1} smoothness={4}>
            <meshStandardMaterial
              color="#1a1a2e"
              metalness={0.8}
              roughness={0.2}
            />
          </RoundedBox>

          {/* Screen - front face */}
          <mesh position={[0, 0, tabletDepth / 2 + 0.01]}>
            <planeGeometry args={[tabletWidth - 0.4, tabletHeight - 0.4]} />
            <meshStandardMaterial
              color={screenColor}
              emissive={screenEmissive}
              emissiveIntensity={isPoweredOn ? 0.5 : 0}
              metalness={0.1}
              roughness={0.9}
            />
          </mesh>

          {/* Light emission when powered on */}
          {isPoweredOn && (
            <pointLight
              position={[0, 0, 1]}
              color="#4488ff"
              intensity={2}
              distance={8}
            />
          )}

          {/* Power button - bottom left */}
          <mesh
            position={[-tabletWidth / 2 + 0.3, -tabletHeight / 2 + 0.2, tabletDepth / 2 + 0.02]}
            onClick={togglePower}
          >
            <circleGeometry args={[0.12, 16]} />
            <meshStandardMaterial
              color={isPoweredOn ? "#00ff88" : "#ff0000"}
              emissive={isPoweredOn ? "#00ff88" : "#880000"}
              emissiveIntensity={0.5}
            />
          </mesh>

          {/* Preview content on screen when powered on */}
          {isPoweredOn && (
            <>
              {/* Main icon */}
              <Text
                position={[0, 0.3, tabletDepth / 2 + 0.03]}
                fontSize={0.5}
                color="#00ff88"
                anchorX="center"
                anchorY="middle"
              >
                ▶
              </Text>

              {/* Title */}
              <Text
                position={[0, -0.2, tabletDepth / 2 + 0.03]}
                fontSize={0.18}
                color="#4488ff"
                anchorX="center"
                anchorY="middle"
                fontWeight="bold"
              >
                TERMINAL
              </Text>

              {/* Hint text - pulsing */}
              <Text
                position={[0, -0.8, tabletDepth / 2 + 0.03]}
                fontSize={0.12}
                color={new THREE.Color(0x00ff88).multiplyScalar(0.5 + pulseAnimation * 0.5)}
                anchorX="center"
                anchorY="middle"
              >
                Click to Open
              </Text>

              {/* Feature indicators */}
              <Text
                position={[-1.2, 0.6, tabletDepth / 2 + 0.03]}
                fontSize={0.08}
                color="#888888"
                anchorX="center"
                anchorY="middle"
              >
                💬 Chat
              </Text>
              <Text
                position={[0, 0.6, tabletDepth / 2 + 0.03]}
                fontSize={0.08}
                color="#888888"
                anchorX="center"
                anchorY="middle"
              >
                📄 Articles
              </Text>
              <Text
                position={[1.2, 0.6, tabletDepth / 2 + 0.03]}
                fontSize={0.08}
                color="#888888"
                anchorX="center"
                anchorY="middle"
              >
                🎮 Game
              </Text>
            </>
          )}
        </mesh>
      </group>

      {/* Terminal Interface Overlay */}
      <TerminalInterface
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        articles={displayArticles}
        onStartGame={onStartGame}
      />
    </>
  );
}
