/**
 * SceneEnvironment - Modern lighting and atmosphere
 *
 * Handles all scene lighting with r182 improvements:
 * - Better energy conservation in materials
 * - Improved shadow mapping (Vogel disk PCF)
 * - Environment map integration
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { LightingConfig, LightingPreset, LIGHTING_PRESETS } from '@/lib/worlds/types';

interface SceneEnvironmentProps {
  lighting?: LightingConfig;
  envMapPath?: string;
  isCinematic?: boolean;
  cinematicProgress?: number;
}

/**
 * Lighting preset configurations
 */
const PRESETS: Record<LightingPreset, Partial<LightingConfig>> = {
  day: {
    ambient: 0.5,
    directionalIntensity: 1,
    accentColor: '#ffffff',
  },
  night: {
    ambient: 0.15,
    directionalIntensity: 0.3,
    accentColor: '#4466ff',
  },
  sunset: {
    ambient: 0.4,
    directionalIntensity: 0.8,
    accentColor: '#ff8844',
  },
  overcast: {
    ambient: 0.6,
    directionalIntensity: 0.4,
    accentColor: '#ccccdd',
  },
  studio: {
    ambient: 0.3,
    directionalIntensity: 1.2,
    accentColor: '#ffffff',
  },
  dramatic: {
    ambient: 0.2,
    directionalIntensity: 1.5,
    accentColor: '#ff4488',
  },
  neon: {
    ambient: 0.1,
    directionalIntensity: 0.5,
    accentColor: '#ff00ff',
  },
  custom: {},
};

/**
 * Get merged lighting config from preset + overrides
 */
function getLightingConfig(config?: LightingConfig): LightingConfig {
  const preset = config?.preset ?? 'day';
  const presetConfig = PRESETS[preset];

  return {
    preset,
    ambient: config?.ambient ?? presetConfig.ambient ?? 0.5,
    directionalIntensity: config?.directionalIntensity ?? presetConfig.directionalIntensity ?? 1,
    accentColor: config?.accentColor ?? presetConfig.accentColor ?? '#ffffff',
    shadowsEnabled: config?.shadowsEnabled ?? false,
    envMapIntensity: config?.envMapIntensity ?? 1,
  };
}

export default function SceneEnvironment({
  lighting,
  envMapPath,
  isCinematic = false,
  cinematicProgress = 1,
}: SceneEnvironmentProps) {
  const mainLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  const config = useMemo(() => getLightingConfig(lighting), [lighting]);

  // Cinematic lighting animation
  useFrame((state) => {
    if (!isCinematic) return;

    if (mainLightRef.current && ambientRef.current) {
      // Gradually increase lighting as "eyes open"
      const intensity = THREE.MathUtils.lerp(0.1, config.directionalIntensity ?? 1, cinematicProgress);
      mainLightRef.current.intensity = intensity;
      ambientRef.current.intensity = THREE.MathUtils.lerp(0.1, config.ambient ?? 0.5, cinematicProgress);

      // Subtle breathing effect
      if (fillLightRef.current) {
        const breathe = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 0.9;
        fillLightRef.current.intensity = 0.4 * breathe * cinematicProgress;
      }
    }
  });

  // Parse accent color
  const accentColor = useMemo(() => new THREE.Color(config.accentColor), [config.accentColor]);

  return (
    <>
      {/* Environment map for reflections (if provided) */}
      {envMapPath && (
        <Environment
          files={envMapPath}
          background={false}
        />
      )}

      {/* Ambient base lighting */}
      <ambientLight
        ref={ambientRef}
        intensity={isCinematic ? 0.1 : config.ambient}
        color="#f0f4ff"
      />

      {/* Main Key Light - from front-top-right */}
      <directionalLight
        ref={mainLightRef}
        position={[8, 12, 6]}
        intensity={isCinematic ? 0.1 : config.directionalIntensity}
        color="#ffffff"
        castShadow={config.shadowsEnabled}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.0001}
      />

      {/* Fill Light - from left, softer */}
      <directionalLight
        ref={fillLightRef}
        position={[-8, 8, 4]}
        intensity={isCinematic ? 0.05 : 0.4}
        color="#e8f0ff"
      />

      {/* Rim Light - from behind, creates depth */}
      <directionalLight
        ref={rimLightRef}
        position={[0, 5, -10]}
        intensity={isCinematic ? 0.05 : 0.3}
        color={accentColor}
      />

      {/* Hemisphere Light - sky and ground colors */}
      <hemisphereLight
        args={['#87ceeb', '#4a3f7f', isCinematic ? 0.1 : 0.4]}
        position={[0, 50, 0]}
      />

      {/* Accent point lights (when not in cinematic) */}
      {!isCinematic && (
        <>
          <pointLight
            position={[5, 2, 5]}
            intensity={0.3}
            distance={10}
            color={accentColor}
          />
          <pointLight
            position={[-5, 2, -5]}
            intensity={0.3}
            distance={10}
            color="#88ccff"
          />
        </>
      )}
    </>
  );
}

/**
 * Spotlight for focused illumination (e.g., on tablet)
 */
export function SceneSpotlight({
  position,
  target,
  intensity = 0.6,
  color = '#88ccff',
  angle = 0.4,
  penumbra = 0.5,
}: {
  position: [number, number, number];
  target: [number, number, number];
  intensity?: number;
  color?: string;
  angle?: number;
  penumbra?: number;
}) {
  const spotRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  return (
    <>
      <object3D ref={targetRef} position={target} />
      <spotLight
        ref={spotRef}
        position={position}
        angle={angle}
        penumbra={penumbra}
        intensity={intensity}
        color={color}
        target={targetRef.current ?? undefined}
        castShadow={false}
      />
    </>
  );
}
