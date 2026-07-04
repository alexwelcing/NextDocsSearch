// The ARC Terminal's physical body: main slab, screen bezel, brand plate, status LEDs, grip
// ridges, and a stubby antenna. Lit by the scene so it reads as an object, not a HUD.

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { WindfoilText } from '../text/WindfoilText'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'
import { SCREEN_H, SCREEN_W } from './CrtScreen'

export const BODY_W = SCREEN_W + 0.12
export const BODY_H = SCREEN_H + 0.19

export function DockChassis({ activity }: { activity: boolean }) {
  const led = useRef<THREE.MeshStandardMaterial>(null)
  const blink = useRef(0)

  const gripGeo = useMemo(() => new THREE.BoxGeometry(0.012, BODY_H * 0.7, 0.02), [])

  useFrame((state) => {
    if (!led.current) return
    blink.current = activity ? (Math.sin(state.clock.elapsedTime * 14) > 0 ? 1 : 0.15) : 0.9
    led.current.emissiveIntensity = blink.current
  })

  return (
    <group>
      {/* main slab */}
      <mesh position={[0, -0.02, -0.025]}>
        <boxGeometry args={[BODY_W, BODY_H, 0.05]} />
        <meshStandardMaterial color={ARC.chassis} roughness={0.72} metalness={0.25} />
      </mesh>
      {/* screen bezel */}
      <mesh position={[0, 0.045, -0.004]}>
        <boxGeometry args={[SCREEN_W + 0.05, SCREEN_H + 0.05, 0.02]} />
        <meshStandardMaterial color={ARC.bezel} roughness={0.5} metalness={0.4} />
      </mesh>
      {/* grip ridges */}
      <mesh geometry={gripGeo} position={[-BODY_W / 2 - 0.004, -0.02, -0.02]}>
        <meshStandardMaterial color={ARC.chassisDark} roughness={0.95} />
      </mesh>
      <mesh geometry={gripGeo} position={[BODY_W / 2 + 0.004, -0.02, -0.02]}>
        <meshStandardMaterial color={ARC.chassisDark} roughness={0.95} />
      </mesh>
      {/* antenna */}
      <group position={[BODY_W / 2 - 0.05, BODY_H / 2 - 0.02, -0.03]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.004, 0.006, 0.1, 8]} />
          <meshStandardMaterial color={ARC.chassisDark} roughness={0.6} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.105, 0]}>
          <sphereGeometry args={[0.009, 12, 8]} />
          <meshStandardMaterial
            color={ARC.amber}
            emissive={ARC.amber}
            emissiveIntensity={0.6}
            roughness={0.4}
          />
        </mesh>
      </group>
      {/* brand plate */}
      <WindfoilText
        font={FONT.display}
        fontSize={0.028}
        color={rgba(ARC.green, 0.8)}
        anchorX="left"
        anchorY="middle"
        position={[-BODY_W / 2 + 0.035, -BODY_H / 2 + 0.155, 0.002]}
        renderOrder={20}
      >
        ARC-III
      </WindfoilText>
      <WindfoilText
        font={FONT.mono}
        fontSize={0.0135}
        color={rgba(ARC.greenDim)}
        anchorX="left"
        anchorY="middle"
        position={[-BODY_W / 2 + 0.035, -BODY_H / 2 + 0.128, 0.002]}
        renderOrder={20}
      >
        ARCHIVE RETRIEVAL CONSOLE
      </WindfoilText>
      {/* status LEDs */}
      <group position={[BODY_W / 2 - 0.04, -BODY_H / 2 + 0.14, 0.002]}>
        <mesh>
          <circleGeometry args={[0.0075, 16]} />
          <meshStandardMaterial color={ARC.green} emissive={ARC.green} emissiveIntensity={0.9} />
        </mesh>
        <mesh position={[-0.028, 0, 0]}>
          <circleGeometry args={[0.0075, 16]} />
          <meshStandardMaterial
            ref={led}
            color={ARC.amber}
            emissive={ARC.amber}
            emissiveIntensity={0.9}
          />
        </mesh>
      </group>
    </group>
  )
}
