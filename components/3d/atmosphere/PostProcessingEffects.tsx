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
  ChromaticAberration,
  ToneMapping,
  DepthOfField,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { ExperienceTheme } from '@/lib/3d/vision';
import type { QualityLevel } from '@/lib/worlds/types';

interface PostProcessingEffectsProps {
  theme?: ExperienceTheme;
  quality?: QualityLevel;
  enabled?: boolean;
  focusDistance?: number;
  focusTarget?: THREE.Vector3;
}

export default function PostProcessingEffects({
  theme,
  quality = 'high',
  enabled = true,
  focusDistance = 10,
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
      chromaticAberration: quality === 'low' ? 0 : base.chromaticAberration,
      enableDOF: quality === 'ultra' || quality === 'high',
      enableNoise: quality !== 'low',
    };
  }, [theme?.postProcessing, quality]);

  if (!enabled || quality === 'low') return null;

  return (
    <EffectComposer multisampling={quality === 'ultra' ? 8 : 4}>
      {/* Bloom - creates glowing highlights */}
      <Bloom
        intensity={config.bloomIntensity}
        luminanceThreshold={config.bloomThreshold}
        luminanceSmoothing={0.9}
        radius={config.bloomRadius}
        mipmapBlur
      />

      {/* Depth of Field - focuses attention */}
      {config.enableDOF && (
        <DepthOfField
          focusDistance={focusDistance / 100}
          focalLength={0.02}
          bokehScale={2}
        />
      )}

      {/* Vignette - frames the view */}
      <Vignette
        offset={0.3}
        darkness={config.vignetteIntensity}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* Chromatic Aberration - subtle color fringing */}
      {config.chromaticAberration > 0 && (
        <ChromaticAberration
          offset={
            new THREE.Vector2(
              config.chromaticAberration,
              config.chromaticAberration
            )
          }
          radialModulation={false}
          modulationOffset={0}
        />
      )}

      {/* Film grain - adds texture */}
      {config.enableNoise && <Noise opacity={0.02} blendFunction={BlendFunction.OVERLAY} />}

      {/* Tone mapping - color grading */}
      <ToneMapping
        mode={ToneMappingMode.ACES_FILMIC}
        resolution={256}
        whitePoint={4.0}
        middleGrey={0.6}
        minLuminance={0.01}
        averageLuminance={1.0}
        adaptationRate={1.0}
      />
    </EffectComposer>
  );
}
