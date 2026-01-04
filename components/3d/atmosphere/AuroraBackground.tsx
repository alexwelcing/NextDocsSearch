/**
 * AuroraBackground - Animated nebula/aurora effect
 *
 * Creates a dynamic, living background with flowing colors that
 * evokes the feeling of being in a cosmic space.
 */

import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ExperienceTheme } from '@/lib/3d/vision';

// Shader code
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uIntensity;
  uniform float uSpeed;

  varying vec2 vUv;
  varying vec3 vPosition;

  // Simplex noise functions
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    float t = uTime * uSpeed;

    // Create flowing aurora patterns
    float noise1 = snoise(vec3(vUv * 3.0, t * 0.5)) * 0.5 + 0.5;
    float noise2 = snoise(vec3(vUv * 2.0 + 100.0, t * 0.3)) * 0.5 + 0.5;
    float noise3 = snoise(vec3(vUv * 4.0 + 200.0, t * 0.4)) * 0.5 + 0.5;

    // Vertical gradient for aurora curtain effect
    float verticalGradient = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.0);

    // Mix colors based on noise
    vec3 color = mix(uColor1, uColor2, noise1);
    color = mix(color, uColor3, noise2 * 0.5);

    // Apply intensity and gradient
    float alpha = noise3 * verticalGradient * uIntensity;
    alpha *= smoothstep(0.0, 0.3, noise1);

    gl_FragColor = vec4(color, alpha * 0.6);
  }
`;

interface AuroraBackgroundProps {
  theme?: ExperienceTheme;
  enabled?: boolean;
  radius?: number;
}

const DEFAULT_AURORA_COLORS: [string, string, string] = [
  '#9d4edd',
  '#2dd4bf',
  '#00d4ff',
];

export default function AuroraBackground({
  theme,
  enabled = true,
  radius = 80,
}: AuroraBackgroundProps) {
  // Get colors from theme, memoized to prevent unnecessary re-renders
  const auroraColors = useMemo(
    () => theme?.atmosphere.auroraColors ?? DEFAULT_AURORA_COLORS,
    [theme?.atmosphere.auroraColors]
  );

  // Create shader material with uniforms
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(auroraColors[0]) },
        uColor2: { value: new THREE.Color(auroraColors[1]) },
        uColor3: { value: new THREE.Color(auroraColors[2]) },
        uIntensity: { value: 0.5 },
        uSpeed: { value: 0.3 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [auroraColors]);

  // Animate the aurora
  useFrame((state) => {
    if (!shaderMaterial || !enabled) return;
    shaderMaterial.uniforms.uTime.value = state.clock.elapsedTime;
  });

  if (!enabled) return null;

  return (
    <mesh>
      <sphereGeometry args={[radius, 32, 32]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}
