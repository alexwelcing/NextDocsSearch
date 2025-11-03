import { useRef, useEffect, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CinematicCameraProps {
  isPlaying: boolean;
  onComplete: () => void;
}

export default function CinematicCamera({ isPlaying, onComplete }: CinematicCameraProps) {
  const { camera } = useThree();
  const startTime = useRef<number | null>(null);
  const completed = useRef(false);

  // Cinematic sequence keyframes - memoized to prevent recreation
  const keyframes = useMemo(() => ({
    start: {
      position: new THREE.Vector3(0, 5, 15), // Far back, looking down
      lookAt: new THREE.Vector3(0, 0, 0),
      fov: 45,
    },
    mid: {
      position: new THREE.Vector3(2, 4, 12), // Slowly moving forward and to the side
      lookAt: new THREE.Vector3(0, 2, 0),
      fov: 50,
    },
    tabletReveal: {
      position: new THREE.Vector3(0, 3, 10), // Focusing on tablet area
      lookAt: new THREE.Vector3(0, 3, 5), // Looking at where tablet will be
      fov: 55,
    },
    final: {
      position: new THREE.Vector3(0, 2, 10), // Normal gameplay position
      lookAt: new THREE.Vector3(0, 2, 0),
      fov: 60,
    },
  }), []);

  useEffect(() => {
    if (isPlaying && !completed.current) {
      startTime.current = Date.now();

      // Set initial camera position
      camera.position.copy(keyframes.start.position);
      camera.lookAt(keyframes.start.lookAt);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = keyframes.start.fov;
        camera.updateProjectionMatrix();
      }
    }
  }, [isPlaying, camera, keyframes]);

  useFrame(() => {
    if (!isPlaying || completed.current || !startTime.current) return;

    const elapsed = (Date.now() - startTime.current) / 1000; // seconds
    const duration = 16; // Total cinematic duration

    if (elapsed >= duration) {
      completed.current = true;
      onComplete();
      return;
    }

    // Calculate progress through the sequence
    let progress = elapsed / duration;
    progress = easeInOutCubic(progress); // Smooth easing

    // Determine which keyframe pair we're between
    let fromKey: keyof typeof keyframes;
    let toKey: keyof typeof keyframes;
    let segmentProgress: number;

    if (progress < 0.3) {
      // 0-30%: start to mid
      fromKey = 'start';
      toKey = 'mid';
      segmentProgress = progress / 0.3;
    } else if (progress < 0.6) {
      // 30-60%: mid to tabletReveal
      fromKey = 'mid';
      toKey = 'tabletReveal';
      segmentProgress = (progress - 0.3) / 0.3;
    } else {
      // 60-100%: tabletReveal to final
      fromKey = 'tabletReveal';
      toKey = 'final';
      segmentProgress = (progress - 0.6) / 0.4;
    }

    // Smooth the segment progress
    segmentProgress = easeInOutQuad(segmentProgress);

    // Interpolate position
    const from = keyframes[fromKey];
    const to = keyframes[toKey];

    camera.position.lerpVectors(from.position, to.position, segmentProgress);

    // Interpolate look-at target
    const currentLookAt = new THREE.Vector3().lerpVectors(
      from.lookAt,
      to.lookAt,
      segmentProgress
    );
    camera.lookAt(currentLookAt);

    // Interpolate FOV
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = THREE.MathUtils.lerp(from.fov, to.fov, segmentProgress);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

// Easing functions
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuad(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
