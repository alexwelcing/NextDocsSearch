/**
 * CosmicOrb - Glowing energy orb with shader-based effects
 *
 * A visually striking central element with fresnel glow,
 * animated energy patterns, and optional ring effects.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { orbVertexShader, orbFragmentShader } from '../shaders/particles';

interface CosmicOrbProps {
  position?: [number, number, number];
  radius?: number;
  color1?: string;
  color2?: string;
  intensity?: number;
  pulsing?: boolean;
  rings?: boolean;
}

const CosmicOrb: React.FC<CosmicOrbProps> = ({
  position = [0, 0, 0],
  radius = 1,
  color1 = '#00d4ff',
  color2 = '#8844ff',
  intensity = 1.5,
  pulsing = true,
  rings = true,
}) => {
  const orbRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(color1) },
      uColor2: { value: new THREE.Color(color2) },
      uIntensity: { value: intensity },
    }),
    [color1, color2, intensity]
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (orbRef.current) {
      const material = orbRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = time;

      // Pulsing scale
      if (pulsing) {
        const pulse = 1 + Math.sin(time * 2) * 0.05;
        orbRef.current.scale.setScalar(pulse);
      }
    }

    // Animate rings
    if (ringRef.current) {
      ringRef.current.rotation.x = time * 0.3;
      ringRef.current.rotation.z = time * 0.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = time * 0.25;
      ring2Ref.current.rotation.x = Math.PI / 2 + Math.sin(time * 0.5) * 0.2;
    }
  });

  return (
    <group position={position}>
      {/* Core orb */}
      <mesh ref={orbRef}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          vertexShader={orbVertexShader}
          fragmentShader={orbFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner glow */}
      <mesh scale={1.1}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={color1}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Outer glow */}
      <mesh scale={1.3}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial
          color={color2}
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Rings */}
      {rings && (
        <>
          <mesh ref={ringRef}>
            <torusGeometry args={[radius * 1.5, 0.02, 16, 64]} />
            <meshBasicMaterial
              color={color1}
              transparent
              opacity={0.6}
            />
          </mesh>
          <mesh ref={ring2Ref}>
            <torusGeometry args={[radius * 1.8, 0.015, 16, 64]} />
            <meshBasicMaterial
              color={color2}
              transparent
              opacity={0.4}
            />
          </mesh>
        </>
      )}
    </group>
  );
};

export default CosmicOrb;
