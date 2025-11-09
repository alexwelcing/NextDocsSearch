import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ParsedPrompt } from '../lib/generators/types';
import { buildGeometry } from '../lib/generators/geometryBuilder';
import { buildMaterial } from '../lib/generators/materialComposer';

interface Generated3DObjectProps {
  config: ParsedPrompt;
  onClick?: () => void;
}

export default function Generated3DObject({ config, onClick }: Generated3DObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  // Build geometry and material
  const geometry = useMemo(() => buildGeometry(config), [config]);
  const material = useMemo(() => buildMaterial(config.materials), [config.materials]);

  // Animation loop
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    timeRef.current += delta;

    // Apply animations
    if (config.animations) {
      for (const anim of config.animations) {
        switch (anim.type) {
          case 'rotate':
            meshRef.current.rotation.y += delta * anim.speed * anim.intensity;
            break;

          case 'float':
            meshRef.current.position.y =
              (config.position?.[1] || 0) +
              Math.sin(timeRef.current * anim.speed) * anim.intensity;
            break;

          case 'pulse':
            const pulseFactor =
              1 + Math.sin(timeRef.current * anim.speed) * anim.intensity * 0.1;
            meshRef.current.scale.setScalar(pulseFactor);
            break;

          case 'breathe':
            const breathe = Math.sin(timeRef.current * anim.speed * 0.5) * 0.5 + 0.5;
            if (material instanceof THREE.MeshStandardMaterial && material.emissive) {
              material.emissiveIntensity =
                (config.materials.emissiveIntensity || 1) * (0.5 + breathe * 0.5);
            }
            break;

          case 'drift':
            meshRef.current.position.x += Math.sin(timeRef.current * 0.5) * delta * anim.speed * 0.1;
            meshRef.current.position.z += Math.cos(timeRef.current * 0.3) * delta * anim.speed * 0.1;
            break;

          case 'flicker':
            if (material instanceof THREE.MeshStandardMaterial) {
              const flicker = Math.random() > 0.9 ? Math.random() * 0.5 : 1;
              material.opacity = (config.materials.opacity || 1) * flicker;
            }
            break;
        }
      }
    }

    // Apply distortion animations
    if (config.modifiers?.distortion?.animate && geometry) {
      // Subtle animation for distortion - would need shader for full effect
      meshRef.current.rotation.z = Math.sin(timeRef.current * 0.5) * 0.05;
    }
  });

  return (
    <group>
      {/* Main mesh */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        position={config.position || [0, 0, 0]}
        rotation={config.rotation || [0, 0, 0]}
        onClick={onClick}
        castShadow
        receiveShadow
      />

      {/* Atmospheric lighting */}
      {config.atmosphere?.lighting?.map((light, index) => {
        const pos = light.position || [0, 5, 5];
        switch (light.type) {
          case 'point':
            return (
              <pointLight
                key={index}
                color={light.color}
                intensity={light.intensity}
                position={pos}
                castShadow={light.castShadow}
                distance={light.distance}
                decay={light.decay || 2}
              />
            );
          case 'spot':
            return (
              <spotLight
                key={index}
                color={light.color}
                intensity={light.intensity}
                position={pos}
                castShadow={light.castShadow}
                angle={Math.PI / 6}
                penumbra={0.5}
              />
            );
          case 'directional':
            return (
              <directionalLight
                key={index}
                color={light.color}
                intensity={light.intensity}
                position={pos}
                castShadow={light.castShadow}
              />
            );
          default:
            return null;
        }
      })}

      {/* Particles (simplified) */}
      {config.atmosphere?.particles && (
        <Particles particleConfig={config.atmosphere.particles} />
      )}
    </group>
  );
}

// Simple particle system component
function Particles({ particleConfig }: { particleConfig: NonNullable<ParsedPrompt['atmosphere']['particles']> }) {
  const particlesRef = useRef<THREE.Points>(null);

  const [positions, geometry] = useMemo(() => {
    const count = Math.min(particleConfig.count, 200); // Limit for performance
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * particleConfig.spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * particleConfig.spread;
      positions[i * 3 + 2] = (Math.random() - 0.5) * particleConfig.spread;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    return [positions, geometry];
  }, [particleConfig]);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      color: particleConfig.color,
      size: particleConfig.size,
      opacity: particleConfig.opacity,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [particleConfig]);

  useFrame((state, delta) => {
    if (!particlesRef.current) return;

    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] += delta * particleConfig.speed;

      // Reset particles that go too high
      if (positions[i + 1] > particleConfig.spread / 2) {
        positions[i + 1] = -particleConfig.spread / 2;
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.rotation.y += delta * 0.1;
  });

  return <points ref={particlesRef} geometry={geometry} material={material} />;
}
