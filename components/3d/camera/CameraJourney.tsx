/**
 * CameraJourney - Smooth camera transitions and focal point management
 *
 * Provides cinematic camera movement between points of interest,
 * with easing functions and orbital controls for seamless navigation.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraJourneyProps {
  target?: [number, number, number];
  distance?: number;
  duration?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'elastic';
  onArrival?: () => void;
  autoOrbit?: boolean;
  orbitSpeed?: number;
  floatAmount?: number;
  floatSpeed?: number;
}

// Easing functions
const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t * t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  elastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export default function CameraJourney({
  target = [0, 0, 0],
  distance = 15,
  duration = 1.5,
  easing = 'easeInOut',
  onArrival,
  autoOrbit = false,
  orbitSpeed = 0.1,
  floatAmount = 0.2,
  floatSpeed = 0.3,
}: CameraJourneyProps) {
  const { camera } = useThree();

  // Animation state
  const state = useRef({
    isTransitioning: false,
    progress: 0,
    startPosition: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endPosition: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    currentTarget: new THREE.Vector3(),
    orbitAngle: 0,
  });

  // Calculate end position from target and distance
  const calculateEndPosition = useCallback(
    (targetPos: [number, number, number]): THREE.Vector3 => {
      const dir = camera.position.clone().sub(new THREE.Vector3(...targetPos));
      dir.normalize().multiplyScalar(distance);
      return new THREE.Vector3(...targetPos).add(dir);
    },
    [camera.position, distance]
  );

  // Start transition when target changes
  useEffect(() => {
    const s = state.current;

    s.startPosition.copy(camera.position);
    s.startTarget.copy(s.currentTarget);
    s.endTarget.set(...target);
    s.endPosition.copy(calculateEndPosition(target));

    s.isTransitioning = true;
    s.progress = 0;
  }, [target, camera.position, calculateEndPosition]);

  // Animation loop
  useFrame((_, delta) => {
    const s = state.current;
    const easeFn = easings[easing];

    if (s.isTransitioning) {
      // Update progress
      s.progress += delta / duration;

      if (s.progress >= 1) {
        // Transition complete
        s.progress = 1;
        s.isTransitioning = false;
        onArrival?.();
      }

      const t = easeFn(Math.min(s.progress, 1));

      // Interpolate position
      camera.position.lerpVectors(s.startPosition, s.endPosition, t);

      // Interpolate target
      s.currentTarget.lerpVectors(s.startTarget, s.endTarget, t);
      camera.lookAt(s.currentTarget);
    } else {
      // Apply ambient motion when not transitioning
      const time = performance.now() * 0.001;

      // Gentle floating
      const floatY = Math.sin(time * floatSpeed) * floatAmount;
      const floatX = Math.cos(time * floatSpeed * 0.7) * floatAmount * 0.5;

      camera.position.y += floatY * delta;
      camera.position.x += floatX * delta;

      // Auto orbit if enabled
      if (autoOrbit) {
        s.orbitAngle += orbitSpeed * delta;

        const orbitRadius = camera.position.distanceTo(s.currentTarget);
        const currentAngle = Math.atan2(
          camera.position.x - s.currentTarget.x,
          camera.position.z - s.currentTarget.z
        );

        camera.position.x =
          s.currentTarget.x + Math.sin(currentAngle + orbitSpeed * delta) * orbitRadius;
        camera.position.z =
          s.currentTarget.z + Math.cos(currentAngle + orbitSpeed * delta) * orbitRadius;
      }

      camera.lookAt(s.currentTarget);
    }
  });

  return null;
}

/**
 * Hook for programmatic camera control
 */
export function useCameraJourney() {
  const cameraRef = useRef<{
    flyTo: (target: [number, number, number], duration?: number) => Promise<void>;
    getCurrentTarget: () => [number, number, number];
  }>(null);

  return cameraRef;
}

/**
 * Predefined camera positions for common views
 */
export const CAMERA_PRESETS = {
  overview: {
    position: [0, 30, 40] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  closeup: {
    position: [0, 2, 8] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  side: {
    position: [30, 10, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  top: {
    position: [0, 50, 0.1] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
  cinematic: {
    position: [20, 15, 25] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
  },
};
