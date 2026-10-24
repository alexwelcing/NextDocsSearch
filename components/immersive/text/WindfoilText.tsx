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
import { FLOATS_PER_INSTANCE } from '@/lib/windfoil/types'
import type { FontAtlas, TextAlign, TextLayout, TextRun } from '@/lib/windfoil/types'

// Phosphor glow: windfoil's coverage is exact at any scale, so one enlarged copy alone is just a
// bigger crisp copy, not a blur — and PostFX bloom only exists above 'low' quality. The classic
// poor-man's-bloom trick instead: a couple of enlarged, additively-blended, dimmer copies of the
// SAME glyphs layered under the crisp ones. The thin rings where each larger copy peeks out past
// the previous one are dim enough to read as a soft falloff rather than distinct hard edges —
// especially over the CRT scanline/vignette overlay, and especially for green-on-black phosphor
// text, which is exactly what real CRT glow looks like. Each glyph grows about its OWN centre
// (haloLayout): scaling the whole block about its middle shoved the outer glyphs' halos sideways
// by (scale - 1) x half the line width, which on a hero title read as ghost duplicate letters.
const GLOW_LAYERS: { scale: number; opacityScale: number }[] = [
  { scale: 1.22, opacityScale: 0.35 },
  { scale: 1.55, opacityScale: 0.13 },
]

export type RGBA = [number, number, number, number]

/** Accepts a css-style hex/named color or an RGBA tuple; returns straight-alpha RGBA in the
 *  linear working space (THREE.Color decodes CSS colors from sRGB; tuples pass through as-is). */
export function toRGBA(color: string | RGBA | undefined, fallback: RGBA): RGBA {
  if (!color) return fallback
  if (Array.isArray(color)) return color
  const c = new THREE.Color(color)
  return [c.r, c.g, c.b, 1]
}

/** Copy of `layout` with every glyph quad scaled by `scale` about its own ink-box centre, so a
 *  halo stays registered on its glyph whatever the line length. Instance packing (types.ts):
 *  place(penX, baselineY, unitsToLocal, fillRule) · bbox(loX, loY, hiX, hiY in font units) · … */
export function haloLayout(layout: TextLayout, scale: number): TextLayout {
  const src = layout.instances
  const instances = new Float32Array(src)
  for (let i = 0; i < layout.glyphCount; i++) {
    const o = i * FLOATS_PER_INSTANCE
    const k = src[o + 2]
    const cx = (src[o + 4] + src[o + 6]) / 2
    const cy = (src[o + 5] + src[o + 7]) / 2
    // centre stays put: pen + c·k === pen' + c·k·scale
    instances[o] = src[o] + cx * k * (1 - scale)
    instances[o + 1] = src[o + 1] + cy * k * (1 - scale)
    instances[o + 2] = k * scale
  }
  return { ...layout, instances }
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

const DEFAULT_COLOR: RGBA = toRGBA('#70ff8f', [0, 0, 0, 1]) // phosphor green (ARC.green)

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
  // Keyed by VALUE: callers build colors inline (rgba(ARC.green, 0.9)) and run arrays inline, so
  // identity changes on every parent render. Keying on identity rebuilt the layout, the meshes and
  // their GPU buffers on every re-render, and re-armed the reveal: a title card whose parent
  // re-renders per frame while fading re-materialized glyph-by-glyph the whole way out.
  const colorKey = Array.isArray(color) ? color.join(',') : color ?? ''
  const contentKey = typeof children === 'string' ? children : JSON.stringify(children)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rgba = useMemo(() => toRGBA(color, DEFAULT_COLOR), [colorKey])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, contentKey, fontSize, rgba, maxWidth, align, lineHeight, letterSpacing, maxLines])

  const mesh = useMemo(() => {
    if (!atlas || !layout) return undefined
    const m = createTextMesh(atlas, layout, { gamma, sharp, depthTest, depthWrite })
    m.renderOrder = renderOrder
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atlas, layout, gamma, sharp, depthTest, depthWrite])

  // Halo copies for the `glow` prop: same atlas and glyphs, additive blending, each glyph grown
  // about its own centre (haloLayout — see GLOW_LAYERS' comment for why not the block's).
  const haloMeshes = useMemo<WindfoilTextMesh[]>(() => {
    if (!atlas || !layout || !glow) return []
    return GLOW_LAYERS.map((layer) => {
      const m = createTextMesh(atlas, haloLayout(layout, layer.scale), {
        gamma,
        sharp,
        depthTest,
        depthWrite: false,
      })
      const mat = m.material as THREE.Material
      mat.blending = THREE.AdditiveBlending
      mat.depthWrite = false
      return m
    })
  }, [atlas, layout, glow, gamma, sharp, depthTest])

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
          <primitive key={i} object={m} />
        ))}
        {mesh && <primitive object={mesh} />}
      </group>
    </group>
  )
}
