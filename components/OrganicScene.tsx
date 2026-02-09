'use client'

import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

// Floating seed/spore particles
function FloatingParticles({ count = 50 }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10 - 5,
      ],
      scale: 0.02 + Math.random() * 0.04,
      speed: 0.1 + Math.random() * 0.3,
      offset: Math.random() * Math.PI * 2,
    }))
  }, [count])

  useFrame((state) => {
    if (!mesh.current) return
    const time = state.clock.elapsedTime

    particles.forEach((particle, i) => {
      const { position, scale, speed, offset } = particle

      dummy.position.set(
        position[0] + Math.sin(time * speed + offset) * 0.5,
        position[1] + Math.cos(time * speed * 0.7 + offset) * 0.3,
        position[2] + Math.sin(time * speed * 0.5 + offset) * 0.2
      )
      dummy.scale.setScalar(scale * (1 + Math.sin(time * 2 + offset) * 0.2))
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color="#F5D547"
        emissive="#F5D547"
        emissiveIntensity={0.3}
        transparent
        opacity={0.6}
      />
    </instancedMesh>
  )
}

// Organic blob shape
function OrganicBlob({ position, color, size = 1, speed = 1 }: {
  position: [number, number, number]
  color: string
  size?: number
  speed?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1 * speed
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15 * speed
    }
  })

  return (
    <Float speed={speed} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={meshRef} position={position} scale={size}>
        <icosahedronGeometry args={[1, 4]} />
        <MeshDistortMaterial
          color={color}
          speed={2}
          distort={0.4}
          radius={1}
          transparent
          opacity={0.7}
        />
      </mesh>
    </Float>
  )
}

// Leaf-like floating elements
function FloatingLeaf({ position, rotation }: {
  position: [number, number, number]
  rotation: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.z = rotation + Math.sin(state.clock.elapsedTime * 0.5) * 0.2
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.3 + rotation) * 0.3
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[0.3, 0.5]} />
      <meshStandardMaterial
        color="#6B8E23"
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Sun rays effect
function SunRays() {
  const raysRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (raysRef.current) {
      raysRef.current.rotation.z = state.clock.elapsedTime * 0.05
    }
  })

  return (
    <mesh ref={raysRef} position={[5, 4, -10]}>
      <circleGeometry args={[3, 32]} />
      <meshBasicMaterial
        color="#FFE066"
        transparent
        opacity={0.15}
      />
    </mesh>
  )
}

// Main scene content
function SceneContent() {
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 5, 5]}
        intensity={0.8}
        color="#FFE066"
      />
      <pointLight
        position={[-5, 3, -5]}
        intensity={0.5}
        color="#4A7C59"
      />

      {/* Background gradient sphere */}
      <mesh position={[0, 0, -15]} scale={30}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#FFFEFB" side={THREE.BackSide} />
      </mesh>

      {/* Sun rays */}
      <SunRays />

      {/* Organic blobs */}
      <OrganicBlob position={[-3, 1, -3]} color="#F5D547" size={0.8} speed={0.5} />
      <OrganicBlob position={[4, -1, -5]} color="#4A7C59" size={0.6} speed={0.7} />
      <OrganicBlob position={[0, 2, -4]} color="#6B8E23" size={0.5} speed={0.6} />
      <OrganicBlob position={[-2, -2, -6]} color="#FFE066" size={0.4} speed={0.8} />
      <OrganicBlob position={[3, 2, -7]} color="#355E3B" size={0.7} speed={0.4} />

      {/* Floating particles */}
      <FloatingParticles count={40} />

      {/* Floating leaves */}
      {[...Array(8)].map((_, i) => (
        <FloatingLeaf
          key={i}
          position={[
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 6,
            -3 - Math.random() * 5,
          ]}
          rotation={Math.random() * Math.PI}
        />
      ))}

      {/* Environment for reflections */}
      <Environment preset="forest" />
    </>
  )
}

// Loading fallback
function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#F5D547" wireframe />
    </mesh>
  )
}

// Main exported component
export default function OrganicScene({ className = '' }: { className?: string }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={<Loader />}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  )
}
