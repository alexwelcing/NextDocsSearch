/**
 * GalaxyCamera - Camera controller for galaxy view
 * 
 * Modes:
 * - ORBIT: Free rotation around center, mouse controls
 * - FOCUS: Centered on a specific world, can rotate around it
 * - WARP: Transition animation between positions
 * 
 * Uses smooth interpolation for all movements.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { World } from '@/lib/galaxy/world-registry';

type CameraMode = 'orbit' | 'focus' | 'warp';

interface GalaxyCameraProps {
  mode?: CameraMode;
  targetWorld?: World | null;
  onModeChange?: (mode: CameraMode) => void;
}

// Smooth camera state
interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export function GalaxyCamera({ mode = 'orbit', targetWorld, onModeChange }: GalaxyCameraProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  // Target camera state
  const targetState = useRef<CameraState>({
    position: new THREE.Vector3(50, 30, 50),
    target: new THREE.Vector3(0, 0, 0),
  });
  
  // Current interpolated state
  const currentState = useRef<CameraState>({
    position: new THREE.Vector3(50, 30, 50),
    target: new THREE.Vector3(0, 0, 0),
  });

  // Update target based on mode
  useEffect(() => {
    if (mode === 'focus' && targetWorld) {
      const [x, y, z] = targetWorld.position;
      targetState.current.position.set(x + 15, y + 10, z + 15);
      targetState.current.target.set(x, y, z);
    } else if (mode === 'orbit') {
      // Reset to overview position
      targetState.current.position.set(80, 40, 80);
      targetState.current.target.set(0, 0, 0);
    }
  }, [mode, targetWorld]);

  // Smooth interpolation
  useFrame((_, delta) => {
    const lerpFactor = Math.min(delta * 2, 1); // Smooth but responsive
    
    currentState.current.position.lerp(targetState.current.position, lerpFactor);
    currentState.current.target.lerp(targetState.current.target, lerpFactor);
    
    // Apply to camera
    camera.position.copy(currentState.current.position);
    
    // Update controls target
    if (controlsRef.current) {
      controlsRef.current.target.copy(currentState.current.target);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={mode === 'orbit'}
      enableZoom={true}
      enableRotate={true}
      minDistance={10}
      maxDistance={200}
      dampingFactor={0.05}
      autoRotate={mode === 'orbit'}
      autoRotateSpeed={0.5}
    />
  );
}

// Hook for camera control from UI
export function useGalaxyCamera() {
  const [mode, setMode] = useState<CameraMode>('orbit');
  const [targetWorld, setTargetWorld] = useState<World | null>(null);

  const focusOnWorld = (world: World) => {
    setTargetWorld(world);
    setMode('focus');
  };

  const resetToOrbit = () => {
    setTargetWorld(null);
    setMode('orbit');
  };

  const enterWorld = (world: World) => {
    // Navigate to the world
    window.location.href = world.entryPoint.url;
  };

  return {
    mode,
    targetWorld,
    focusOnWorld,
    resetToOrbit,
    enterWorld,
  };
}

export default GalaxyCamera;
