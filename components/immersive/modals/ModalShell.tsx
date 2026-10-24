// Shared in-scene modal slab: a camera-anchored projection panel with phosphor frame, header,
// close control, and footer hints. Spawns with a scale-pop; Esc, Backspace (dock closed), the
// X, and a genuine tap on the space around the slab all close via the caller-provided handler
// so the URL stays canonical. The slab shrinks to fit narrow (portrait) views — see fit.ts.

import { ReactNode, useEffect, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { CameraAnchor } from '../dock/CameraAnchor'
import { WindfoilText } from '../text/WindfoilText'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { playSound } from '@/lib/immersive/audio'
import { fitScale } from '@/lib/immersive/fit'

export function stopLook(e: ThreeEvent<PointerEvent>): void {
  e.stopPropagation()
  e.nativeEvent.stopImmediatePropagation?.()
}

export const MODAL_W = 1.72
export const MODAL_H = 1.04
/** Content area inset from the slab edges. */
export const MODAL_PAD = 0.07
/** Camera → slab distance, metres. */
const MODAL_DIST = 1.5

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
  // tap-away tracking: pointerdown on the catcher plane records the screen position; the
  // window-level pointerup decides tap vs camera-look drag by pixel travel
  const tapStart = useRef<{ x: number; y: number } | null>(null)
  // Callers pass a fresh onClose closure every render (page turns, film frames, selection
  // changes). Reading it through a ref keeps the listeners below bound once for the slab's life
  // instead of re-subscribing — and re-running the mount effect — on every parent render.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // 'open' plays exactly once per slab mount.
  useEffect(() => {
    playSound('open')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        playSound('close')
        onCloseRef.current()
        return
      }
      // Backspace backs out too — but never while the dock is open (its SEARCH field and other
      // surfaces own the key there)
      if (e.key === 'Backspace' && !useImmersiveStore.getState().dockOpen) {
        e.preventDefault()
        playSound('close')
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The catcher's own pointerup can be swallowed (pointer capture, slab handlers), so the tap
  // is resolved at window level: under ~6px of travel = a genuine tap, anything more is a look.
  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const start = tapStart.current
      tapStart.current = null
      if (!start) return
      const travel = Math.hypot(e.clientX - start.x, e.clientY - start.y)
      if (travel < 6) {
        playSound('close')
        onCloseRef.current()
      }
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [])

  useFrame((state, delta) => {
    const g = rig.current
    if (!g) return
    scale.current += (1 - scale.current) * (1 - Math.exp(-12 * delta))
    // Fit is recomputed per frame: it tracks resizes/rotation and the wheel-zoom fov for free.
    const cam = state.camera as THREE.PerspectiveCamera
    const fit = fitScale({
      vFov: cam.fov,
      aspect: cam.aspect,
      distance: MODAL_DIST,
      width,
      height,
    })
    g.scale.setScalar(scale.current * fit)
  })

  const hw = width / 2
  const hh = height / 2

  return (
    <CameraAnchor stiffness={9}>
      {/* tap-away catcher: an invisible full-view plane behind the slab. It records pointerdown
          WITHOUT stopping propagation, so a drag that starts here still turns the camera — only
          a near-zero-travel tap (resolved on window pointerup) closes the modal. */}
      <mesh position={[0, 0, -2.4]} renderOrder={4} onPointerDown={(e) => {
        tapStart.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
      }}>
        <planeGeometry args={[14, 9]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} transparent />
      </mesh>
      <group position={[0, 0.02, -MODAL_DIST]}>
        <group ref={rig} scale={0.6}>
          {/* backdrop — stops R3F propagation so panel clicks never reach the catcher (the
              camera-rig's raw DOM listener still sees them, so look-drags over the slab work) */}
          <mesh
            renderOrder={5}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
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
          {/* close — the visible plate stays small; a fat invisible hitbox around it takes the
              pointer so nobody has to aim at a 7cm target */}
          <mesh position={[hw - 0.05, hh - 0.05, 0.002]} renderOrder={7}>
            <planeGeometry args={[0.07, 0.07]} />
            <meshBasicMaterial color={hoverClose ? '#3a1410' : ARC.bezel} />
          </mesh>
          {/* sits a hair BEHIND interactive content (raycasts sort by distance), so header chips
              that stray into the fat zone still win their own clicks */}
          <mesh
            position={[hw - 0.05, hh - 0.05, 0.0015]}
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
            <planeGeometry args={[0.17, 0.17]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} transparent />
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
            X
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
