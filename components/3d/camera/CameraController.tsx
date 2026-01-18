import { useRef, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { GameState } from '../game/ClickingGame';
import * as THREE from 'three';

// Type for OrbitControls-like object
interface OrbitControlsLike {
  target: THREE.Vector3;
  getAzimuthalAngle: () => number;
  getPolarAngle: () => number;
  getDistance: () => number;
  update: () => void;
}

interface CameraControllerProps {
  gameState: GameState;
}

/**
 * Controls camera animation when game starts
 * Smoothly pans camera to face forward (shooting gallery view)
 */
const CameraController: React.FC<CameraControllerProps> = ({ gameState }) => {
  const { camera, controls } = useThree();
  const isPanningRef = useRef(false);
  const panProgressRef = useRef(0);
  const startAzimuthRef = useRef(0);
  const startPolarRef = useRef(0);

  // Target angles: face forward
  const targetAzimuth = 0; // 0 radians = facing forward (negative Z)
  const targetPolar = Math.PI / 2; // 90 degrees = horizontal view

  // Helper to safely get controls as OrbitControls - memoized to avoid recreation
  const getOrbitControls = useCallback((): OrbitControlsLike | null => {
    if (!controls) return null;
    // Safe type assertion with runtime validation
    const ctrl = controls as unknown as Partial<OrbitControlsLike>;
    // Validate that it has the required methods/properties before returning
    if (
      !ctrl.target ||
      typeof ctrl.getAzimuthalAngle !== 'function' ||
      typeof ctrl.getPolarAngle !== 'function' ||
      typeof ctrl.getDistance !== 'function' ||
      typeof ctrl.update !== 'function'
    ) {
      return null;
    }
    return ctrl as OrbitControlsLike;
  }, [controls]);

  // When game countdown begins, start camera pan
  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      const orbitControls = getOrbitControls();
      if (!isPanningRef.current && orbitControls) {
        // Store the starting angles from OrbitControls
        startAzimuthRef.current = orbitControls.getAzimuthalAngle();
        startPolarRef.current = orbitControls.getPolarAngle();
        isPanningRef.current = true;
        panProgressRef.current = 0;
      }
    } else if (gameState === 'IDLE' || gameState === 'GAME_OVER' || gameState === 'STARTING') {
      // Stop panning when not in countdown/playing
      isPanningRef.current = false;
      panProgressRef.current = 0;
    }
  }, [gameState, getOrbitControls]);

  // Smooth camera pan animation
  useFrame((state, delta) => {
    if (!isPanningRef.current) return;

    const orbitControls = getOrbitControls();
    if (!orbitControls) return;

    // Increment progress (takes ~1.5 seconds to complete)
    panProgressRef.current = Math.min(1, panProgressRef.current + delta * 0.8);

    // Ease-out interpolation for smooth deceleration
    const easeOut = 1 - Math.pow(1 - panProgressRef.current, 3);

    // Calculate the shortest path for azimuth (handle wrapping around 2π)
    let deltaAzimuth = targetAzimuth - startAzimuthRef.current;
    if (deltaAzimuth > Math.PI) deltaAzimuth -= Math.PI * 2;
    if (deltaAzimuth < -Math.PI) deltaAzimuth += Math.PI * 2;

    const currentAzimuth = startAzimuthRef.current + deltaAzimuth * easeOut;
    const currentPolar = THREE.MathUtils.lerp(
      startPolarRef.current,
      targetPolar,
      easeOut
    );

    // Update OrbitControls using spherical coordinates
    const radius = orbitControls.getDistance();
    const offset = new THREE.Vector3();

    // Convert spherical to Cartesian
    offset.x = radius * Math.sin(currentPolar) * Math.sin(currentAzimuth);
    offset.y = radius * Math.cos(currentPolar);
    offset.z = radius * Math.sin(currentPolar) * Math.cos(currentAzimuth);

    // Set camera position relative to target
    camera.position.copy(orbitControls.target).add(offset);
    camera.lookAt(orbitControls.target);

    orbitControls.update();

    // Stop panning when complete
    if (panProgressRef.current >= 1) {
      isPanningRef.current = false;
    }
  });

  return null;
};

export default CameraController;
