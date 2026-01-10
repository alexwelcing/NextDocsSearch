/**
 * PostProcessingEffects - Cinematic visual effects pipeline
 *
 * Adds bloom, vignette, chromatic aberration, and color grading
 * to create a polished, immersive visual experience.
 */

import React, { useMemo } from 'react';
import {
  EffectComposer,
  Bloom,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import type { ExperienceTheme } from '@/lib/3d/vision';
import type { QualityLevel } from '@/lib/worlds/types';

interface PostProcessingEffectsProps {
  theme?: ExperienceTheme;
  quality?: QualityLevel;
  enabled?: boolean;
}

export default function PostProcessingEffects({
  theme,
  quality = 'high',
  enabled = true,
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

  if (!enabled || quality === 'low') return null;

  // Simplified effect stack - only core effects that are always valid
  return (
    <EffectComposer multisampling={quality === 'ultra' ? 8 : 4}>
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
