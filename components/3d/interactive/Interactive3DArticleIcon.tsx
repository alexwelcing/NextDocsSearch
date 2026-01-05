/**
 * Interactive3DArticleIcon - A magical floating article discovery orb
 *
 * An ethereal, animated 3D object that invites users to explore articles.
 * Features smooth animations, magical particle effects, and an AI eye at center.
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface Interactive3DArticleIconProps {
  position?: [number, number, number];
  scale?: number;
  label?: string;
  onClick?: () => void;
  autoFloat?: boolean;
  boundRadius?: number;
  color?: string;
  glowColor?: string;
}

export default function Interactive3DArticleIcon({
  position = [3, 2, -2],
  scale = 1,
  label = 'Explore Articles',
  onClick,
  autoFloat = true,
  boundRadius = 3,
  color = '#00d4ff',
  glowColor = '#ffd700',
}: Interactive3DArticleIconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerOrbRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const eyeRef = useRef<THREE.Group>(null);
  const particleRef = useRef<THREE.Points>(null);

  const [hovered, setHovered] = useState(false);

  // Animation state stored in ref for performance
  const anim = useRef({
    time: Math.random() * Math.PI * 2,
    targetPos: new THREE.Vector3(...position),
    currentPos: new THREE.Vector3(...position),
    eyeLookTarget: new THREE.Vector3(0, 0, 1),
    blinkTimer: 0,
    isBlinking: false,
    pupilDilation: 1,
  });

  // Create particle system for ambient magic
  const particleCount = 30;
  const particleData = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.6 + Math.random() * 0.4;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      scales[i] = 0.02 + Math.random() * 0.03;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    return { geometry, positions, scales, phases };
  }, []);

  // Particle shader material
  const particleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uHovered: { value: 0 },
      },
      vertexShader: `
        attribute float scale;
        attribute float phase;
        uniform float uTime;
        uniform float uHovered;
        varying float vAlpha;

        void main() {
          float orbit = uTime * 0.5 + phase;
          vec3 pos = position;

          // Orbit animation
          float c = cos(orbit);
          float s = sin(orbit);
          pos.xz = mat2(c, -s, s, c) * pos.xz;

          // Pulse outward when hovered
          float expand = 1.0 + uHovered * 0.3;
          pos *= expand;

          // Breathing effect
          float breathe = 1.0 + sin(uTime * 2.0 + phase) * 0.1;
          pos *= breathe;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = scale * (200.0 + uHovered * 100.0) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;

          vAlpha = 0.5 + sin(uTime * 3.0 + phase) * 0.3;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;

          float glow = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(uColor, glow * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color]);

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const a = anim.current;
    a.time += delta;

    // Floating movement
    if (autoFloat) {
      const floatSpeed = 0.2;
      const floatX = Math.sin(a.time * floatSpeed) * boundRadius * 0.15;
      const floatY = Math.sin(a.time * floatSpeed * 0.7) * 0.5 + position[1];
      const floatZ = Math.cos(a.time * floatSpeed * 0.5) * boundRadius * 0.15 + position[2];
      a.targetPos.set(floatX + position[0], floatY, floatZ);
    }

    // Smooth movement
    a.currentPos.lerp(a.targetPos, delta * 3);
    groupRef.current.position.copy(a.currentPos);

    // Inner orb animation
    if (innerOrbRef.current) {
      const mat = innerOrbRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = hovered ? 0.8 : 0.4 + Math.sin(a.time * 2) * 0.1;

      // Subtle rotation
      innerOrbRef.current.rotation.y = a.time * 0.3;
      innerOrbRef.current.rotation.x = Math.sin(a.time * 0.5) * 0.1;
    }

    // Outer ring rotation
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = a.time * 0.5;
      outerRingRef.current.rotation.x = Math.PI / 2 + Math.sin(a.time * 0.3) * 0.1;
    }

    // AI Eye animation - looks at camera with personality
    if (eyeRef.current) {
      // Eye follows camera with lag
      const camera = state.camera.position.clone().sub(a.currentPos).normalize();
      a.eyeLookTarget.lerp(camera, delta * 2);

      // Apply look direction to eye
      const lookX = a.eyeLookTarget.x * 0.05;
      const lookY = a.eyeLookTarget.y * 0.05;

      // Get pupil mesh (second child)
      const pupil = eyeRef.current.children[1] as THREE.Mesh;
      if (pupil) {
        pupil.position.x = lookX;
        pupil.position.y = lookY;
      }

      // Blinking
      a.blinkTimer += delta;
      if (a.blinkTimer > 3 + Math.random() * 2) {
        a.isBlinking = true;
        a.blinkTimer = 0;
      }

      if (a.isBlinking) {
        const eyelid = eyeRef.current.children[2] as THREE.Mesh;
        if (eyelid) {
          eyelid.scale.y = Math.abs(Math.sin(a.time * 15));
          if (Math.sin(a.time * 15) < -0.9) {
            a.isBlinking = false;
            eyelid.scale.y = 0;
          }
        }
      }

      // Pupil dilation based on hover
      const targetDilation = hovered ? 1.3 : 1;
      a.pupilDilation += (targetDilation - a.pupilDilation) * delta * 5;
      if (pupil) {
        pupil.scale.setScalar(a.pupilDilation);
      }
    }

    // Update particle shader
    particleMaterial.uniforms.uTime.value = a.time;
    particleMaterial.uniforms.uHovered.value = hovered ? 1 : 0;
  });

  const handlePointerEnter = useCallback(() => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  const handleClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  return (
    <group ref={groupRef}>
      {/* Outer glow */}
      <mesh scale={hovered ? 1.3 : 1.1}>
        <sphereGeometry args={[0.5 * scale, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered ? 0.25 : 0.15}
          depthWrite={false}
        />
      </mesh>

      {/* Main orb body */}
      <mesh
        ref={innerOrbRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <sphereGeometry args={[0.35 * scale, 32, 32]} />
        <meshStandardMaterial
          color="#0a1628"
          emissive={color}
          emissiveIntensity={0.4}
          metalness={0.9}
          roughness={0.1}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Rotating ring */}
      <mesh ref={outerRingRef}>
        <torusGeometry args={[0.45 * scale, 0.02 * scale, 8, 64]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={hovered ? 0.8 : 0.3}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* Second ring at different angle */}
      <mesh rotation={[Math.PI / 3, 0, Math.PI / 4]}>
        <torusGeometry args={[0.42 * scale, 0.015 * scale, 8, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.6 : 0.2}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* AI Eye - the intelligent indicator */}
      <group ref={eyeRef} position={[0, 0, 0.32 * scale]}>
        {/* Eye white/sclera */}
        <mesh>
          <circleGeometry args={[0.12 * scale, 32]} />
          <meshBasicMaterial color="#e8f4f8" />
        </mesh>

        {/* Iris + Pupil */}
        <mesh position={[0, 0, 0.001]}>
          <circleGeometry args={[0.07 * scale, 32]} />
          <meshBasicMaterial color={color} />
        </mesh>

        {/* Pupil center */}
        <mesh position={[0, 0, 0.002]}>
          <circleGeometry args={[0.035 * scale, 32]} />
          <meshBasicMaterial color="#000000" />
        </mesh>

        {/* Eye highlight */}
        <mesh position={[0.025 * scale, 0.025 * scale, 0.003]}>
          <circleGeometry args={[0.015 * scale, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Eyelid for blinking */}
        <mesh position={[0, 0.12 * scale, 0.004]} scale={[1, 0, 1]}>
          <planeGeometry args={[0.3 * scale, 0.15 * scale]} />
          <meshBasicMaterial color="#0a1628" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Orbiting particles */}
      <points geometry={particleData.geometry} material={particleMaterial} />

      {/* Document icon inside orb */}
      <group rotation={[0, 0, 0]} scale={0.15 * scale}>
        <RoundedBox args={[1, 1.3, 0.1]} radius={0.05} position={[0, 0, 0]}>
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.2}
            transparent
            opacity={0.6}
          />
        </RoundedBox>
        {/* Text lines on document */}
        {[-0.35, -0.1, 0.15, 0.4].map((y, i) => (
          <mesh key={i} position={[0, y, 0.06]}>
            <planeGeometry args={[0.6 - i * 0.1, 0.08]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>

      {/* Label on hover */}
      {hovered && (
        <Billboard position={[0, 0.7 * scale, 0]}>
          <Text
            fontSize={0.12 * scale}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            {label}
          </Text>
          <Text
            fontSize={0.07 * scale}
            color={color}
            anchorX="center"
            anchorY="top"
            position={[0, -0.02, 0]}
          >
            Click to discover
          </Text>
        </Billboard>
      )}
    </group>
  );
}

export function useArticleIconState() {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  return {
    isVisible,
    setIsVisible,
    isExpanded,
    setIsExpanded,
  };
}
