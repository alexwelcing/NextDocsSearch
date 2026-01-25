/**
 * SparkScene - Core 3D scene with SparkJS Gaussian Splatting support
 *
 * A clean, performant scene setup inspired by modern Three.js patterns.
 * Focuses on: minimal overhead, shader-based effects, smooth 60fps.
 */

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface SparkSceneProps {
  children: React.ReactNode;
  enableControls?: boolean;
  cameraPosition?: [number, number, number];
  backgroundColor?: string;
  onReady?: () => void;
}

// Performance-optimized renderer settings
const glConfig = {
  powerPreference: 'high-performance' as const,
  antialias: false, // Disable for performance, use FXAA post-process if needed
  stencil: false,
  depth: true,
  alpha: false,
};

// Adaptive DPR based on device
const getAdaptiveDPR = (): [number, number] => {
  if (typeof window === 'undefined') return [1, 2];
  const isMobile = window.innerWidth < 768;
  const isLowEnd = navigator.hardwareConcurrency <= 4;
  if (isMobile || isLowEnd) return [0.5, 1];
  return [1, 2];
};

/**
 * Scene initializer - runs once on mount
 */
const SceneInit: React.FC<{ onReady?: () => void }> = ({ onReady }) => {
  const { gl, scene } = useThree();

  useEffect(() => {
    // Optimize renderer
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;

    // Set scene background
    scene.background = new THREE.Color(0x0a0a10);

    onReady?.();
  }, [gl, scene, onReady]);

  return null;
};

/**
 * Minimal ambient lighting
 */
const SceneLighting: React.FC = () => (
  <>
    <ambientLight intensity={0.3} />
    <pointLight position={[10, 10, 10]} intensity={0.5} />
    <pointLight position={[-10, -10, -10]} intensity={0.2} color="#4488ff" />
  </>
);

/**
 * Main SparkScene component
 */
const SparkScene: React.FC<SparkSceneProps> = ({
  children,
  enableControls = true,
  cameraPosition = [0, 2, 10],
  backgroundColor = '#0a0a10',
  onReady,
}) => {
  const dpr = useMemo(() => getAdaptiveDPR(), []);

  return (
    <Canvas
      dpr={dpr}
      gl={glConfig}
      camera={{ position: cameraPosition, fov: 60, near: 0.1, far: 1000 }}
      performance={{ min: 0.5 }}
      style={{ background: backgroundColor }}
    >
      <SceneInit onReady={onReady} />
      <SceneLighting />

      {enableControls && (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5}
          minDistance={3}
          maxDistance={50}
          maxPolarAngle={Math.PI * 0.85}
        />
      )}

      {children}
    </Canvas>
  );
};

export default SparkScene;
export { SceneLighting, SceneInit };
