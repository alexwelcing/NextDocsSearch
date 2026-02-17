/**
 * PostProcessingEffects - Cinematic visual effects pipeline
 *
 * Adds bloom, vignette, and depth of field
 * to create a polished, immersive visual experience.
 */

import React, { useMemo } from 'react';
import {
  EffectComposer,
  Bloom,
  Vignette,
  DepthOfField,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import type { ExperienceTheme } from '@/lib/3d/vision';
import type { QualityLevel } from '@/lib/worlds/types';

interface PostProcessingEffectsProps {
  theme?: ExperienceTheme;
  quality?: QualityLevel;
  enabled?: boolean;
  /** Whether the cinematic intro is playing */
  isCinematic?: boolean;
  /** Cinematic progress 0-1 */
  cinematicProgress?: number;
  /** Whether the device is mobile (disables DOF to save fill-rate) */
  isMobile?: boolean;
}

export default function PostProcessingEffects({
  theme,
  quality = 'high',
  enabled = true,
  isCinematic = false,
  cinematicProgress = 0,
  isMobile = false,
}: PostProcessingEffectsProps) {
  // Get post-processing config from theme
  const config = useMemo(() => {
    const base = theme?.postProcessing ?? {
      bloomIntensity: 0.8,
      bloomThreshold: 0.6,
      bloomRadius: 0.4,
      vignetteIntensity: 0.3,
      chromaticAberration: 0.002,
      saturation: 1.1,
      contrast: 1.05,
    };

    // Scale effects based on quality
    const qualityMultipliers: Record<QualityLevel, number> = {
      low: 0,
      medium: 0.5,
      high: 0.85,
      ultra: 1.0,
    };

    const mult = qualityMultipliers[quality];

    return {
      ...base,
      bloomIntensity: base.bloomIntensity * mult,
      vignetteIntensity: base.vignetteIntensity * mult,
    };
  }, [theme?.postProcessing, quality]);

  // DOF configuration driven by cinematic progress
  const dofFocusDistance = useMemo(
    () => THREE.MathUtils.lerp(0.001, 0.02, cinematicProgress),
    [cinematicProgress]
  );
  const dofFocalLength = useMemo(
    () => THREE.MathUtils.lerp(0.02, 0.08, cinematicProgress),
    [cinematicProgress]
  );
  const dofBokehScale = useMemo(
    () => THREE.MathUtils.lerp(6, 1.5, cinematicProgress),
    [cinematicProgress]
  );

  if (!enabled || quality === 'low') return null;

  // During cinematic: include DOF in the effect chain (desktop only - too expensive on mobile)
  if (isCinematic && !isMobile) {
    return (
      <EffectComposer multisampling={0}>
        <DepthOfField
          focusDistance={dofFocusDistance}
          focalLength={dofFocalLength}
          bokehScale={dofBokehScale}
        />
        <Bloom
          intensity={config.bloomIntensity}
          luminanceThreshold={config.bloomThreshold}
          luminanceSmoothing={0.9}
          radius={config.bloomRadius}
          mipmapBlur
        />
        <Vignette
          offset={0.3}
          darkness={config.vignetteIntensity}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    );
  }

  // Cinematic on mobile: bloom + vignette only (no DOF)
  if (isCinematic && isMobile) {
    return (
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={config.bloomIntensity}
          luminanceThreshold={config.bloomThreshold}
          luminanceSmoothing={0.9}
          radius={config.bloomRadius}
          mipmapBlur
        />
        <Vignette
          offset={0.3}
          darkness={config.vignetteIntensity}
          blendFunction={BlendFunction.NORMAL}
        />
      </EffectComposer>
    );
  }

  // Normal mode: bloom + vignette only
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={config.bloomIntensity}
        luminanceThreshold={config.bloomThreshold}
        luminanceSmoothing={0.9}
        radius={config.bloomRadius}
        mipmapBlur
      />
      <Vignette
        offset={0.3}
        darkness={config.vignetteIntensity}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
