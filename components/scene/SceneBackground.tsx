/**
 * SceneBackground - Unified background system with splat-first approach
 *
 * Priority order:
 * 1. Gaussian Splat (if available and device capable)
 * 2. HDR Skybox (if provided)
 * 3. Textured Sphere (fallback)
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import type { WorldAssets, QualityLevel } from '@/lib/worlds/types';

interface SceneBackgroundProps {
  assets: WorldAssets;
  quality: QualityLevel;
  supportsSplats: boolean;
  transitionDuration?: number;
}

type BackgroundMode = 'splat' | 'skybox' | 'panorama' | 'none';

interface BackgroundState {
  mode: BackgroundMode;
  isLoading: boolean;
  error: string | null;
}

/**
 * Determine the best background mode based on assets and capabilities
 */
function determineBestMode(
  assets: WorldAssets,
  supportsSplats: boolean,
  quality: QualityLevel
): BackgroundMode {
  // Low quality devices skip splats
  if (quality === 'low') {
    if (assets.skybox) return 'skybox';
    if (assets.fallbackPanorama) return 'panorama';
    return 'none';
  }

  // Try splat first (supports .splat and .spz formats)
  if (assets.environment && (assets.environment.endsWith('.splat') || assets.environment.endsWith('.spz')) && supportsSplats) {
    return 'splat';
  }

  // Then skybox
  if (assets.skybox) return 'skybox';

  // Then panorama
  if (assets.fallbackPanorama) return 'panorama';

  return 'none';
}

export default function SceneBackground({
  assets,
  quality,
  supportsSplats,
  transitionDuration = 0.5,
}: SceneBackgroundProps) {
  const [state, setState] = useState<BackgroundState>({
    mode: 'none',
    isLoading: true,
    error: null,
  });

  // Determine best mode on mount/change
  useEffect(() => {
    const mode = determineBestMode(assets, supportsSplats, quality);
    setState({ mode, isLoading: true, error: null });
  }, [assets, supportsSplats, quality]);

  const handleLoadComplete = useCallback(() => {
    setState((s) => ({ ...s, isLoading: false }));
  }, []);

  const handleLoadError = useCallback((error: string) => {
    console.error('Background load error:', error);
    // Fallback to next best option
    setState((s) => {
      if (s.mode === 'splat') {
        if (assets.skybox) return { mode: 'skybox', isLoading: true, error: null };
        if (assets.fallbackPanorama) return { mode: 'panorama', isLoading: true, error: null };
      }
      return { ...s, isLoading: false, error };
    });
  }, [assets]);

  return (
    <>
      {state.mode === 'splat' && assets.environment && (
        <GaussianSplatRenderer
          splatUrl={assets.environment}
          onLoad={handleLoadComplete}
          onError={handleLoadError}
        />
      )}

      {state.mode === 'panorama' && assets.fallbackPanorama && (
        <PanoramaSphere
          imageUrl={assets.fallbackPanorama}
          transitionDuration={transitionDuration}
          onLoad={handleLoadComplete}
        />
      )}

      {state.mode === 'none' && (
        <DefaultBackground />
      )}
    </>
  );
}

/**
 * Gaussian Splat Renderer
 */
function GaussianSplatRenderer({
  splatUrl,
  onLoad,
  onError,
}: {
  splatUrl: string;
  onLoad: () => void;
  onError: (error: string) => void;
}) {
  const { scene, camera, gl } = useThree();
  const viewerRef = useRef<any>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    try {
      const viewer = new GaussianSplats3D.Viewer({
        cameraUp: [0, 1, 0],
        initialCameraPosition: [0, 0, 0],
        initialCameraLookAt: [0, 0, -1],
        renderer: gl,
        camera: camera,
      });

      viewerRef.current = viewer;

      viewer
        .addSplatScene(splatUrl, {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        })
        .then(() => {
          console.log('Gaussian Splat loaded:', splatUrl);
          viewer.start();
          onLoad();
        })
        .catch((error: Error) => {
          console.error('Failed to load Gaussian Splat:', error);
          onError(error.message);
        });
    } catch (error) {
      onError((error as Error).message);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.dispose();
        viewerRef.current = null;
        loadedRef.current = false;
      }
    };
  }, [splatUrl, scene, camera, gl, onLoad, onError]);

  return null;
}

/**
 * 360 Panorama Sphere - optimized version
 */
function PanoramaSphere({
  imageUrl,
  transitionDuration,
  onLoad,
}: {
  imageUrl: string;
  transitionDuration: number;
  onLoad: () => void;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [nextTexture, setNextTexture] = useState<THREE.Texture | null>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const opacityRef = useRef(0);
  const isFadingRef = useRef(false);

  // Optimized sphere geometry
  const geometry = useMemo(() => new THREE.SphereGeometry(50, 32, 16), []);

  // Load texture
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (tex) => {
        // r182: Use colorSpace instead of encoding
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;

        if (texture) {
          setNextTexture(tex);
          opacityRef.current = 0;
          isFadingRef.current = true;
        } else {
          setTexture(tex);
          onLoad();
        }
      },
      undefined,
      (err) => console.error('Error loading panorama:', err)
    );
  }, [imageUrl, texture, onLoad]);

  // Crossfade animation
  useFrame((_, delta) => {
    if (!isFadingRef.current || !nextTexture) return;

    const fadeSpeed = 1 / transitionDuration;
    opacityRef.current = Math.min(opacityRef.current + fadeSpeed * delta, 1);

    if (materialRef.current) {
      materialRef.current.opacity = opacityRef.current;
    }

    if (opacityRef.current >= 1) {
      setTexture(nextTexture);
      setNextTexture(null);
      isFadingRef.current = false;
      opacityRef.current = 0;
    }
  });

  if (!texture) return null;

  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial
          map={texture}
          side={THREE.BackSide}
        />
      </mesh>

      {nextTexture && (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            ref={materialRef}
            map={nextTexture}
            side={THREE.BackSide}
            transparent
            opacity={opacityRef.current}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}

/**
 * Default gradient background when no assets provided
 */
function DefaultBackground() {
  const { scene } = useThree();

  useEffect(() => {
    // Dark gradient background
    scene.background = new THREE.Color('#0a0a1a');
  }, [scene]);

  return (
    <mesh>
      <sphereGeometry args={[100, 16, 8]} />
      <meshBasicMaterial
        side={THREE.BackSide}
        color="#0a0a1a"
      />
    </mesh>
  );
}

/**
 * Export background state hook
 */
export function useBackgroundState() {
  const [state, setState] = useState<BackgroundState>({
    mode: 'none',
    isLoading: true,
    error: null,
  });

  return { state, setState };
}
