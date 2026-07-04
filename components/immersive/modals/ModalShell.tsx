// Shared in-scene modal slab: a camera-anchored projection panel with phosphor frame, header,
// close control, and footer hints. Spawns with a scale-pop; Esc (and the ✕) close via the
// caller-provided handler so the URL stays canonical.

import { ReactNode, useEffect, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { CameraAnchor } from '../dock/CameraAnchor'
import { WindfoilText } from '../text/WindfoilText'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { playSound } from '@/lib/immersive/audio'

export function stopLook(e: ThreeEvent<PointerEvent>): void {
  e.stopPropagation()
  e.nativeEvent.stopImmediatePropagation?.()
}

export const MODAL_W = 1.72
export const MODAL_H = 1.04
/** Content area inset from the slab edges. */
export const MODAL_PAD = 0.07

export function ModalShell({
  title,
  meta,
  hints,
  onClose,
  children,
  width = MODAL_W,
  height = MODAL_H,
}: {
  title: string
  meta?: string
  hints?: string
  onClose: () => void
  children?: ReactNode
  width?: number
  height?: number
}) {
  const rig = useRef<THREE.Group>(null)
  const [hoverClose, setHoverClose] = useState(false)
  const scale = useRef(0.6)

  useEffect(() => {
    playSound('open')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        playSound('close')
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useFrame((_, delta) => {
    const g = rig.current
    if (!g) return
    scale.current += (1 - scale.current) * (1 - Math.exp(-12 * delta))
    g.scale.setScalar(scale.current)
  })

  const hw = width / 2
  const hh = height / 2

  return (
    <CameraAnchor stiffness={9}>
      <group position={[0, 0.02, -1.5]}>
        <group ref={rig} scale={0.6}>
          {/* backdrop */}
          <mesh renderOrder={5}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial color={ARC.screenBg} transparent opacity={0.94} />
          </mesh>
          {/* frame */}
          {(
            [
              [0, hh, width, 0.004],
              [0, -hh, width, 0.004],
              [-hw, 0, 0.004, height],
              [hw, 0, 0.004, height],
            ] as const
          ).map(([x, y, w, h], i) => (
            <mesh key={i} position={[x, y, 0.001]} renderOrder={6}>
              <planeGeometry args={[w, h]} />
              <meshBasicMaterial color={ARC.greenDim} />
            </mesh>
          ))}
          {/* header */}
          <WindfoilText
            font={FONT.display}
            fontSize={0.052}
            color={rgba(ARC.greenBright)}
            position={[-hw + 0.05, hh - 0.035, 0.002]}
            maxWidth={width - 0.45}
            maxLines={1}
            renderOrder={10}
          >
            {title.toUpperCase()}
          </WindfoilText>
          {meta && (
            <WindfoilText
              font={FONT.mono}
              fontSize={TYPE.small}
              color={rgba(ARC.greenDim)}
              anchorX="right"
              position={[hw - 0.11, hh - 0.048, 0.002]}
              maxLines={1}
              renderOrder={10}
            >
              {meta}
            </WindfoilText>
          )}
          <mesh position={[0, hh - 0.105, 0.001]} renderOrder={6}>
            <planeGeometry args={[width - 0.09, 0.0025]} />
            <meshBasicMaterial color={ARC.greenDim} />
          </mesh>
          {/* close */}
          <mesh
            position={[hw - 0.05, hh - 0.05, 0.002]}
            onPointerDown={(e) => {
              stopLook(e)
              playSound('close')
              onClose()
            }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHoverClose(true)
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              setHoverClose(false)
              document.body.style.cursor = 'auto'
            }}
            renderOrder={7}
          >
            <planeGeometry args={[0.07, 0.07]} />
            <meshBasicMaterial color={hoverClose ? '#3a1410' : ARC.bezel} />
          </mesh>
          <WindfoilText
            font={FONT.display}
            fontSize={0.045}
            color={rgba(hoverClose ? ARC.red : ARC.green, 0.9)}
            anchorX="center"
            anchorY="middle"
            position={[hw - 0.05, hh - 0.05, 0.003]}
            renderOrder={10}
          >
            ✗
          </WindfoilText>
          {/* content */}
          <group position={[-hw + MODAL_PAD, hh - 0.145, 0.002]}>{children}</group>
          {/* hints */}
          {hints && (
            <WindfoilText
              font={FONT.mono}
              fontSize={TYPE.micro}
              color={rgba(ARC.greenDim)}
              anchorX="center"
              position={[0, -hh + 0.038, 0.002]}
              renderOrder={10}
            >
              {hints}
            </WindfoilText>
          )}
        </group>
      </group>
    </CameraAnchor>
  )
}
