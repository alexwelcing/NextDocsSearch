/**
 * Interactive3DArticleIcon - A playful floating 3D article icon
 *
 * An animated, interactive 3D object that replaces the static overlay icon.
 * Features physics-based movement, particle trails, and engaging interactions.
 */

import React, { useRef, useState, useMemo, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Interactive3DArticleIconProps {
  /** Initial position in 3D space */
  position?: [number, number, number];
  /** Scale of the icon */
  scale?: number;
  /** Label text to display on hover */
  label?: string;
  /** Callback when clicked */
  onClick?: () => void;
  /** Enable autonomous floating movement */
  autoFloat?: boolean;
  /** Movement bounds radius */
  boundRadius?: number;
  /** Color theme */
  color?: string;
  /** Accent/glow color */
  glowColor?: string;
}

// Particle system for magical trail effect
interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
}

export default function Interactive3DArticleIcon({
  position = [3, 2, -2],
  scale = 1,
  label = 'Articles',
  onClick,
  autoFloat = true,
  boundRadius = 4,
  color = '#ffd700',
  glowColor = '#00d4ff',
}: Interactive3DArticleIconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bookRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const pagesRef = useRef<THREE.Mesh[]>([]);
  const particlesRef = useRef<THREE.Points>(null);

  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Animation state
  const animState = useRef({
    time: Math.random() * Math.PI * 2,
    floatPhase: Math.random() * Math.PI * 2,
    rotationSpeed: 0.3,
    targetPosition: new THREE.Vector3(...position),
    currentPosition: new THREE.Vector3(...position),
    velocity: new THREE.Vector3(),
    wobbleIntensity: 0,
    pageFlipTime: 0,
    lastPosition: new THREE.Vector3(...position),
  });

  // Particle system state
  const particles = useRef<Particle[]>([]);
  const maxParticles = 50;

  // Create particle geometry
  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxParticles * 3);
    const sizes = new Float32Array(maxParticles);
    const opacities = new Float32Array(maxParticles);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));

    return geometry;
  }, []);

  // Particle material with custom shader
  const particleMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(glowColor) },
        uTime: { value: 0 },
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;

        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        varying float vOpacity;

        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float alpha = smoothstep(0.5, 0.0, dist) * vOpacity;
          vec3 color = uColor * (1.0 + 0.3 * sin(uTime * 3.0));
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [glowColor]);

  // Book geometry - stylized open book shape
  const bookGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    // Book cover outline
    shape.moveTo(-0.5, -0.35);
    shape.lineTo(-0.5, 0.35);
    shape.lineTo(0, 0.4);
    shape.lineTo(0.5, 0.35);
    shape.lineTo(0.5, -0.35);
    shape.lineTo(0, -0.4);
    shape.lineTo(-0.5, -0.35);

    const extrudeSettings = {
      steps: 1,
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  // Spawn particle at position
  const spawnParticle = useCallback((pos: THREE.Vector3) => {
    if (particles.current.length >= maxParticles) {
      particles.current.shift();
    }

    particles.current.push({
      position: pos.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        Math.random() * 0.02 + 0.01,
        (Math.random() - 0.5) * 0.02
      ),
      life: 1.0,
      maxLife: 1.0 + Math.random() * 0.5,
      size: 0.1 + Math.random() * 0.1,
    });
  }, []);

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const anim = animState.current;
    anim.time += delta;

    // Calculate new target position for floating movement
    if (autoFloat) {
      const floatSpeed = 0.15;
      const floatX = Math.sin(anim.time * floatSpeed) * boundRadius * 0.3;
      const floatY = Math.sin(anim.time * floatSpeed * 0.7 + 1.2) * 1.5 + position[1];
      const floatZ = Math.cos(anim.time * floatSpeed * 0.5) * boundRadius * 0.3 + position[2];

      anim.targetPosition.set(floatX + position[0], floatY, floatZ);
    }

    // Smooth interpolation to target
    const lerpFactor = hovered ? 0.02 : 0.05;
    anim.currentPosition.lerp(anim.targetPosition, lerpFactor);

    // Store velocity for trail
    anim.velocity.subVectors(anim.currentPosition, anim.lastPosition);
    anim.lastPosition.copy(anim.currentPosition);

    // Apply position
    groupRef.current.position.copy(anim.currentPosition);

    // Rotation animation
    const targetRotSpeed = hovered ? 1.5 : 0.3;
    anim.rotationSpeed += (targetRotSpeed - anim.rotationSpeed) * delta * 2;

    if (bookRef.current) {
      bookRef.current.rotation.y += delta * anim.rotationSpeed;

      // Wobble on hover
      if (hovered) {
        anim.wobbleIntensity = Math.min(anim.wobbleIntensity + delta * 3, 1);
      } else {
        anim.wobbleIntensity = Math.max(anim.wobbleIntensity - delta * 2, 0);
      }

      bookRef.current.rotation.x = Math.sin(anim.time * 2) * 0.1 * anim.wobbleIntensity;
      bookRef.current.rotation.z = Math.cos(anim.time * 2.5) * 0.08 * anim.wobbleIntensity;
    }

    // Glow pulsing
    if (glowRef.current) {
      const glowMat = glowRef.current.material as THREE.MeshBasicMaterial;
      const baseOpacity = hovered ? 0.6 : 0.3;
      const pulse = Math.sin(anim.time * 3) * 0.15;
      glowMat.opacity = baseOpacity + pulse;

      // Scale glow on hover
      const targetGlowScale = hovered ? 1.8 : 1.4;
      glowRef.current.scale.lerp(
        new THREE.Vector3(targetGlowScale, targetGlowScale, targetGlowScale),
        delta * 5
      );
    }

    // Page flip animation
    anim.pageFlipTime += delta * (hovered ? 4 : 1);
    pagesRef.current.forEach((page, i) => {
      if (page) {
        const offset = i * 0.3;
        page.rotation.y = Math.sin(anim.pageFlipTime + offset) * 0.15;
      }
    });

    // Spawn particles based on movement
    if (anim.velocity.length() > 0.001 || hovered) {
      const spawnChance = hovered ? 0.4 : 0.15;
      if (Math.random() < spawnChance) {
        spawnParticle(anim.currentPosition);
      }
    }

    // Update particles
    const positions = particleGeometry.attributes.position.array as Float32Array;
    const sizes = particleGeometry.attributes.size.array as Float32Array;
    const opacities = particleGeometry.attributes.opacity.array as Float32Array;

    particles.current.forEach((p, i) => {
      p.life -= delta * 0.8;
      p.position.add(p.velocity);
      p.velocity.y += delta * 0.01; // Slight upward drift

      positions[i * 3] = p.position.x;
      positions[i * 3 + 1] = p.position.y;
      positions[i * 3 + 2] = p.position.z;
      sizes[i] = p.size * (p.life / p.maxLife);
      opacities[i] = Math.max(0, p.life / p.maxLife);
    });

    // Clean dead particles
    particles.current = particles.current.filter((p) => p.life > 0);

    // Fill remaining slots with zeros
    for (let i = particles.current.length; i < maxParticles; i++) {
      sizes[i] = 0;
      opacities[i] = 0;
    }

    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.size.needsUpdate = true;
    particleGeometry.attributes.opacity.needsUpdate = true;

    // Update particle shader time
    particleMaterial.uniforms.uTime.value = anim.time;

    // Click animation cooldown
    if (clicked) {
      setTimeout(() => setClicked(false), 300);
    }
  });

  // Interaction handlers
  const handlePointerEnter = () => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerLeave = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleClick = () => {
    setClicked(true);
    // Spawn burst of particles
    const pos = animState.current.currentPosition;
    for (let i = 0; i < 15; i++) {
      spawnParticle(pos);
    }
    onClick?.();
  };

  return (
    <group ref={groupRef}>
      {/* Outer glow sphere */}
      <mesh ref={glowRef} scale={1.4}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Main book icon */}
      <mesh
        ref={bookRef}
        scale={scale}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        geometry={bookGeometry}
      >
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.5 : 0.2}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {/* Animated page layers */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) pagesRef.current[i] = el;
          }}
          position={[0, 0, 0.07 - i * 0.015]}
          scale={[scale * 0.85, scale * 0.75, 1]}
        >
          <planeGeometry args={[0.8, 0.6]} />
          <meshStandardMaterial
            color="#f8f4e8"
            side={THREE.DoubleSide}
            transparent
            opacity={0.9 - i * 0.2}
          />
        </mesh>
      ))}

      {/* Floating text lines on pages */}
      <group position={[0, 0, 0.08]} scale={scale}>
        {[0.15, 0.05, -0.05, -0.15].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <planeGeometry args={[0.5 - i * 0.05, 0.02]} />
            <meshBasicMaterial color="#333" opacity={0.4} transparent />
          </mesh>
        ))}
      </group>

      {/* Particle trail system */}
      <points ref={particlesRef} geometry={particleGeometry} material={particleMaterial} />

      {/* Label on hover */}
      {hovered && (
        <Billboard
          follow
          lockX={false}
          lockY={false}
          lockZ={false}
          position={[0, 0.8 * scale, 0]}
        >
          <Text
            fontSize={0.18}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.015}
            outlineColor="#000000"
          >
            {label}
          </Text>
          <Text
            fontSize={0.1}
            color="rgba(0, 212, 255, 0.9)"
            anchorX="center"
            anchorY="top"
            position={[0, -0.05, 0]}
          >
            Click to explore
          </Text>
        </Billboard>
      )}

      {/* Orbiting accent dots */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * 0.7 * scale,
              Math.sin(animState.current.time * 2 + i) * 0.1,
              Math.sin(angle) * 0.7 * scale,
            ]}
          >
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial
              color={i === 0 ? '#ff6b6b' : i === 1 ? '#4ecdc4' : '#ffd93d'}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Hook to get article icon state for external UI
 */
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
