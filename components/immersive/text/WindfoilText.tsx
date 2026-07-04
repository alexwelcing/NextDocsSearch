// React Three Fiber component for windfoil text: loads a compiled font atlas, lays out the
// paragraph (lib/windfoil/layout), and renders the instanced glyph mesh (lib/windfoil/material).
// All in-scene text in the immersive app goes through this.

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import { useFrame, type ThreeElements } from '@react-three/fiber'

type GroupProps = ThreeElements['group']
import { loadFontAtlas, peekFontAtlas } from '@/lib/windfoil/atlas'
import { layoutText } from '@/lib/windfoil/layout'
import { createTextMesh, type WindfoilTextMesh } from '@/lib/windfoil/material'
import type { FontAtlas, TextAlign, TextRun } from '@/lib/windfoil/types'

// Phosphor glow: windfoil's coverage is exact at any scale, so one enlarged copy alone is just a
// bigger crisp copy, not a blur — there's no post-processing pipeline to actually blur it. The
// classic poor-man's-bloom trick instead: a couple of uniformly-enlarged, additively-blended,
// dimmer copies of the SAME mesh layered under the crisp one. The thin rings where each larger
// copy peeks out past the previous one are dim enough to read as a soft falloff rather than
// distinct hard edges — especially over the CRT scanline/vignette overlay, and especially for
// green-on-black phosphor text, which is exactly what real CRT glow looks like.
const GLOW_LAYERS: { scale: number; opacityScale: number }[] = [
  { scale: 1.22, opacityScale: 0.35 },
  { scale: 1.55, opacityScale: 0.13 },
]

export type RGBA = [number, number, number, number]

/** Accepts a css-style hex/named color or an RGBA tuple; returns straight-alpha RGBA. */
export function toRGBA(color: string | RGBA | undefined, fallback: RGBA): RGBA {
  if (!color) return fallback
  if (Array.isArray(color)) return color
  const c = new THREE.Color(color)
  return [c.r, c.g, c.b, 1]
}

/** Load (and re-render on arrival of) a compiled windfoil font atlas. */
export function useFontAtlas(font: string): FontAtlas | undefined {
  const [atlas, setAtlas] = useState<FontAtlas | undefined>(() => peekFontAtlas(font))
  useEffect(() => {
    let live = true
    loadFontAtlas(font).then(
      (a) => live && setAtlas(a),
      (err) => console.error('[windfoil] atlas load failed:', err)
    )
    return () => {
      live = false
    }
  }, [font])
  return atlas
}

export interface WindfoilTextProps extends Omit<GroupProps, 'children' | 'color'> {
  children: string | TextRun[]
  /** Atlas name under public/fonts (default 'vt323'). */
  font?: string
  /** Font size in world units. */
  fontSize?: number
  color?: string | RGBA
  maxWidth?: number
  align?: TextAlign
  lineHeight?: number
  letterSpacing?: number
  maxLines?: number
  anchorX?: 'left' | 'center' | 'right'
  anchorY?: 'top' | 'middle' | 'bottom'
  /** Fade multiplier — drives a uniform, no relayout. */
  opacity?: number
  gamma?: number
  sharp?: number
  depthTest?: boolean
  depthWrite?: boolean
  renderOrder?: number
  onLayout?: (box: { width: number; height: number; lineCount: number }) => void
  /** Materialize-in reveal, ms. Unset = text appears instantly (the default everywhere). Restarts
   *  whenever a new mesh is created (content/font/size change) — only use on text that settles
   *  once per mount (boot lines, tab switches, page turns), not on live-typed input. */
  revealDuration?: number
  /** ms to hold at zero before the reveal starts (for staggering multiple blocks). */
  revealDelay?: number
  /** Additive phosphor halo behind the text — a few cents of extra draw calls, no post-processing
   *  pipeline required. Opt-in: use sparingly (headers, hero moments), not on dense body copy. */
  glow?: boolean
}

const DEFAULT_COLOR: RGBA = [0.44, 1, 0.56, 1] // phosphor green

export function WindfoilText({
  children,
  font = 'vt323',
  fontSize = 0.1,
  color,
  maxWidth,
  align,
  lineHeight,
  letterSpacing,
  maxLines,
  anchorX = 'left',
  anchorY = 'top',
  opacity = 1,
  gamma,
  sharp,
  depthTest,
  depthWrite,
  renderOrder = 10,
  onLayout,
  revealDuration,
  revealDelay = 0,
  glow = false,
  ...groupProps
}: WindfoilTextProps) {
  const atlas = useFontAtlas(font)
  const rgba = useMemo(() => toRGBA(color, DEFAULT_COLOR), [color])

  const layout = useMemo(() => {
    if (!atlas) return undefined
    return layoutText(atlas, children, {
      fontSize,
      color: rgba,
      maxWidth,
      align,
      lineHeight,
      letterSpacing,
      maxLines,
    })
  }, [atlas, children, fontSize, rgba, maxWidth, align, lineHeight, letterSpacing, maxLines])

  const mesh = useMemo(() => {
    if (!atlas || !layout) return undefined
    const m = createTextMesh(atlas, layout, { gamma, sharp, depthTest, depthWrite })
    m.renderOrder = renderOrder
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, layout, gamma, sharp, depthTest, depthWrite])

  // Halo copies for the `glow` prop: same atlas/layout, additive blending, scaled up around the
  // text block's own center (computed directly — see GLOW_LAYERS' comment for why this can't be
  // done with padUnits alone).
  const haloMeshes = useMemo<WindfoilTextMesh[]>(() => {
    if (!atlas || !layout || !glow) return []
    return GLOW_LAYERS.map((_layer) => {
      const m = createTextMesh(atlas, layout, { gamma, sharp, depthTest, depthWrite: false })
      const mat = m.material as THREE.Material
      mat.blending = THREE.AdditiveBlending
      mat.depthWrite = false
      return m
    })
  }, [atlas, layout, glow, gamma, sharp, depthTest])

  const haloTransforms = useMemo<[number, number, number][]>(() => {
    if (!layout) return []
    const cx = layout.width / 2
    const cy = -layout.height / 2
    return GLOW_LAYERS.map((l) => [cx * (1 - l.scale), cy * (1 - l.scale), 0])
  }, [layout])

  useEffect(() => {
    if (!mesh) return
    return () => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
  }, [mesh])

  useEffect(() => {
    if (!haloMeshes.length) return
    return () => {
      for (const m of haloMeshes) {
        m.geometry.dispose()
        ;(m.material as THREE.Material).dispose()
      }
    }
  }, [haloMeshes])

  useEffect(() => {
    if (mesh) mesh.renderOrder = renderOrder
    for (const m of haloMeshes) m.renderOrder = renderOrder - 1
  }, [mesh, haloMeshes, renderOrder])

  useEffect(() => {
    if (mesh) mesh.wfOpacity.value = opacity
    haloMeshes.forEach((m, i) => {
      m.wfOpacity.value = opacity * GLOW_LAYERS[i].opacityScale
    })
  }, [mesh, haloMeshes, opacity])

  // Arm the reveal on every fresh mesh (a new mesh means new content/font/size — the natural
  // moment to (re)materialize). No-op when revealDuration is unset; createTextMesh's default
  // wfReveal value already renders such text fully in.
  const revealStartAt = useRef<number | null>(null)
  const revealSettled = useRef(true)
  useEffect(() => {
    if (!mesh || !revealDuration) return
    mesh.wfReveal.value = 0
    for (const m of haloMeshes) m.wfReveal.value = 0
    revealStartAt.current = performance.now() + revealDelay
    revealSettled.current = false
  }, [mesh, haloMeshes, revealDuration, revealDelay])

  useFrame(() => {
    if (revealSettled.current || !mesh || !revealDuration || revealStartAt.current === null) return
    const elapsed = performance.now() - revealStartAt.current
    if (elapsed < 0) return // still in the delay window
    const p = Math.min(elapsed / revealDuration, 1.15) // past 1 so the last glyph's window fully clears
    mesh.wfReveal.value = p
    for (const m of haloMeshes) m.wfReveal.value = p
    if (p >= 1.15) revealSettled.current = true
  })

  const onLayoutRef = useRef(onLayout)
  onLayoutRef.current = onLayout
  useEffect(() => {
    if (layout) {
      onLayoutRef.current?.({
        width: layout.width,
        height: layout.height,
        lineCount: layout.lineCount,
      })
    }
  }, [layout])

  const offset = useMemo<[number, number, number]>(() => {
    if (!layout) return [0, 0, 0]
    const x = anchorX === 'center' ? -layout.width / 2 : anchorX === 'right' ? -layout.width : 0
    const y = anchorY === 'middle' ? layout.height / 2 : anchorY === 'bottom' ? layout.height : 0
    return [x, y, 0]
  }, [layout, anchorX, anchorY])

  return (
    <group {...groupProps}>
      <group position={offset}>
        {haloMeshes.map((m, i) => (
          <primitive
            key={i}
            object={m}
            position={haloTransforms[i]}
            scale={GLOW_LAYERS[i].scale}
          />
        ))}
        {mesh && <primitive object={mesh} />}
      </group>
    </group>
  )
}
