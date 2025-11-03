import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SceneLightingProps {
  isCinematic?: boolean;
  cinematicProgress?: number;
}

export default function SceneLighting({ isCinematic = false, cinematicProgress = 0 }: SceneLightingProps) {
  const mainLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);

  // Animate lights during cinematic
  useFrame((state) => {
    if (isCinematic && mainLightRef.current && ambientRef.current) {
      // Gradually increase lighting as "eyes open"
      const intensity = THREE.MathUtils.lerp(0.1, 0.9, cinematicProgress);
      mainLightRef.current.intensity = intensity;
      ambientRef.current.intensity = THREE.MathUtils.lerp(0.1, 0.5, cinematicProgress);

      // Subtle light breathing effect
      const breathe = Math.sin(state.clock.elapsedTime * 0.5) * 0.1 + 0.9;
      if (fillLightRef.current) {
        fillLightRef.current.intensity = 0.4 * breathe * cinematicProgress;
      }
    }
  });

  return (
    <>
      {/* Ambient base lighting */}
      <ambientLight
        ref={ambientRef}
        intensity={isCinematic ? 0.1 : 0.5}
        color="#f0f4ff"
      />

      {/* Main Key Light - from front-top-right */}
      <directionalLight
        ref={mainLightRef}
        position={[8, 12, 6]}
        intensity={isCinematic ? 0.1 : 0.9}
        color="#ffffff"
        castShadow={false}
      />

      {/* Fill Light - from left, softer */}
      <directionalLight
        ref={fillLightRef}
        position={[-8, 8, 4]}
        intensity={isCinematic ? 0.05 : 0.4}
        color="#e8f0ff"
      />

      {/* Rim Light - from behind, creates depth */}
      <directionalLight
        ref={rimLightRef}
        position={[0, 5, -10]}
        intensity={isCinematic ? 0.05 : 0.3}
        color="#a8c0ff"
      />

      {/* Hemisphere Light - sky and ground colors */}
      <hemisphereLight
        args={['#87ceeb', '#4a3f7f', isCinematic ? 0.1 : 0.4]}
        position={[0, 50, 0]}
      />

      {/* Tablet accent light - spotlight on tablet area */}
      {!isCinematic && (
        <spotLight
          position={[0, 8, 8]}
          angle={0.4}
          penumbra={0.5}
          intensity={0.6}
          color="#88ccff"
          target-position={[0, 3, 5]}
          castShadow={false}
        />
      )}

      {/* Subtle point lights for atmosphere */}
      {!isCinematic && (
        <>
          <pointLight
            position={[5, 2, 5]}
            intensity={0.3}
            distance={10}
            color="#ff88cc"
          />
          <pointLight
            position={[-5, 2, -5]}
            intensity={0.3}
            distance={10}
            color="#88ccff"
          />
        </>
      )}
    </>
  );
}
