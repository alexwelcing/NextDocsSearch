/**
 * BreathingLights - Dynamic ambient lighting system
 *
 * Creates a gentle, living quality to the lighting that subtly
 * pulses like breathing, making the space feel alive and organic.
 */

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ExperienceTheme } from '@/lib/3d/vision';

interface BreathingLightsProps {
  theme?: ExperienceTheme;
  enabled?: boolean;
}

export default function BreathingLights({
  theme,
  enabled = true,
}: BreathingLightsProps) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.PointLight>(null);
  const fillLightRef = useRef<THREE.PointLight>(null);

  // Get lighting config from theme
  const config = theme?.lighting ?? {
    ambientIntensity: 0.3,
    ambientColor: '#4a4a8a',
    keyLightIntensity: 0.8,
    keyLightColor: '#ffffff',
    keyLightPosition: [10, 15, 10] as [number, number, number],
    rimLightIntensity: 0.4,
    rimLightColor: '#9d4edd',
    breathingSpeed: 0.5,
    breathingAmount: 0.15,
  };

  // Animate the breathing effect
  useFrame((state) => {
    if (!enabled) return;

    const time = state.clock.elapsedTime;
    const breathingSpeed = config.breathingSpeed;
    const breathingAmount = config.breathingAmount;

    // Sinusoidal breathing pattern
    const breath = Math.sin(time * breathingSpeed * Math.PI * 2) * 0.5 + 0.5;
    const breathMult = 1 + breath * breathingAmount;

    // Apply breathing to ambient light
    if (ambientRef.current) {
      ambientRef.current.intensity = config.ambientIntensity * breathMult;
    }

    // Slightly offset breathing for key light
    const keyBreath =
      Math.sin((time * breathingSpeed + 0.5) * Math.PI * 2) * 0.5 + 0.5;
    const keyBreathMult = 1 + keyBreath * breathingAmount * 0.5;

    if (keyLightRef.current) {
      keyLightRef.current.intensity = config.keyLightIntensity * keyBreathMult;
    }

    // Rim light with different phase
    const rimBreath =
      Math.sin((time * breathingSpeed * 0.7 + 1) * Math.PI * 2) * 0.5 + 0.5;
    const rimBreathMult = 1 + rimBreath * breathingAmount * 0.8;

    if (rimLightRef.current) {
      rimLightRef.current.intensity = config.rimLightIntensity * rimBreathMult;
    }

    // Fill light subtle movement
    if (fillLightRef.current) {
      fillLightRef.current.position.y = 8 + Math.sin(time * 0.3) * 0.5;
    }
  });

  return (
    <>
      {/* Ambient - overall scene fill */}
      <ambientLight
        ref={ambientRef}
        color={config.ambientColor}
        intensity={config.ambientIntensity}
      />

      {/* Key light - main directional */}
      <directionalLight
        ref={keyLightRef}
        color={config.keyLightColor}
        intensity={config.keyLightIntensity}
        position={config.keyLightPosition}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-bias={-0.0001}
      />

      {/* Rim light - creates ethereal edge glow */}
      <pointLight
        ref={rimLightRef}
        color={config.rimLightColor}
        intensity={config.rimLightIntensity}
        position={[0, 5, -15]}
        distance={50}
        decay={2}
      />

      {/* Fill light - softens shadows */}
      <pointLight
        ref={fillLightRef}
        color="#4a6080"
        intensity={0.2}
        position={[-10, 8, 5]}
        distance={40}
        decay={2}
      />

      {/* Subtle ground bounce */}
      <hemisphereLight
        color={config.keyLightColor}
        groundColor={config.ambientColor}
        intensity={0.15}
      />
    </>
  );
}
