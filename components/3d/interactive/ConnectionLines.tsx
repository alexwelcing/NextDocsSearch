/**
 * ConnectionLines - Visual links between related articles
 *
 * Creates glowing lines that connect related articles, forming
 * a constellation-like pattern that reveals the relationships
 * between ideas.
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ExperienceTheme } from '@/lib/3d/vision';

interface Connection {
  from: [number, number, number];
  to: [number, number, number];
  strength: number; // 0-1, affects opacity and thickness
}

interface ConnectionLinesProps {
  connections: Connection[];
  theme?: ExperienceTheme;
  animated?: boolean;
  pulseSpeed?: number;
}

export default function ConnectionLines({
  connections,
  theme,
  animated = true,
  pulseSpeed = 1,
}: ConnectionLinesProps) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const materialRef = useRef<THREE.LineBasicMaterial>(null);

  // Build geometry from connections
  const { geometry, opacities } = useMemo(() => {
    const positions: number[] = [];
    const opacities: number[] = [];

    connections.forEach(({ from, to, strength }) => {
      positions.push(from[0], from[1], from[2]);
      positions.push(to[0], to[1], to[2]);
      opacities.push(strength, strength);
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );

    return { geometry, opacities };
  }, [connections]);

  // Animate the lines
  useFrame((state) => {
    if (!materialRef.current || !animated) return;

    const time = state.clock.elapsedTime;

    // Gentle pulsing
    const pulse = Math.sin(time * pulseSpeed) * 0.5 + 0.5;
    materialRef.current.opacity = 0.15 + pulse * 0.1;
  });

  const lineColor = theme?.colors.highlight ?? '#00d4ff';

  return (
    <lineSegments ref={linesRef} geometry={geometry}>
      <lineBasicMaterial
        ref={materialRef}
        color={lineColor}
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

/**
 * Animated connection line between two points
 * Shows a flowing energy effect along the connection
 */
interface FlowingConnectionProps {
  from: [number, number, number];
  to: [number, number, number];
  color?: string;
  speed?: number;
}

export function FlowingConnection({
  from,
  to,
  color = '#00d4ff',
  speed = 1,
}: FlowingConnectionProps) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Create a curved path between points
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);

    // Add a slight arc
    const mid = start.clone().lerp(end, 0.5);
    const distance = start.distanceTo(end);
    mid.y += distance * 0.1;

    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [from, to]);

  // Animate the flow
  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime * speed;
  });

  return (
    <mesh ref={tubeRef}>
      <tubeGeometry args={[curve, 20, 0.02, 8, false]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uColor;
          varying vec2 vUv;

          void main() {
            // Create flowing dots along the line
            float flow = fract(vUv.x * 5.0 - uTime);
            float alpha = smoothstep(0.0, 0.1, flow) * smoothstep(0.5, 0.1, flow);

            // Fade at ends
            float endFade = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);

            gl_FragColor = vec4(uColor, alpha * endFade * 0.6);
          }
        `}
      />
    </mesh>
  );
}
