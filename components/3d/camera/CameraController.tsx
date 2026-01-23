import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { GameState } from '../game/ClickingGame';
import * as THREE from 'three';

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

  // When game countdown begins, start camera pan
  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      // Simple null check - controls may not be ready yet
      if (!isPanningRef.current && controls) {
        // @ts-expect-error - OrbitControls methods not in base type
        const azimuth = controls.getAzimuthalAngle?.();
        // @ts-expect-error - OrbitControls methods not in base type
        const polar = controls.getPolarAngle?.();

        if (typeof azimuth === 'number' && typeof polar === 'number') {
          startAzimuthRef.current = azimuth;
          startPolarRef.current = polar;
          isPanningRef.current = true;
          panProgressRef.current = 0;
        }
      }
    } else if (gameState === 'IDLE' || gameState === 'GAME_OVER' || gameState === 'STARTING') {
      isPanningRef.current = false;
      panProgressRef.current = 0;
    }
  }, [gameState, controls]);

  // Smooth camera pan animation
  useFrame((_, delta) => {
    // Early exit if not panning or controls not ready
    if (!isPanningRef.current || !controls) return;

    // Verify controls has required methods before using
    // @ts-expect-error - OrbitControls methods not in base type
    if (typeof controls.getDistance !== 'function') return;
    // @ts-expect-error - OrbitControls methods not in base type
    if (!controls.target) return;

    panProgressRef.current = Math.min(1, panProgressRef.current + delta * 0.8);

    const easeOut = 1 - Math.pow(1 - panProgressRef.current, 3);

    let deltaAzimuth = targetAzimuth - startAzimuthRef.current;
    if (deltaAzimuth > Math.PI) deltaAzimuth -= Math.PI * 2;
    if (deltaAzimuth < -Math.PI) deltaAzimuth += Math.PI * 2;

    const currentAzimuth = startAzimuthRef.current + deltaAzimuth * easeOut;
    const currentPolar = THREE.MathUtils.lerp(
      startPolarRef.current,
      targetPolar,
      easeOut
    );

    // @ts-expect-error - OrbitControls methods
    const radius = controls.getDistance();
    const offset = new THREE.Vector3();

    offset.x = radius * Math.sin(currentPolar) * Math.sin(currentAzimuth);
    offset.y = radius * Math.cos(currentPolar);
    offset.z = radius * Math.sin(currentPolar) * Math.cos(currentAzimuth);

    // @ts-expect-error - OrbitControls target property
    camera.position.copy(controls.target).add(offset);
    // @ts-expect-error - OrbitControls target property
    camera.lookAt(controls.target);

    // @ts-expect-error - OrbitControls update method
    controls.update?.();

    if (panProgressRef.current >= 1) {
      isPanningRef.current = false;
    }
  });

  return null;
};

export default CameraController;
