// React Three Fiber component for windfoil text: loads a compiled font atlas, lays out the
// paragraph (lib/windfoil/layout), and renders the instanced glyph mesh (lib/windfoil/material).
// All in-scene text in the immersive app goes through this.

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three/webgpu'
import type { GroupProps } from '@react-three/fiber'
import { loadFontAtlas, peekFontAtlas } from '@/lib/windfoil/atlas'
import { layoutText } from '@/lib/windfoil/layout'
import { createTextMesh } from '@/lib/windfoil/material'
import type { FontAtlas, TextAlign, TextRun } from '@/lib/windfoil/types'

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

  useEffect(() => {
    if (!mesh) return
    return () => {
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
  }, [mesh])

  useEffect(() => {
    if (mesh) mesh.renderOrder = renderOrder
  }, [mesh, renderOrder])

  useEffect(() => {
    if (mesh) mesh.wfOpacity.value = opacity
  }, [mesh, opacity])

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
      {mesh && <primitive object={mesh} position={offset} />}
    </group>
  )
}
