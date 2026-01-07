/**
 * AmbientR3FBackground - Subtle animated R3F background for 2D pages
 *
 * A performance-optimized background using:
 * - Instanced meshes for particles (minimal draw calls)
 * - Adaptive quality based on device capabilities
 * - Smooth animations via useFrame
 * - Proper resource disposal
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Configuration
const PARTICLE_COUNT_HIGH = 200;
const PARTICLE_COUNT_LOW = 80;

interface ParticleFieldProps {
  count: number;
  color?: string;
  secondaryColor?: string;
}

/**
 * Instanced particle field with orbital motion
 */
function ParticleField({ count, color = '#00d4ff', secondaryColor = '#ffd700' }: ParticleFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const { size } = useThree();

  // Pre-compute particle data
  const particleData = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      // Distribute in a sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 8 + Math.random() * 12;

      data.push({
        position: new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi)
        ),
        scale: 0.02 + Math.random() * 0.04,
        speed: 0.1 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
        orbitRadius: radius,
        orbitAxis: new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).normalize(),
      });
    }
    return data;
  }, [count]);

  // Create instanced colors
  const colorArray = useMemo(() => {
    const colors = new Float32Array(count * 3);
    const primaryColor = new THREE.Color(color);
    const secondary = new THREE.Color(secondaryColor);

    for (let i = 0; i < count; i++) {
      const mixFactor = Math.random();
      const finalColor = primaryColor.clone().lerp(secondary, mixFactor * 0.3);
      colors[i * 3] = finalColor.r;
      colors[i * 3 + 1] = finalColor.g;
      colors[i * 3 + 2] = finalColor.b;
    }
    return colors;
  }, [count, color, secondaryColor]);

  // Animate particles
  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime * 0.2;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const particle = particleData[i];

      // Orbital motion
      const angle = time * particle.speed + particle.offset;
      position.copy(particle.position);

      // Rotate around orbit axis
      const rotationMatrix = new THREE.Matrix4().makeRotationAxis(particle.orbitAxis, angle);
      position.applyMatrix4(rotationMatrix);

      // Subtle breathing scale
      const breathScale = particle.scale * (1 + Math.sin(time * 2 + particle.offset) * 0.2);
      scale.set(breathScale, breathScale, breathScale);

      matrix.compose(position, quaternion, scale);
      meshRef.current.setMatrixAt(i, matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial transparent opacity={0.6} toneMapped={false}>
        <instancedBufferAttribute
          attach="attributes-color"
          args={[colorArray, 3]}
        />
      </meshBasicMaterial>
    </instancedMesh>
  );
}

/**
 * Glowing center orb with pulse animation
 */
function CentralOrb() {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (meshRef.current) {
      meshRef.current.rotation.y = time * 0.1;
      meshRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
    }

    if (glowRef.current) {
      const pulse = 1 + Math.sin(time * 0.8) * 0.15;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[0, 0, -15]}>
      {/* Core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshBasicMaterial
          color="#00d4ff"
          transparent
          opacity={0.3}
          wireframe
        />
      </mesh>

      {/* Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.5, 32, 16]} />
        <meshBasicMaterial
          color="#00d4ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Floating grid lines for depth
 */
function GridLines() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.02;
    }
  });

  return (
    <group ref={groupRef} position={[0, -5, -10]}>
      <gridHelper
        args={[40, 20, '#1a1a2e', '#1a1a2e']}
        rotation={[0, 0, 0]}
      />
    </group>
  );
}

/**
 * Scene content wrapper
 */
function SceneContent({ isMobile }: { isMobile: boolean }) {
  const particleCount = isMobile ? PARTICLE_COUNT_LOW : PARTICLE_COUNT_HIGH;

  return (
    <>
      {/* Ambient light for subtle illumination */}
      <ambientLight intensity={0.2} />

      {/* Particle field */}
      <ParticleField count={particleCount} />

      {/* Central orb - desktop only */}
      {!isMobile && <CentralOrb />}

      {/* Grid lines - desktop only */}
      {!isMobile && <GridLines />}
    </>
  );
}

interface AmbientR3FBackgroundProps {
  className?: string;
}

/**
 * Main background component - can be used on any 2D page
 */
export default function AmbientR3FBackground({ className }: AmbientR3FBackgroundProps) {
  const [isMobile, setIsMobile] = React.useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          )
      );
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <Canvas
        dpr={isMobile ? [0.5, 1] : [0.75, 1.5]}
        camera={{ position: [0, 0, 10], fov: 60 }}
        gl={{
          powerPreference: 'high-performance',
          antialias: false,
          stencil: false,
          depth: false,
          alpha: true,
        }}
        style={{ background: 'transparent' }}
      >
        <color attach="background" args={['#0a0a14']} />
        <fog attach="fog" args={['#0a0a14', 15, 35]} />
        <SceneContent isMobile={isMobile} />
      </Canvas>
    </div>
  );
}
