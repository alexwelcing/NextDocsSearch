/**
 * Interactive3DArticleIcon - A magical AI-powered article discovery orb
 *
 * An ethereal floating crystal orb with a glowing AI eye at its center.
 * The eye tracks the viewer, blinks naturally, and invites exploration.
 * Features magical particle aura and smooth floating animations.
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Interactive3DArticleIconProps {
  position?: [number, number, number];
  scale?: number;
  label?: string;
  onClick?: () => void;
  autoFloat?: boolean;
  boundRadius?: number;
  primaryColor?: string;
  irisColor?: string;
}

export default function Interactive3DArticleIcon({
  position = [3, 2, -2],
  scale = 1,
  label = 'Explore Articles',
  onClick,
  autoFloat = true,
  boundRadius = 3,
  primaryColor = '#00d4ff',
  irisColor = '#00ffaa',
}: Interactive3DArticleIconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const eyeGroupRef = useRef<THREE.Group>(null);
  const irisRef = useRef<THREE.Mesh>(null);
  const pupilRef = useRef<THREE.Mesh>(null);
  const eyelidTopRef = useRef<THREE.Mesh>(null);
  const eyelidBottomRef = useRef<THREE.Mesh>(null);

  const [hovered, setHovered] = useState(false);

  // Animation state stored in ref for performance
  const anim = useRef({
    time: Math.random() * Math.PI * 2,
    targetPos: new THREE.Vector3(...position),
    currentPos: new THREE.Vector3(...position),
    eyeLookTarget: new THREE.Vector3(0, 0, 1),
    blinkTimer: 0,
    blinkPhase: 0, // 0 = open, 1 = closing, 2 = opening
    pupilDilation: 1,
    irisRotation: 0,
  });

  // Create particle system for magical aura around the orb
  const particleCount = 50;
  const particleData = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const phases = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 0.7 + Math.random() * 0.5; // Orbit just outside the orb

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      scales[i] = 0.015 + Math.random() * 0.025;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    return { geometry, positions, scales, phases };
  }, []);

  // Particle shader material - soft glowing motes
  const particleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(primaryColor) },
        uHovered: { value: 0 },
      },
      vertexShader: `
        attribute float scale;
        attribute float phase;
        uniform float uTime;
        uniform float uHovered;
        varying float vAlpha;

        void main() {
          float orbit = uTime * 0.3 + phase;
          vec3 pos = position;

          // Gentle spiral orbit
          float c = cos(orbit);
          float s = sin(orbit);
          pos.xz = mat2(c, -s, s, c) * pos.xz;

          // Vertical drift
          pos.y += sin(uTime * 0.5 + phase * 2.0) * 0.15;

          // Expand outward when hovered
          float expand = 1.0 + uHovered * 0.4;
          pos *= expand;

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = scale * (150.0 + uHovered * 80.0) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;

          vAlpha = 0.4 + sin(uTime * 2.0 + phase) * 0.2;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;

          float glow = smoothstep(0.5, 0.0, d);
          float core = smoothstep(0.3, 0.0, d) * 0.5;
          gl_FragColor = vec4(uColor, (glow + core) * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [primaryColor]);

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const a = anim.current;
    a.time += delta;

    // Gentle floating movement
    if (autoFloat) {
      const floatSpeed = 0.25;
      const floatX = Math.sin(a.time * floatSpeed) * boundRadius * 0.12;
      const floatY = Math.sin(a.time * floatSpeed * 0.8) * 0.4 + position[1];
      const floatZ = Math.cos(a.time * floatSpeed * 0.6) * boundRadius * 0.12 + position[2];
      a.targetPos.set(floatX + position[0], floatY, floatZ);
    }

    // Smooth movement with slight lag
    a.currentPos.lerp(a.targetPos, delta * 2.5);
    groupRef.current.position.copy(a.currentPos);

    // Crystal orb subtle pulsing
    if (crystalRef.current) {
      const mat = crystalRef.current.material as THREE.MeshPhysicalMaterial;
      const pulse = Math.sin(a.time * 1.5) * 0.1;
      mat.emissiveIntensity = hovered ? 0.4 : 0.15 + pulse * 0.05;

      // Very subtle rotation
      crystalRef.current.rotation.y = a.time * 0.1;
    }

    // AI Eye - the star of the show
    if (eyeGroupRef.current) {
      // Eye follows camera with personality (slight delay)
      const cameraDir = state.camera.position.clone().sub(a.currentPos).normalize();
      a.eyeLookTarget.lerp(cameraDir, delta * 3);

      // Limit eye movement range
      const maxLook = 0.08 * scale;
      const lookX = Math.max(-maxLook, Math.min(maxLook, a.eyeLookTarget.x * 0.12));
      const lookY = Math.max(-maxLook, Math.min(maxLook, a.eyeLookTarget.y * 0.12));

      // Move iris and pupil to follow gaze
      if (irisRef.current) {
        irisRef.current.position.x = lookX;
        irisRef.current.position.y = lookY;
        // Subtle iris rotation for visual interest
        a.irisRotation += delta * 0.3;
        irisRef.current.rotation.z = a.irisRotation;
      }
      if (pupilRef.current) {
        pupilRef.current.position.x = lookX * 1.2;
        pupilRef.current.position.y = lookY * 1.2;
      }

      // Natural blinking behavior
      a.blinkTimer += delta;
      const blinkInterval = hovered ? 2.5 : 4; // Blink more when curious (hovered)

      if (a.blinkPhase === 0 && a.blinkTimer > blinkInterval + Math.random() * 1.5) {
        a.blinkPhase = 1; // Start closing
        a.blinkTimer = 0;
      }

      // Animate eyelids
      const blinkSpeed = 12;
      if (eyelidTopRef.current && eyelidBottomRef.current) {
        if (a.blinkPhase === 1) {
          // Closing
          const closeAmount = Math.min(1, a.blinkTimer * blinkSpeed);
          eyelidTopRef.current.scale.y = closeAmount;
          eyelidBottomRef.current.scale.y = closeAmount;
          if (closeAmount >= 1) {
            a.blinkPhase = 2; // Start opening
            a.blinkTimer = 0;
          }
        } else if (a.blinkPhase === 2) {
          // Opening
          const openAmount = Math.max(0, 1 - a.blinkTimer * blinkSpeed);
          eyelidTopRef.current.scale.y = openAmount;
          eyelidBottomRef.current.scale.y = openAmount;
          if (openAmount <= 0) {
            a.blinkPhase = 0; // Done blinking
            a.blinkTimer = 0;
          }
        } else {
          // Keep open
          eyelidTopRef.current.scale.y = 0;
          eyelidBottomRef.current.scale.y = 0;
        }
      }

      // Pupil dilation - dilates when curious/hovered
      const targetDilation = hovered ? 1.4 : 1;
      a.pupilDilation += (targetDilation - a.pupilDilation) * delta * 4;
      if (pupilRef.current) {
        pupilRef.current.scale.setScalar(a.pupilDilation);
      }
    }

    // Update particle shader uniforms
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

  // Size constants
  const orbRadius = 0.45 * scale;
  const eyeRadius = 0.28 * scale;

  return (
    <group ref={groupRef}>
      {/* Outer ethereal glow - largest layer */}
      <mesh scale={hovered ? 1.4 : 1.2}>
        <sphereGeometry args={[orbRadius, 32, 32]} />
        <meshBasicMaterial
          color={primaryColor}
          transparent
          opacity={hovered ? 0.15 : 0.08}
          depthWrite={false}
        />
      </mesh>

      {/* Crystal orb shell - transparent with refraction feel */}
      <mesh
        ref={crystalRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
      >
        <sphereGeometry args={[orbRadius, 64, 64]} />
        <meshPhysicalMaterial
          color="#a0d8ef"
          emissive={primaryColor}
          emissiveIntensity={0.15}
          metalness={0.1}
          roughness={0.05}
          transparent
          opacity={0.35}
          transmission={0.6}
          thickness={0.5}
          envMapIntensity={1}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* Inner dark core behind the eye */}
      <mesh>
        <sphereGeometry args={[orbRadius * 0.7, 32, 32]} />
        <meshStandardMaterial
          color="#050a15"
          emissive="#0a1525"
          emissiveIntensity={0.3}
          metalness={0.9}
          roughness={0.3}
        />
      </mesh>

      {/* ========== THE AI EYE - Front facing ========== */}
      <group ref={eyeGroupRef} position={[0, 0, orbRadius * 0.85]}>
        {/* Eye socket / dark background */}
        <mesh position={[0, 0, -0.01]}>
          <circleGeometry args={[eyeRadius * 1.15, 48]} />
          <meshBasicMaterial color="#020408" />
        </mesh>

        {/* Sclera (eye white) with subtle gradient feel */}
        <mesh>
          <circleGeometry args={[eyeRadius, 48]} />
          <meshStandardMaterial
            color="#e8f0f5"
            emissive="#d0e8f0"
            emissiveIntensity={0.1}
            metalness={0}
            roughness={0.4}
          />
        </mesh>

        {/* Iris - the colorful ring */}
        <mesh ref={irisRef} position={[0, 0, 0.005]}>
          <ringGeometry args={[eyeRadius * 0.25, eyeRadius * 0.65, 48]} />
          <meshStandardMaterial
            color={irisColor}
            emissive={irisColor}
            emissiveIntensity={hovered ? 0.6 : 0.3}
            metalness={0.3}
            roughness={0.2}
          />
        </mesh>

        {/* Iris inner detail ring */}
        <mesh position={[0, 0, 0.006]}>
          <ringGeometry args={[eyeRadius * 0.22, eyeRadius * 0.28, 48]} />
          <meshBasicMaterial
            color={primaryColor}
            transparent
            opacity={0.7}
          />
        </mesh>

        {/* Pupil - deep black center */}
        <mesh ref={pupilRef} position={[0, 0, 0.008]}>
          <circleGeometry args={[eyeRadius * 0.22, 32]} />
          <meshBasicMaterial color="#000000" />
        </mesh>

        {/* Pupil depth - slightly smaller, even darker */}
        <mesh position={[0, 0, 0.009]}>
          <circleGeometry args={[eyeRadius * 0.15, 32]} />
          <meshBasicMaterial color="#000005" />
        </mesh>

        {/* Primary catchlight - top right */}
        <mesh position={[eyeRadius * 0.2, eyeRadius * 0.25, 0.012]}>
          <circleGeometry args={[eyeRadius * 0.12, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.95} />
        </mesh>

        {/* Secondary catchlight - bottom left, smaller */}
        <mesh position={[-eyeRadius * 0.15, -eyeRadius * 0.2, 0.011]}>
          <circleGeometry args={[eyeRadius * 0.05, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>

        {/* Top eyelid - descends when blinking */}
        <mesh
          ref={eyelidTopRef}
          position={[0, eyeRadius * 0.5, 0.015]}
          scale={[1, 0, 1]}
        >
          <planeGeometry args={[eyeRadius * 2.5, eyeRadius * 1.2]} />
          <meshBasicMaterial color="#050a15" side={THREE.DoubleSide} />
        </mesh>

        {/* Bottom eyelid - rises when blinking */}
        <mesh
          ref={eyelidBottomRef}
          position={[0, -eyeRadius * 0.5, 0.015]}
          scale={[1, 0, 1]}
        >
          <planeGeometry args={[eyeRadius * 2.5, eyeRadius * 1.2]} />
          <meshBasicMaterial color="#050a15" side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Subtle accent ring around the orb */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[orbRadius * 1.05, 0.008 * scale, 8, 64]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={primaryColor}
          emissiveIntensity={hovered ? 0.5 : 0.2}
          metalness={0.8}
          roughness={0.2}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Orbiting magical particles */}
      <points geometry={particleData.geometry} material={particleMaterial} />

      {/* Label on hover */}
      {hovered && (
        <Billboard position={[0, orbRadius * 1.8, 0]}>
          <Text
            fontSize={0.14 * scale}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {label}
          </Text>
          <Text
            fontSize={0.08 * scale}
            color={primaryColor}
            anchorX="center"
            anchorY="top"
            position={[0, -0.03, 0]}
          >
            Click to explore
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
