/**
 * SceneCamera - Unified camera system
 *
 * Combines functionality from:
 * - CinematicCamera (intro sequence)
 * - CameraController (game transitions)
 * - OrbitControls (exploration)
 *
 * Single source of truth for camera state.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CameraMode, CameraKeyframe, WorldCamera, CameraConstraints } from '@/lib/worlds/types';

interface SceneCameraProps {
  mode: CameraMode;
  config: WorldCamera;
  cinematicKeyframes?: CameraKeyframe[];
  onCinematicComplete?: () => void;
  onCinematicProgress?: (progress: number) => void;
}

/**
 * Easing functions
 */
const EASINGS = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t * t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

/**
 * Default cinematic intro keyframes
 */
const DEFAULT_CINEMATIC_KEYFRAMES: CameraKeyframe[] = [
  {
    // Far away — world is a distant speck
    position: [0, 30, 120],
    target: [0, 0, 0],
    fov: 50,
    duration: 1.5,
    easing: 'easeIn',
  },
  {
    // Accelerating approach
    position: [8, 20, 60],
    target: [0, 2, 0],
    fov: 65,
    duration: 2,
    easing: 'easeIn',
  },
  {
    // Fast flyby — wide FOV for speed feeling
    position: [4, 8, 20],
    target: [0, 2, 2],
    fov: 78,
    duration: 2,
    easing: 'easeInOut',
  },
  {
    // Rapid deceleration into the world
    position: [1, 4, 10],
    target: [0, 2, 3],
    fov: 72,
    duration: 1.5,
    easing: 'easeOut',
  },
  {
    // Settle at default orbit position
    position: [0, 2.5, 8],
    target: [0, 1.5, 0],
    fov: 72,
    duration: 1.5,
    easing: 'easeOut',
  },
];

/**
 * Calculate total duration of keyframes
 */
function getTotalDuration(keyframes: CameraKeyframe[]): number {
  return keyframes.reduce((sum, k) => sum + k.duration, 0);
}

/**
 * Reusable Vector3 instances to avoid per-frame GC pressure.
 * getInterpolatedState is called every frame during cinematic — allocating
 * 6 new Vector3s per frame caused visible stutter from garbage collection.
 */
const _interpPos = new THREE.Vector3();
const _interpTgt = new THREE.Vector3();
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();

/**
 * Get interpolated camera state at a given progress (0-1)
 */
function getInterpolatedState(
  keyframes: CameraKeyframe[],
  progress: number
): { position: THREE.Vector3; target: THREE.Vector3; fov: number } {
  const totalDuration = getTotalDuration(keyframes);
  const currentTime = progress * totalDuration;

  let accumulatedTime = 0;
  let currentKeyframe = keyframes[0];
  let nextKeyframe = keyframes[1] || keyframes[0];
  let segmentProgress = 0;

  for (let i = 0; i < keyframes.length - 1; i++) {
    const segmentDuration = keyframes[i].duration;
    if (currentTime <= accumulatedTime + segmentDuration) {
      currentKeyframe = keyframes[i];
      nextKeyframe = keyframes[i + 1];
      const timeInSegment = currentTime - accumulatedTime;
      segmentProgress = timeInSegment / segmentDuration;
      break;
    }
    accumulatedTime += segmentDuration;
  }

  // Apply easing
  const easing = EASINGS[currentKeyframe.easing || 'easeInOut'];
  const easedProgress = easing(segmentProgress);

  // Interpolate position (reuse module-level vectors)
  _tmpA.set(...currentKeyframe.position);
  _tmpB.set(...nextKeyframe.position);
  const position = _interpPos.lerpVectors(_tmpA, _tmpB, easedProgress);

  // Interpolate target
  _tmpA.set(...currentKeyframe.target);
  _tmpB.set(...nextKeyframe.target);
  const target = _interpTgt.lerpVectors(_tmpA, _tmpB, easedProgress);

  // Interpolate FOV
  const fov = THREE.MathUtils.lerp(
    currentKeyframe.fov || 60,
    nextKeyframe.fov || 60,
    easedProgress
  );

  return { position, target, fov };
}

export default function SceneCamera({
  mode,
  config,
  cinematicKeyframes,
  onCinematicComplete,
  onCinematicProgress,
}: SceneCameraProps) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  // Cinematic state
  const [cinematicActive, setCinematicActive] = useState(mode === 'cinematic');
  const cinematicStartTime = useRef<number | null>(null);
  const keyframes = cinematicKeyframes || DEFAULT_CINEMATIC_KEYFRAMES;
  const totalDuration = useMemo(() => getTotalDuration(keyframes), [keyframes]);

  // Target for lookAt
  const targetRef = useRef(new THREE.Vector3(...config.target));

  // Handle cinematic mode transitions (only depends on `mode` to avoid
  // config changes restarting the animation mid-playthrough)
  useEffect(() => {
    if (mode === 'cinematic') {
      setCinematicActive(true);
      cinematicStartTime.current = null;
    } else {
      setCinematicActive(false);
    }
  }, [mode]);

  // Set initial camera position and FOV for non-cinematic modes
  useEffect(() => {
    if (mode !== 'cinematic') {
      camera.position.set(...config.initial);
      targetRef.current.set(...config.target);
      camera.lookAt(targetRef.current);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = config.fov ?? 72;
        camera.updateProjectionMatrix();
      }
    }
  }, [mode, config, camera]);

  // Animation frame
  useFrame((state) => {
    // Cinematic mode animation
    if (cinematicActive) {
      if (cinematicStartTime.current === null) {
        cinematicStartTime.current = state.clock.elapsedTime;
      }

      const elapsed = state.clock.elapsedTime - cinematicStartTime.current;
      const progress = Math.min(elapsed / totalDuration, 1);

      const { position, target, fov } = getInterpolatedState(keyframes, progress);

      camera.position.copy(position);
      targetRef.current.copy(target);
      camera.lookAt(targetRef.current);

      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      onCinematicProgress?.(progress);

      if (progress >= 1) {
        setCinematicActive(false);
        onCinematicComplete?.();
      }
    }

    // Game mode - face forward
    if (mode === 'game' && controlsRef.current) {
      // Smoothly pan to forward-facing view
      const currentAzimuth = controlsRef.current.getAzimuthalAngle();
      const currentPolar = controlsRef.current.getPolarAngle();

      if (Math.abs(currentAzimuth) > 0.01 || Math.abs(currentPolar - Math.PI / 2) > 0.01) {
        // Interpolate towards target
        const newAzimuth = THREE.MathUtils.lerp(currentAzimuth, 0, 0.05);
        const newPolar = THREE.MathUtils.lerp(currentPolar, Math.PI / 2, 0.05);

        // Convert spherical to cartesian
        const distance = camera.position.distanceTo(targetRef.current);
        camera.position.x = targetRef.current.x + distance * Math.sin(newPolar) * Math.sin(newAzimuth);
        camera.position.y = targetRef.current.y + distance * Math.cos(newPolar);
        camera.position.z = targetRef.current.z + distance * Math.sin(newPolar) * Math.cos(newAzimuth);
      }
    }
  });

  // Don't render OrbitControls during cinematic or VR mode
  if (mode === 'cinematic' || mode === 'vr' || mode === 'locked') {
    return null;
  }

  const constraints: Partial<CameraConstraints> = config.constraints || {};

  return (
    <OrbitControls
      ref={controlsRef}
      target={targetRef.current}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
      panSpeed={0.5}
      minDistance={constraints.minDistance ?? 5}
      maxDistance={constraints.maxDistance ?? 50}
      minPolarAngle={constraints.minPolarAngle ?? 0.1}
      maxPolarAngle={constraints.maxPolarAngle ?? Math.PI / 2}
      minAzimuthAngle={constraints.minAzimuthAngle}
      maxAzimuthAngle={constraints.maxAzimuthAngle}
      enablePan={constraints.enablePan ?? false}
      enabled={mode === 'orbit'}
    />
  );
}

/**
 * Hook for programmatic camera control
 */
export function useCameraControl() {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3());

  const panTo = useCallback(
    (position: [number, number, number], target: [number, number, number], duration = 1) => {
      const startPosition = camera.position.clone();
      const endPosition = new THREE.Vector3(...position);
      const startTarget = targetRef.current.clone();
      const endTarget = new THREE.Vector3(...target);

      // Use GSAP if available, otherwise manual animation
      let startTime: number | null = null;

      const animate = (time: number) => {
        if (startTime === null) startTime = time;
        const elapsed = (time - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        const eased = EASINGS.easeInOut(progress);

        camera.position.lerpVectors(startPosition, endPosition, eased);
        targetRef.current.lerpVectors(startTarget, endTarget, eased);
        camera.lookAt(targetRef.current);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    },
    [camera]
  );

  const lookAt = useCallback(
    (target: [number, number, number]) => {
      targetRef.current.set(...target);
      camera.lookAt(targetRef.current);
    },
    [camera]
  );

  return { panTo, lookAt };
}
