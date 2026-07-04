// three.js WebGPU integration for windfoil text: instanced glyph-quad geometry + a NodeMaterial
// whose fragment runs the vendored winding-integral coverage shader (wgsl.ts) over shared storage
// buffers holding the font's curve atlas and row-band table.
//
// Instance data is bound through instancedBufferAttribute() nodes (per-instance step mode), which
// ties each material to its geometry's buffers — so the public API is createTextMesh().

import * as THREE from 'three/webgpu'
import {
  code,
  float,
  instancedBufferAttribute,
  mix,
  positionGeometry,
  storage,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
  wgslFn,
} from 'three/tsl'
import type { FontAtlas, TextLayout } from './types'
import { FLOATS_PER_INSTANCE } from './types'
import { WINDFOIL_WGSL_COVERAGE, WINDFOIL_WGSL_HELPERS } from './wgsl'

interface AtlasBuffers {
  curves: ReturnType<typeof storage>
  rows: ReturnType<typeof storage>
}

// Storage nodes are renderer-agnostic and immutable per atlas — share them across all materials.
const bufferCache = new WeakMap<FontAtlas, AtlasBuffers>()

function atlasBuffers(atlas: FontAtlas): AtlasBuffers {
  let b = bufferCache.get(atlas)
  if (!b) {
    // Slice into standalone arrays: the atlas views alias one fetched ArrayBuffer, and buffer
    // uploads must not drag the sibling block along (or trip on byteOffset handling).
    const curvesArr = atlas.curves.slice()
    const rowsArr = atlas.rows.slice()
    b = {
      curves: storage(new THREE.StorageBufferAttribute(curvesArr, 2), 'vec2', curvesArr.length / 2).toReadOnly(),
      rows: storage(new THREE.StorageBufferAttribute(rowsArr, 1), 'uint', rowsArr.length).toReadOnly(),
    }
    bufferCache.set(atlas, b)
  }
  return b
}

const helpers = code(WINDFOIL_WGSL_HELPERS)
const wfCoverage = wgslFn(WINDFOIL_WGSL_COVERAGE, [helpers])

export interface WindfoilTextOptions {
  /** Perceptual coverage styling; (1, 1) = mathematically exact box filter. */
  gamma?: number
  sharp?: number
  /** Extra AA-skirt padding around each glyph quad, in font units (default 0.06 em). */
  padUnits?: number
  depthTest?: boolean
  depthWrite?: boolean
  /** Diagnostic outputs: solid quads, glyph-space gradient, or the fwidth footprint. */
  debug?: 'solid' | 'rc' | 'fwidth'
}

export interface WindfoilTextMesh extends THREE.Mesh {
  /** Per-mesh fade multiplier (uniform, animatable without relayout). */
  wfOpacity: { value: number }
}

/**
 * Build a renderable text mesh from a TextLayout. Local space: block top-left at the origin,
 * +x right, +y UP (the vertex stage flips the layout's Y-down data), so the block occupies
 * x ∈ [0, width], y ∈ [-height, 0]. Fragment output is premultiplied and display-ready (no
 * lighting, no tone mapping). Dispose geometry + material when done.
 */
export function createTextMesh(
  atlas: FontAtlas,
  layout: TextLayout,
  options: WindfoilTextOptions = {}
): WindfoilTextMesh {
  const { curves, rows } = atlasBuffers(atlas)
  const gamma = options.gamma ?? 1
  const sharp = options.sharp ?? 1
  const padUnits = options.padUnits ?? atlas.manifest.upem * 0.06

  // --- geometry: one unit quad + four per-instance vec4s ------------------------------------
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.instanceCount = layout.glyphCount
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], 3)
  )
  geometry.setIndex([0, 1, 2, 2, 1, 3])

  const n = layout.glyphCount
  const placeArr = new Float32Array(n * 4)
  const bboxArr = new Float32Array(n * 4)
  const colorArr = new Float32Array(n * 4)
  const bandArr = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const o = i * FLOATS_PER_INSTANCE
    for (let j = 0; j < 4; j++) {
      placeArr[i * 4 + j] = layout.instances[o + j]
      bboxArr[i * 4 + j] = layout.instances[o + 4 + j]
      colorArr[i * 4 + j] = layout.instances[o + 8 + j]
      bandArr[i * 4 + j] = layout.instances[o + 12 + j]
    }
  }
  const placeAttr = new THREE.InstancedBufferAttribute(placeArr, 4)
  const bboxAttr = new THREE.InstancedBufferAttribute(bboxArr, 4)
  const colorAttr = new THREE.InstancedBufferAttribute(colorArr, 4)
  const bandAttr = new THREE.InstancedBufferAttribute(bandArr, 4)
  geometry.setAttribute('iPlace', placeAttr)
  geometry.setAttribute('iBbox', bboxAttr)
  geometry.setAttribute('iColor', colorAttr)
  geometry.setAttribute('iBand', bandAttr)

  // Manual bounds (instanced quads defeat automatic computation): the laid-out block box.
  const w = layout.width
  const h = layout.height
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(0, -h, 0), new THREE.Vector3(w, 0, 0))
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(w / 2, -h / 2, 0),
    Math.hypot(w, h) / 2 + 1e-3
  )

  // --- material ------------------------------------------------------------------------------
  const material = new THREE.NodeMaterial()
  const opacity = uniform(1)

  const place = instancedBufferAttribute(placeAttr) // originX, originY (block units, Y-down), unitsToLocal, fillRule
  const bbox = instancedBufferAttribute(bboxAttr) // ink box in font units, Y-down
  const color = instancedBufferAttribute(colorAttr) // straight-alpha RGBA
  const band = instancedBufferAttribute(bandAttr) // rowBase, bandCount, y0, invH

  // Vertex: expand the unit quad over the padded ink box, place it in block-local space, flip Y up.
  const corner = positionGeometry.xy
  const pad = float(padUnits)
  const lo = bbox.xy.sub(pad)
  const hi = bbox.zw.add(pad)
  const em = mix(lo, hi, corner)
  const scale = place.z
  material.positionNode = vec3(
    place.x.add(em.x.mul(scale)),
    place.y.add(em.y.mul(scale)).negate(),
    0
  )

  const vRC = varying(vec2(em))
  const vBand = varying(vec4(band))
  const vBbox = varying(vec4(bbox))
  const vColor = varying(vec4(color))
  const vFill = varying(place.w)

  if (options.debug === 'solid') {
    material.fragmentNode = vec4(0, 1, 0, 1)
  } else if (options.debug === 'rc') {
    const t = vRC.sub(vBbox.xy).div(vBbox.zw.sub(vBbox.xy))
    material.fragmentNode = vec4(t.x, t.y, 0, 1)
  } else if (options.debug === 'fwidth') {
    const fw = vRC.fwidth().mul(0.01)
    material.fragmentNode = vec4(fw.x, fw.y, 0, 1)
  } else {
    const cov = wfCoverage({
      rc: vRC,
      band: vBand,
      bbox: vBbox,
      fillRule: vFill,
      style: vec2(float(gamma), float(sharp)),
      curves,
      rows,
    })
    const a = vColor.w.mul(cov).mul(opacity)
    material.fragmentNode = vec4(vColor.xyz.mul(a), a)
    material.transparent = true
    material.premultipliedAlpha = true
  }

  material.depthWrite = options.depthWrite ?? false
  material.depthTest = options.depthTest ?? true
  material.side = THREE.DoubleSide

  const mesh = new THREE.Mesh(geometry, material) as unknown as WindfoilTextMesh
  mesh.wfOpacity = opacity
  mesh.frustumCulled = true
  return mesh
}
