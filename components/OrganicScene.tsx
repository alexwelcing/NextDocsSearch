import { useRef, useMemo, useState, useEffect, Component, ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Error Boundary to catch Three.js crashes
interface ErrorBoundaryState {
  hasError: boolean
}

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// Check if WebGL is available
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

// Simple floating particles
function Particles({ count = 30 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8 - 3,
      ] as [number, number, number],
      scale: 0.03 + Math.random() * 0.05,
      speed: 0.2 + Math.random() * 0.3,
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
        position[1] + Math.cos(time * speed * 0.7 + offset) * 0.4,
        position[2]
      )
      dummy.scale.setScalar(scale * (1 + Math.sin(time * 2 + offset) * 0.15))
      dummy.updateMatrix()
      mesh.current!.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#F5D547" transparent opacity={0.6} />
    </instancedMesh>
  )
}

// Soft glowing orb
function GlowOrb({ position, color, size = 1 }: {
  position: [number, number, number]
  color: string
  size?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(size * (1 + Math.sin(state.clock.elapsedTime * 0.5) * 0.1))
    }
  })

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
  )
}

// Main scene content - kept simple
function SceneContent() {
  return (
    <>
      <color attach="background" args={['#FFFEFB']} />

      {/* Soft ambient light */}
      <ambientLight intensity={0.6} />

      {/* Floating particles */}
      <Particles count={25} />

      {/* Soft glowing orbs */}
      <GlowOrb position={[-4, 1, -5]} color="#F5D547" size={1.5} />
      <GlowOrb position={[3, -1, -6]} color="#4A7C59" size={1.2} />
      <GlowOrb position={[0, 2, -4]} color="#6B8E23" size={0.8} />
      <GlowOrb position={[-2, -1.5, -7]} color="#FFE066" size={1} />
      <GlowOrb position={[4, 1.5, -8]} color="#4A7C59" size={1.3} />
    </>
  )
}

// Fallback component when 3D isn't available
function StaticFallback() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-sun-100 via-parchment-50 to-flora-50">
      <div className="absolute top-20 right-10 w-64 h-64 bg-sun-300/30 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-10 left-10 w-48 h-48 bg-flora-300/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-sun-200/40 rounded-full blur-2xl" />
    </div>
  )
}

// Main exported component
export default function OrganicScene({ className = '' }: { className?: string }) {
  const [canRender, setCanRender] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCanRender(isWebGLAvailable())
  }, [])

  // Server-side or before mount: show nothing (will be replaced client-side)
  if (!mounted) {
    return <StaticFallback />
  }

  // No WebGL: show static fallback
  if (!canRender) {
    return <StaticFallback />
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <SceneErrorBoundary fallback={<StaticFallback />}>
        <Canvas
          camera={{ position: [0, 0, 6], fov: 50 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'default',
            failIfMajorPerformanceCaveat: true
          }}
          style={{ background: 'transparent' }}
        >
          <SceneContent />
        </Canvas>
      </SceneErrorBoundary>
    </div>
  )
}
