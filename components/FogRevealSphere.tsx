/**
 * Fog Reveal Sphere - 360 background with dynamic fog removal
 *
 * As articles are read, portions of the 360 background are revealed
 * through circular "windows" that clear the fog effect.
 *
 * Uses custom shader with fog texture that updates based on article progress.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { useTrophy } from './TrophyContext';
import { World, ArticlePosition } from '../config/worlds';

interface FogRevealSphereProps {
  world: World;
  radius?: number;
}

export const FogRevealSphere: React.FC<FogRevealSphereProps> = ({
  world,
  radius = 15,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { getFogRevealData } = useTrophy();

  // Create fallback texture (gradient based on world color)
  const fallbackTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 512, 256);
      gradient.addColorStop(0, '#000000');
      gradient.addColorStop(0.5, world.color);
      gradient.addColorStop(1, '#000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 512, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, [world.color]);

  // Try to load the 360 background texture, fallback to gradient
  const texture = fallbackTexture;

  // Get reveal data for this world
  const revealData = getFogRevealData(world.id);

  // Create fog reveal positions uniform (array of vec4: x=phi, y=theta, z=radius, w=intensity)
  const revealPositions = useMemo(() => {
    const positions = new Float32Array(20 * 4); // Support up to 20 articles
    let index = 0;

    world.articles.forEach((article, i) => {
      if (i >= 20) return; // Max 20 articles per world

      const isRead = revealData.articlesRead.includes(article.slug);
      const intensity = isRead ? 1.0 : 0.0;

      positions[index++] = article.phi;
      positions[index++] = article.theta;
      positions[index++] = article.radius;
      positions[index++] = intensity;
    });

    return positions;
  }, [world.articles, revealData.articlesRead]);

  // Custom shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uRevealPositions: { value: revealPositions },
        uRevealCount: { value: world.articles.length },
        uFogColor: { value: new THREE.Color(0x0a0a0f) },
        uFogDensity: { value: 0.85 }, // How much fog (0=clear, 1=fully obscured)
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec4 uRevealPositions[20]; // phi, theta, radius, intensity
        uniform int uRevealCount;
        uniform vec3 uFogColor;
        uniform float uFogDensity;
        uniform float uTime;

        varying vec2 vUv;
        varying vec3 vPosition;

        // Convert 3D position to spherical coordinates
        vec2 cartesianToSpherical(vec3 pos) {
          float r = length(pos);
          float phi = acos(pos.y / r);
          float theta = atan(pos.z, pos.x);
          return vec2(phi, theta);
        }

        // Calculate angular distance between two points on sphere
        float angularDistance(vec2 p1, vec2 p2) {
          // Haversine formula for spherical distance
          float dPhi = abs(p1.x - p2.x);
          float dTheta = abs(p1.y - p2.y);

          // Normalize theta difference (handle wraparound)
          if (dTheta > 3.14159) dTheta = 6.28318 - dTheta;

          float a = sin(dPhi / 2.0) * sin(dPhi / 2.0) +
                    cos(p1.x) * cos(p2.x) *
                    sin(dTheta / 2.0) * sin(dTheta / 2.0);

          return 2.0 * asin(sqrt(a));
        }

        void main() {
          // Sample the background texture
          vec4 texColor = texture2D(uTexture, vUv);

          // Calculate spherical coordinates of current fragment
          vec2 sphericalPos = cartesianToSpherical(normalize(vPosition));

          // Calculate fog reveal amount (starts at full fog)
          float reveal = 0.0;

          // Check each revealed article position
          for (int i = 0; i < 20; i++) {
            if (i >= uRevealCount) break;

            vec4 revealData = uRevealPositions[i];
            float intensity = revealData.w;

            if (intensity > 0.0) {
              vec2 revealPos = revealData.xy;
              float revealRadius = revealData.z;

              // Calculate distance to reveal center
              float dist = angularDistance(sphericalPos, revealPos);

              // Smooth falloff for reveal circle
              float revealAmount = smoothstep(revealRadius + 0.15, revealRadius - 0.05, dist);
              reveal = max(reveal, revealAmount * intensity);
            }
          }

          // Add subtle animation to fog
          float fogPulse = sin(uTime * 0.5 + sphericalPos.x * 2.0) * 0.05 + 0.95;
          float fogAmount = uFogDensity * fogPulse * (1.0 - reveal);

          // Mix background with fog
          vec3 finalColor = mix(texColor.rgb, uFogColor, fogAmount);

          // Add subtle glow at reveal edges
          float edgeGlow = smoothstep(0.8, 1.0, reveal) * (1.0 - reveal) * 0.3;
          finalColor += vec3(edgeGlow) * vec3(0.5, 0.7, 1.0); // Blue glow

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
  }, [texture, world.articles.length, revealPositions]);

  // Update uniforms when reveal positions change
  useEffect(() => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.uRevealPositions.value = revealPositions;
    }
  }, [revealPositions, shaderMaterial]);

  // Animate fog (subtle movement)
  useFrame(({ clock }) => {
    if (shaderMaterial) {
      shaderMaterial.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef} rotation={[0, 0, 0]}>
      <sphereGeometry args={[radius, 60, 40]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
};

export default FogRevealSphere;
