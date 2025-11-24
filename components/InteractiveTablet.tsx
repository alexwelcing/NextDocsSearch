import React, { useState, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox, Text } from '@react-three/drei';
import { useBox } from '@react-three/cannon';
import * as THREE from 'three';
// InteractiveTablet is now purely decorative - terminal controlled externally

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  cinematicRevealProgress?: number; // 0-1, controls fade-in during cinematic
}

export default function InteractiveTablet({
  initialPosition = [0, 2.5, 4], // Closer and slightly higher
  isGamePlaying = false,
  cinematicRevealProgress = 1,
}: InteractiveTabletProps) {
  // State management - tablet is now purely decorative
  const [isPoweredOn, setIsPoweredOn] = useState(true);
  const [pulseAnimation, setPulseAnimation] = useState(0);
  const [revealScale, setRevealScale] = useState(cinematicRevealProgress);
  const [floatOffset, setFloatOffset] = useState(0);
  const [breatheScale, setBreatheScale] = useState(1);
  const [screenGlow, setScreenGlow] = useState(0.5);

  // Three.js hooks
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  // BIGGER tablet dimensions for better presence
  const tabletWidth = 6;
  const tabletHeight = 4.5;
  const tabletDepth = 0.25;

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

  // Tablet is now purely decorative - terminal opens via separate button
  const handleTabletClick = useCallback((e: any) => {
    e.stopPropagation();
    // No action needed - terminal controlled externally
  }, []);

  // Handle billboard effect and animations
  useFrame((state) => {
    if (groupRef.current && ref.current) {
      const time = state.clock.elapsedTime;

      // Make tablet always face the camera (billboard effect)
      const cameraWorldPos = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPos);
      groupRef.current.lookAt(cameraWorldPos);

      // Sync physics body rotation with visual rotation
      ref.current.rotation.copy(groupRef.current.rotation);

      // Gentle floating animation (up and down)
      const floatAmount = Math.sin(time * 0.5) * 0.15; // Slower, more graceful
      setFloatOffset(floatAmount);

      // Breathing animation (subtle scale pulse)
      const breathe = 1 + Math.sin(time * 0.8) * 0.015; // Very subtle
      setBreatheScale(breathe);

      // Screen glow pulses gently
      const glowPulse = 0.6 + Math.sin(time * 0.4) * 0.2;
      setScreenGlow(glowPulse);

      // Keep position stable (with float offset)
      const currentPos = initialPosition;
      api.position.set(currentPos[0], currentPos[1] + floatAmount, currentPos[2]);
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 0, 0);

      // Pulse animation for hint text
      setPulseAnimation(Math.sin(time * 2) * 0.5 + 0.5);

      // Cinematic reveal animation - smooth scale transition
      const targetScale = cinematicRevealProgress;
      setRevealScale(prev => THREE.MathUtils.lerp(prev, targetScale, 0.1));

      // Apply scale to group (includes breathe)
      const easeScale = easeOutElastic(revealScale) * breatheScale;
      groupRef.current.scale.set(easeScale, easeScale, easeScale);
    }
  });

  // Toggle power
  const togglePower = useCallback((e: any) => {
    e.stopPropagation();
    setIsPoweredOn(prev => !prev);
  }, []);

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
        {/* Main tablet body (physics body) - Sleek dark frame */}
        <RoundedBox
          ref={ref}
          args={[tabletWidth, tabletHeight, tabletDepth]}
          radius={0.15}
          smoothness={8}
          onClick={handleTabletClick}
        >
          <meshStandardMaterial
            color="#0a0a0f"
            metalness={0.9}
            roughness={0.15}
            envMapIntensity={1.5}
          />
        </RoundedBox>

        {/* Screen - front face with dynamic glow */}
        <mesh position={[0, 0, tabletDepth / 2 + 0.01]}>
          <planeGeometry args={[tabletWidth - 0.5, tabletHeight - 0.5]} />
          <meshStandardMaterial
            color={screenColor}
            emissive={screenEmissive}
            emissiveIntensity={isPoweredOn ? screenGlow * 0.8 : 0}
            metalness={0.05}
            roughness={0.85}
            transparent
            opacity={0.98}
          />
        </mesh>

        {/* Rim light glow around screen */}
        {isPoweredOn && (
          <mesh position={[0, 0, tabletDepth / 2 + 0.005]}>
            <planeGeometry args={[tabletWidth - 0.35, tabletHeight - 0.35]} />
            <meshBasicMaterial
              color="#4488ff"
              transparent
              opacity={screenGlow * 0.15}
            />
          </mesh>
        )}

        {/* Screen light emission - stronger and more dynamic */}
        {isPoweredOn && (
          <>
            <pointLight
              position={[0, 0, 1.5]}
              color="#4488ff"
              intensity={screenGlow * 3}
              distance={12}
              decay={2}
            />
            {/* Rim lights for depth */}
            <pointLight
              position={[tabletWidth / 2, 0, 0.5]}
              color="#00ffaa"
              intensity={screenGlow * 0.8}
              distance={4}
            />
            <pointLight
              position={[-tabletWidth / 2, 0, 0.5]}
              color="#00ffaa"
              intensity={screenGlow * 0.8}
              distance={4}
            />
          </>
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
      </group>

      {/* Terminal Interface is now rendered at ThreeSixty level, not here */}
    </>
  );
}

// Easing function for elastic "pop" effect on reveal
function easeOutElastic(x: number): number {
  const c4 = (2 * Math.PI) / 3;
  return x === 0
    ? 0
    : x === 1
    ? 1
    : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
}
