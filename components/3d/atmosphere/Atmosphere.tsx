/**
 * Atmosphere - Unified atmospheric system
 *
 * Combines all atmospheric effects into a single component:
 * - Ambient particles (wisdom dust)
 * - Aurora background
 * - Breathing lights
 * - Post-processing effects
 * - Fog
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import AmbientParticles from './AmbientParticles';
import AuroraBackground from './AuroraBackground';
import BreathingLights from './BreathingLights';
import PostProcessingEffects from './PostProcessingEffects';
import {
  COSMIC_LIBRARY,
  getThemeForQuality,
  type ExperienceTheme,
} from '@/lib/3d/vision';
import type { QualityLevel } from '@/lib/worlds/types';

interface AtmosphereProps {
  theme?: ExperienceTheme;
  quality?: QualityLevel;
  enabled?: boolean;
  showParticles?: boolean;
  showAurora?: boolean;
  showPostProcessing?: boolean;
}

export default function Atmosphere({
  theme: themeProp,
  quality = 'high',
  enabled = true,
  showParticles = true,
  showAurora = true,
  showPostProcessing = true,
}: AtmosphereProps) {
  const { scene } = useThree();

  // Get quality-adjusted theme
  const theme = useMemo(() => {
    const baseTheme = themeProp ?? COSMIC_LIBRARY;
    return getThemeForQuality(baseTheme, quality);
  }, [themeProp, quality]);

  // Apply fog to scene
  useMemo(() => {
    if (!enabled || !theme.atmosphere.fogEnabled) {
      scene.fog = null;
      return;
    }

    scene.fog = new THREE.Fog(
      theme.atmosphere.fogColor,
      theme.atmosphere.fogNear,
      theme.atmosphere.fogFar
    );
  }, [scene, enabled, theme.atmosphere]);

  // Apply background color
  useMemo(() => {
    if (!enabled) return;
    scene.background = new THREE.Color(theme.colors.background);
  }, [scene, enabled, theme.colors.background]);

  if (!enabled) return null;

  // Calculate particle count based on quality
  const particleCount = Math.floor(500 * theme.atmosphere.particleDensity);

  return (
    <>
      {/* Breathing ambient lights */}
      <BreathingLights theme={theme} enabled />

      {/* Aurora/nebula background */}
      {showAurora && (
        <AuroraBackground
          theme={theme}
          enabled={theme.atmosphere.auroraEnabled}
          radius={80}
        />
      )}

      {/* Floating particles */}
      {showParticles && particleCount > 0 && (
        <AmbientParticles
          theme={theme}
          count={particleCount}
          radius={60}
          intensity={theme.atmosphere.particleDensity}
        />
      )}

      {/* Post-processing effects */}
      {showPostProcessing && (
        <PostProcessingEffects theme={theme} quality={quality} enabled />
      )}
    </>
  );
}

export { AmbientParticles, AuroraBackground, BreathingLights, PostProcessingEffects };
