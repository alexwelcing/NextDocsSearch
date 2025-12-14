/**
 * SceneCanvas - Modern R3F Canvas with Three.js r182 optimizations
 *
 * This is the foundation of the new scene system, replacing the canvas setup
 * from ThreeSixty.tsx with modern patterns and better defaults.
 */

import React, { useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload } from '@react-three/drei';
import * as THREE from 'three';
import type { QualityLevel, DeviceCapabilities } from '@/lib/worlds/types';

interface SceneCanvasProps {
  children: React.ReactNode;
  quality?: QualityLevel;
  shadows?: boolean;
  onCreated?: (state: { gl: THREE.WebGLRenderer; scene: THREE.Scene }) => void;
}

/**
 * Detect device capabilities for adaptive quality
 */
function detectCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      qualityLevel: 'medium',
      supportsWebGPU: false,
      supportsSplats: true,
      maxTextureSize: 4096,
      isMobile: false,
      pixelRatio: 1,
    };
  }

  const isMobile =
    window.innerWidth < 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  // Check GPU capabilities via canvas
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096;

  // Determine quality level
  let qualityLevel: QualityLevel = 'medium';
  if (isMobile) {
    qualityLevel = 'low';
  } else if (maxTextureSize >= 16384 && window.devicePixelRatio >= 2) {
    qualityLevel = 'ultra';
  } else if (maxTextureSize >= 8192) {
    qualityLevel = 'high';
  }

  return {
    qualityLevel,
    supportsWebGPU: 'gpu' in navigator,
    supportsSplats: !isMobile || maxTextureSize >= 4096,
    maxTextureSize,
    isMobile,
    pixelRatio: Math.min(window.devicePixelRatio, isMobile ? 2 : 3),
  };
}

/**
 * Quality-based render settings
 */
const QUALITY_SETTINGS: Record<
  QualityLevel,
  {
    dpr: [number, number];
    antialias: boolean;
    shadows: boolean;
    shadowMapSize: number;
    performance: { min: number };
  }
> = {
  low: {
    dpr: [0.5, 1],
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    performance: { min: 0.2 },
  },
  medium: {
    dpr: [0.75, 1.5],
    antialias: false,
    shadows: false,
    shadowMapSize: 1024,
    performance: { min: 0.3 },
  },
  high: {
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    performance: { min: 0.5 },
  },
  ultra: {
    dpr: [1.5, 2.5],
    antialias: true,
    shadows: true,
    shadowMapSize: 4096,
    performance: { min: 0.7 },
  },
};

/**
 * Loading fallback component
 */
function LoadingFallback() {
  return null; // Canvas handles loading internally
}

/**
 * SceneCanvas - The modern scene foundation
 */
export default function SceneCanvas({
  children,
  quality: qualityOverride,
  shadows: shadowsOverride,
  onCreated,
}: SceneCanvasProps) {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);

  // Detect capabilities on mount
  useEffect(() => {
    setCapabilities(detectCapabilities());
  }, []);

  // Determine quality settings
  const quality = qualityOverride ?? capabilities?.qualityLevel ?? 'medium';
  const settings = QUALITY_SETTINGS[quality];

  // GL configuration - optimized for r182
  const glConfig = useMemo(
    () => ({
      powerPreference: 'high-performance' as const,
      antialias: settings.antialias,
      stencil: false,
      depth: true,
      alpha: false,
      // r182: Use appropriate tone mapping
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1,
      // r182: Output color space (replaces outputEncoding)
      outputColorSpace: THREE.SRGBColorSpace,
    }),
    [settings.antialias]
  );

  // Camera configuration
  const cameraConfig = useMemo(
    () => ({
      position: [0, 2, 10] as [number, number, number],
      fov: capabilities?.isMobile ? 70 : 60,
      near: 0.1,
      far: 1000,
    }),
    [capabilities?.isMobile]
  );

  // Handle canvas creation
  const handleCreated = useMemo(
    () =>
      (state: { gl: THREE.WebGLRenderer; scene: THREE.Scene }) => {
        const { gl, scene } = state;

        // r182: Configure renderer
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;

        // Shadow configuration (if enabled)
        if (shadowsOverride ?? settings.shadows) {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }

        // Scene defaults
        scene.background = new THREE.Color('#0a0a0f');

        // Callback
        onCreated?.(state);
      },
    [settings.shadows, shadowsOverride, onCreated]
  );

  // Don't render until capabilities are detected
  if (!capabilities) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#0a0a0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#666', fontSize: '14px' }}>Initializing...</div>
      </div>
    );
  }

  return (
    <Canvas
      dpr={settings.dpr}
      performance={settings.performance}
      gl={glConfig}
      camera={cameraConfig}
      shadows={shadowsOverride ?? settings.shadows}
      onCreated={handleCreated}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 4,
      }}
    >
      <Suspense fallback={<LoadingFallback />}>
        {children}
        <Preload all />
      </Suspense>
    </Canvas>
  );
}

/**
 * Export capabilities hook for child components
 */
export function useSceneCapabilities(): DeviceCapabilities {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    qualityLevel: 'medium',
    supportsWebGPU: false,
    supportsSplats: true,
    maxTextureSize: 4096,
    isMobile: false,
    pixelRatio: 1,
  });

  useEffect(() => {
    setCapabilities(detectCapabilities());
  }, []);

  return capabilities;
}
