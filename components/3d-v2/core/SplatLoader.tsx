/**
 * SplatLoader - SparkJS Gaussian Splatting integration
 *
 * Loads and renders .splat, .spz, .ply files using SparkJS.
 * Falls back gracefully if SparkJS is not available.
 */

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SplatLoaderProps {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

// SparkJS mesh interface (minimal type for our usage)
interface SparkMesh {
  position: { set: (x: number, y: number, z: number) => void };
  rotation: { set: (x: number, y: number, z: number) => void };
  scale: { set: (x: number, y: number, z: number) => void; setScalar: (s: number) => void };
  dispose?: () => void;
}

// Dynamic import for SparkJS
let SplatMeshClass: (new (opts: { url: string }) => SparkMesh) | null = null;

const loadSparkJS = async (): Promise<typeof SplatMeshClass> => {
  if (SplatMeshClass) return SplatMeshClass;
  try {
    const spark = await import('@sparkjsdev/spark');
    SplatMeshClass = spark.SplatMesh as unknown as typeof SplatMeshClass;
    return SplatMeshClass;
  } catch (e) {
    console.warn('SparkJS not available, splat rendering disabled');
    return null;
  }
};

/**
 * Internal splat mesh component
 */
const SplatMeshComponent: React.FC<SplatLoaderProps> = ({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onLoad,
  onError,
}) => {
  const { scene } = useThree();
  const meshRef = useRef<SparkMesh | null>(null);

  useEffect(() => {
    let mounted = true;
    let splatMesh: SparkMesh | null = null;

    const load = async () => {
      try {
        const SplatMeshCtor = await loadSparkJS();
        if (!SplatMeshCtor || !mounted) return;

        // Create splat mesh
        splatMesh = new SplatMeshCtor({ url });

        // Apply transforms
        splatMesh.position.set(...position);
        splatMesh.rotation.set(...rotation);
        if (typeof scale === 'number') {
          splatMesh.scale.setScalar(scale);
        } else {
          splatMesh.scale.set(...scale);
        }

        // Add to scene
        (scene.add as (obj: unknown) => void)(splatMesh);
        meshRef.current = splatMesh;
        onLoad?.();
      } catch (e) {
        if (mounted) {
          console.error('Failed to load splat:', e);
          onError?.(e as Error);
        }
      }
    };

    load();

    return () => {
      mounted = false;
      if (splatMesh) {
        (scene.remove as (obj: unknown) => void)(splatMesh);
        splatMesh.dispose?.();
      }
    };
  }, [url, scene, position, rotation, scale, onLoad, onError]);

  return null;
};

/**
 * SplatLoader with loading state management
 */
const SplatLoader: React.FC<SplatLoaderProps & { fallback?: React.ReactNode }> = ({
  fallback,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  return (
    <Suspense fallback={null}>
      <SplatMeshComponent {...props} onError={() => setHasError(true)} />
    </Suspense>
  );
};

export default SplatLoader;
