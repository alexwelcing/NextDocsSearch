// The CRT screen stack: phosphor base plane, a content group (windfoil text + widgets, laid out
// from the screen's top-left), then multiply scanlines and additive glow overlays. Power-on
// runs the classic horizontal-blip: a scale-y snap from a bright line to the full raster.

import { ReactNode, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import {
  createGlowOverlayMaterial,
  createScanlineOverlayMaterial,
  createScreenBaseMaterial,
} from './CrtMaterials'

export const SCREEN_W = 0.62
export const SCREEN_H = 0.36

export function CrtScreen({
  children,
  powered,
}: {
  children?: ReactNode
  /** false = dark glass; true = raster on (with blip animation on transitions). */
  powered: boolean
}) {
  const base = useMemo(createScreenBaseMaterial, [])
  const scan = useMemo(createScanlineOverlayMaterial, [])
  const glow = useMemo(createGlowOverlayMaterial, [])
  const raster = useRef<THREE.Group>(null)
  const anim = useRef({ sy: powered ? 1 : 0.002, sx: powered ? 1 : 0.002 })

  useEffect(() => {
    return () => {
      base.dispose()
      scan.dispose()
      glow.dispose()
    }
  }, [base, scan, glow])

  useFrame((_, delta) => {
    const a = anim.current
    const g = raster.current
    if (!g) return
    // two-phase blip: x expands first (bright line), then y opens the raster
    const targetX = powered ? 1 : 0.002
    const targetY = powered && a.sx > 0.95 ? 1 : powered ? 0.012 : 0.002
    const k = 1 - Math.exp(-(powered ? 10 : 16) * delta)
    a.sx += (targetX - a.sx) * k
    a.sy += (targetY - a.sy) * k
    g.scale.set(a.sx, a.sy, 1)
    g.visible = a.sy > 0.004
  })

  return (
    <group>
      {/* dark glass face (always present) */}
      <mesh>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <primitive object={base} attach="material" />
      </mesh>

      {/* the raster: content + CRT overlays, blipped by power state */}
      <group ref={raster}>
        <group position={[-SCREEN_W / 2 + 0.02, SCREEN_H / 2 - 0.02, 0.002]}>{children}</group>
        <mesh position={[0, 0, 0.004]} renderOrder={30}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <primitive object={scan} attach="material" />
        </mesh>
        <mesh position={[0, 0, 0.005]} renderOrder={31}>
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <primitive object={glow} attach="material" />
        </mesh>
      </group>
    </group>
  )
}
