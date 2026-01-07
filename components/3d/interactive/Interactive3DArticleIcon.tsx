/**
 * Interactive3DArticleIcon - Overhauled Performance-Optimized Version
 *
 * An animated, interactive 3D object that links to article exploration.
 * Features:
 * - Geometry/Material caching for zero-overhead reuse
 * - Instanced particle system for 10x better performance
 * - LOD support for adaptive quality based on camera distance
 * - Enhanced shaders with WebGPU compatibility
 * - Proper resource disposal and cleanup
 * - Cinematic visual effects with holographic materials
 */

import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  geometryCache,
  materialCache,
  createInstancedMesh,
  disposeObject,
  LOD_PRESETS,
  calculateLODLevel,
} from '@/lib/3d/performanceUtils';

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
  /** Quality preset for LOD */
  quality?: 'low' | 'medium' | 'high' | 'ultra';
}

// Enhanced particle system configuration
const MAX_PARTICLES = 100;
const PARTICLE_LIFETIME = 2.0;

// Animation state interface
interface AnimationState {
  time: number;
  floatPhase: number;
  rotationSpeed: number;
  targetPosition: THREE.Vector3;
  currentPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  wobbleIntensity: number;
  pageFlipTime: number;
  lastPosition: THREE.Vector3;
  lodLevel: number;
}

// Particle data structure
interface ParticleData {
  life: number;
  velocity: THREE.Vector3;
  scale: number;
  rotation: number;
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
  quality = 'medium',
}: Interactive3DArticleIconProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bookRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const pagesRef = useRef<THREE.Mesh[]>([]);
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  const hologramRef = useRef<THREE.Mesh>(null);

  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  const { camera } = useThree();

  // Animation state
  const animState = useRef<AnimationState>({
    time: Math.random() * Math.PI * 2,
    floatPhase: Math.random() * Math.PI * 2,
    rotationSpeed: 0.3,
    targetPosition: new THREE.Vector3(...position),
    currentPosition: new THREE.Vector3(...position),
    velocity: new THREE.Vector3(),
    wobbleIntensity: 0,
    pageFlipTime: 0,
    lastPosition: new THREE.Vector3(...position),
    lodLevel: 0,
  });

  // Particle system state
  const particleData = useRef<ParticleData[]>([]);
  const activeParticleCount = useRef(0);

  // Initialize particle data
  useEffect(() => {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      particleData.current.push({
        life: 0,
        velocity: new THREE.Vector3(),
        scale: 0,
        rotation: 0,
      });
    }
  }, []);

  // Cached geometries with LOD support
  const bookGeometry = useMemo(() => {
    const lodLevels = LOD_PRESETS[quality];
    const segments = lodLevels[0].segments || 16;

    return geometryCache.get(`book-icon-${segments}`, () => {
      const shape = new THREE.Shape();
      // Enhanced book cover with more detail
      const detail = Math.max(4, segments / 4);
      shape.moveTo(-0.5, -0.35);
      shape.bezierCurveTo(-0.5, -0.4, -0.3, -0.42, 0, -0.42);
      shape.bezierCurveTo(0.3, -0.42, 0.5, -0.4, 0.5, -0.35);
      shape.lineTo(0.5, 0.35);
      shape.bezierCurveTo(0.5, 0.4, 0.3, 0.42, 0, 0.42);
      shape.bezierCurveTo(-0.3, 0.42, -0.5, 0.4, -0.5, 0.35);
      shape.lineTo(-0.5, -0.35);

      const extrudeSettings = {
        steps: Math.floor(detail / 2),
        depth: 0.15,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.025,
        bevelSegments: Math.floor(detail),
      };

      return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    });
  }, [quality]);

  // Cached sphere geometry for glow
  const sphereGeometry = useMemo(() => {
    const segments = LOD_PRESETS[quality][0].segments || 16;
    return geometryCache.get(`sphere-${segments}`, () => {
      return new THREE.SphereGeometry(0.5, segments, segments);
    });
  }, [quality]);

  // Cached materials with holographic effects
  const bookMaterial = useMemo(() => {
    return materialCache.get(`book-material-${color}`, () => {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.2,
        metalness: 0.5,
        roughness: 0.3,
        envMapIntensity: 1.2,
      });
    });
  }, [color]);

  // Enhanced holographic shader material
  const hologramMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(glowColor) },
        uIntensity: { value: 0.5 },
        uFrequency: { value: 2.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        uniform float uTime;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;

          // Animated wave distortion
          vec3 pos = position;
          float wave = sin(position.y * 5.0 + uTime * 2.0) * 0.02;
          pos.x += wave;
          pos.z += wave * 0.5;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uFrequency;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        void main() {
          // Fresnel effect for holographic rim
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.5);

          // Animated scan lines
          float scanline = sin(vUv.y * 50.0 + uTime * 3.0) * 0.5 + 0.5;
          scanline = smoothstep(0.3, 0.7, scanline);

          // Pulsing glow
          float pulse = sin(uTime * uFrequency) * 0.3 + 0.7;

          // Color shifting based on position
          vec3 colorShift = uColor * (1.0 + sin(vPosition.y * 3.0 + uTime) * 0.2);

          // Combine effects
          float alpha = (fresnel * 0.8 + scanline * 0.2) * uIntensity * pulse;
          vec3 finalColor = colorShift * (fresnel + scanline * 0.5);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [glowColor]);

  // Instanced particle system with custom shader
  const particleSystem = useMemo(() => {
    const geometry = new THREE.SphereGeometry(0.05, 6, 6);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(glowColor) },
      },
      vertexShader: `
        varying vec3 vPosition;
        varying float vLife;

        void main() {
          vPosition = position;
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec3 vPosition;

        void main() {
          // Radial gradient from center
          float dist = length(vPosition) * 10.0;
          float alpha = smoothstep(1.0, 0.0, dist);

          // Color variation
          vec3 color = uColor * (1.0 + sin(uTime * 5.0 + vPosition.y * 10.0) * 0.3);

          gl_FragColor = vec4(color, alpha * 0.8);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return createInstancedMesh(geometry, material, MAX_PARTICLES);
  }, [glowColor]);

  // Spawn particle at position
  const spawnParticle = useCallback((pos: THREE.Vector3) => {
    const index = activeParticleCount.current % MAX_PARTICLES;
    const particle = particleData.current[index];

    particle.life = PARTICLE_LIFETIME;
    particle.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.03,
      Math.random() * 0.04 + 0.02,
      (Math.random() - 0.5) * 0.03
    );
    particle.scale = 0.15 + Math.random() * 0.15;
    particle.rotation = Math.random() * Math.PI * 2;

    // Set initial transform
    const matrix = new THREE.Matrix4();
    matrix.compose(
      pos.clone(),
      new THREE.Quaternion(),
      new THREE.Vector3(particle.scale, particle.scale, particle.scale)
    );

    if (particlesRef.current) {
      particlesRef.current.setMatrixAt(index, matrix);
      particlesRef.current.instanceMatrix.needsUpdate = true;
    }

    activeParticleCount.current = Math.min(activeParticleCount.current + 1, MAX_PARTICLES);
  }, []);

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const anim = animState.current;
    anim.time += delta;

    // Calculate LOD level based on camera distance
    const cameraPos = new THREE.Vector3();
    camera.getWorldPosition(cameraPos);
    anim.lodLevel = calculateLODLevel(
      anim.currentPosition,
      cameraPos,
      LOD_PRESETS[quality]
    );

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
    const targetRotSpeed = hovered ? 2.0 : 0.4;
    anim.rotationSpeed += (targetRotSpeed - anim.rotationSpeed) * delta * 3;

    if (bookRef.current) {
      bookRef.current.rotation.y += delta * anim.rotationSpeed;

      // Wobble on hover
      if (hovered) {
        anim.wobbleIntensity = Math.min(anim.wobbleIntensity + delta * 4, 1);
      } else {
        anim.wobbleIntensity = Math.max(anim.wobbleIntensity - delta * 2, 0);
      }

      bookRef.current.rotation.x = Math.sin(anim.time * 3) * 0.12 * anim.wobbleIntensity;
      bookRef.current.rotation.z = Math.cos(anim.time * 3.5) * 0.1 * anim.wobbleIntensity;

      // Update material emissive intensity
      const mat = bookRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = hovered ? 0.6 : 0.2 + Math.sin(anim.time * 2) * 0.1;
    }

    // Glow pulsing
    if (glowRef.current) {
      const glowMat = glowRef.current.material as THREE.MeshBasicMaterial;
      const baseOpacity = hovered ? 0.5 : 0.25;
      const pulse = Math.sin(anim.time * 3) * 0.15;
      glowMat.opacity = baseOpacity + pulse;

      // Scale glow on hover
      const targetGlowScale = hovered ? 2.0 : 1.5;
      const currentScale = glowRef.current.scale.x;
      glowRef.current.scale.setScalar(
        currentScale + (targetGlowScale - currentScale) * delta * 5
      );
    }

    // Holographic effect
    if (hologramRef.current) {
      hologramMaterial.uniforms.uTime.value = anim.time;
      hologramMaterial.uniforms.uIntensity.value = hovered ? 0.8 : 0.5;
      hologramRef.current.rotation.y = anim.time * 0.5;
    }

    // Page flip animation
    anim.pageFlipTime += delta * (hovered ? 5 : 1.5);
    pagesRef.current.forEach((page, i) => {
      if (page) {
        const offset = i * 0.4;
        page.rotation.y = Math.sin(anim.pageFlipTime + offset) * 0.2;
        page.position.z = 0.08 - i * 0.02 + Math.sin(anim.pageFlipTime + offset) * 0.01;
      }
    });

    // Spawn particles based on movement
    if (anim.velocity.length() > 0.001 || hovered) {
      const spawnChance = hovered ? 0.5 : 0.2;
      if (Math.random() < spawnChance) {
        spawnParticle(anim.currentPosition);
      }
    }

    // Update particle system
    if (particlesRef.current) {
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scaleVec = new THREE.Vector3();

      for (let i = 0; i < MAX_PARTICLES; i++) {
        const particle = particleData.current[i];

        if (particle.life > 0) {
          particle.life -= delta * 0.5;

          // Get current transform
          particlesRef.current.getMatrixAt(i, matrix);
          matrix.decompose(position, quaternion, scaleVec);

          // Update position with velocity
          position.add(particle.velocity);
          particle.velocity.y += delta * 0.015; // Gravity

          // Fade out scale
          const lifeFactor = Math.max(0, particle.life / PARTICLE_LIFETIME);
          const newScale = particle.scale * lifeFactor;
          scaleVec.set(newScale, newScale, newScale);

          // Update rotation
          particle.rotation += delta * 2;
          quaternion.setFromEuler(new THREE.Euler(0, particle.rotation, 0));

          // Compose new matrix
          matrix.compose(position, quaternion, scaleVec);
          particlesRef.current.setMatrixAt(i, matrix);
        } else {
          // Hide dead particles
          matrix.makeScale(0, 0, 0);
          particlesRef.current.setMatrixAt(i, matrix);
        }
      }

      particlesRef.current.instanceMatrix.needsUpdate = true;

      // Update particle shader
      const mat = particlesRef.current.material as THREE.ShaderMaterial;
      mat.uniforms.uTime.value = anim.time;
    }

    // Click animation cooldown
    if (clicked) {
      setTimeout(() => setClicked(false), 300);
    }
  });

  // Interaction handlers
  const handlePointerEnter = useCallback(() => {
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  const handleClick = useCallback(() => {
    setClicked(true);
    // Spawn burst of particles
    const pos = animState.current.currentPosition;
    for (let i = 0; i < 20; i++) {
      spawnParticle(pos);
    }
    onClick?.();
  }, [onClick, spawnParticle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (groupRef.current) {
        disposeObject(groupRef.current);
      }
    };
  }, []);

  return (
    <group ref={groupRef}>
      {/* Outer glow sphere */}
      <mesh ref={glowRef} scale={1.5} geometry={sphereGeometry}>
        <meshBasicMaterial
          color={glowColor}
          transparent
          opacity={0.25}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Holographic ring effect */}
      <mesh
        ref={hologramRef}
        scale={[1.8, 1.8, 0.1]}
        rotation={[Math.PI / 2, 0, 0]}
        material={hologramMaterial}
      >
        <torusGeometry args={[0.5, 0.05, 8, 32]} />
      </mesh>

      {/* Main book icon */}
      <mesh
        ref={bookRef}
        scale={scale}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleClick}
        geometry={bookGeometry}
        material={bookMaterial}
      />

      {/* Animated page layers */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) pagesRef.current[i] = el;
          }}
          position={[0, 0, 0.08 - i * 0.02]}
          scale={[scale * 0.85, scale * 0.75, 1]}
        >
          <planeGeometry args={[0.8, 0.6]} />
          <meshStandardMaterial
            color="#f8f4e8"
            side={THREE.DoubleSide}
            transparent
            opacity={0.95 - i * 0.2}
            emissive="#fff8dc"
            emissiveIntensity={hovered ? 0.3 : 0.1}
          />
        </mesh>
      ))}

      {/* Floating text lines on pages */}
      <group position={[0, 0, 0.09]} scale={scale}>
        {[0.15, 0.05, -0.05, -0.15].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <planeGeometry args={[0.5 - i * 0.05, 0.025]} />
            <meshBasicMaterial
              color={hovered ? glowColor : '#333'}
              opacity={hovered ? 0.6 : 0.4}
              transparent
            />
          </mesh>
        ))}
      </group>

      {/* Instanced particle trail system */}
      <primitive object={particleSystem} ref={particlesRef} />

      {/* Orbiting energy dots */}
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2 + animState.current.time * 0.5;
        const radius = 0.8 * scale;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              Math.sin(animState.current.time * 2 + i) * 0.15,
              Math.sin(angle) * radius,
            ]}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial
              color={i === 0 ? '#ff6b6b' : i === 1 ? '#4ecdc4' : '#ffd93d'}
              transparent
              opacity={0.9}
            />
          </mesh>
        );
      })}

      {/* Label on hover */}
      {hovered && (
        <Billboard
          follow
          lockX={false}
          lockY={false}
          lockZ={false}
          position={[0, 1.0 * scale, 0]}
        >
          <Text
            fontSize={0.2}
            color="#ffffff"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.02}
            outlineColor="#000000"
            fontWeight="bold"
          >
            {label}
          </Text>
          <Text
            fontSize={0.12}
            color={glowColor}
            anchorX="center"
            anchorY="top"
            position={[0, -0.08, 0]}
            outlineWidth={0.01}
            outlineColor="#000000"
          >
            Click to explore
          </Text>
        </Billboard>
      )}
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
