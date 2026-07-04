// A physical tab key on the ARC chassis: extruded cap with a windfoil label, hover glow,
// depress-on-press, and a lit state for the active tab.

import { useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { WindfoilText } from '../text/WindfoilText'
import { ARC, FONT, rgba } from '@/lib/immersive/theme'
import { playSound } from '@/lib/immersive/audio'

export const KEY_W = 0.092
export const KEY_H = 0.052

/** Kill both R3F propagation and the camera-rig's raw DOM listener. */
export function stopLook(e: ThreeEvent<PointerEvent>): void {
  e.stopPropagation()
  e.nativeEvent.stopImmediatePropagation?.()
}

export function DockKey({
  label,
  active,
  onPress,
  width = KEY_W,
}: {
  label: string
  active: boolean
  onPress: () => void
  width?: number
}) {
  const [hover, setHover] = useState(false)
  const cap = useRef<THREE.Group>(null)
  const depth = useRef(0)

  useFrame((_, delta) => {
    const target = depth.current > 0 ? Math.max(0, depth.current - delta * 60) : 0
    depth.current = target
    if (cap.current) cap.current.position.z = -0.006 * (target > 0 ? 1 : 0) - (active ? 0.003 : 0)
  })

  const capColor = active ? ARC.greenDim : hover ? '#3a453c' : ARC.chassis
  const labelColor = active ? rgba(ARC.greenBright) : hover ? rgba(ARC.green) : rgba(ARC.green, 0.55)

  return (
    <group>
      {/* socket */}
      <mesh position={[0, 0, -0.006]}>
        <boxGeometry args={[width + 0.008, KEY_H + 0.008, 0.012]} />
        <meshStandardMaterial color={ARC.chassisDark} roughness={0.9} />
      </mesh>
      <group ref={cap}>
        <mesh
          onPointerDown={(e) => {
            stopLook(e)
            depth.current = 1
            playSound('tab')
            onPress()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHover(false)
            document.body.style.cursor = 'auto'
          }}
        >
          <boxGeometry args={[width, KEY_H, 0.018]} />
          <meshStandardMaterial
            color={capColor}
            roughness={0.55}
            emissive={active ? ARC.greenDim : '#000000'}
            emissiveIntensity={active ? 0.7 : 0}
          />
        </mesh>
        <WindfoilText
          font={FONT.display}
          fontSize={0.026}
          color={labelColor}
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.0101]}
          renderOrder={20}
        >
          {label}
        </WindfoilText>
      </group>
    </group>
  )
}
