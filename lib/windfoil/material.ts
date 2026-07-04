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
  instanceIndex,
  instancedBufferAttribute,
  positionGeometry,
  smoothstep,
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
  // TSL's storage() typings can't express element-typed read-only buffers; at runtime these are
  // StorageBufferNodes, handed straight to the wgslFn call below as plain Nodes.
  curves: THREE.Node
  rows: THREE.Node
}

// Storage nodes are renderer-agnostic and immutable per atlas — share them across all materials.
const bufferCache = new WeakMap<FontAtlas, AtlasBuffers>()

function atlasBuffers(atlas: FontAtlas): AtlasBuffers {
  const cached = bufferCache.get(atlas)
  if (cached) return cached
  // Slice into standalone arrays: the atlas views alias one fetched ArrayBuffer, and buffer
  // uploads must not drag the sibling block along (or trip on byteOffset handling).
  const curvesArr = atlas.curves.slice()
  const rowsArr = atlas.rows.slice()
  const built: AtlasBuffers = {
    curves: storage(
      new THREE.StorageBufferAttribute(curvesArr, 2),
      'vec2',
      curvesArr.length / 2
    ).toReadOnly() as unknown as THREE.Node,
    rows: storage(
      new THREE.StorageBufferAttribute(rowsArr, 1),
      'uint',
      rowsArr.length
    ).toReadOnly() as unknown as THREE.Node,
  }
  bufferCache.set(atlas, built)
  return built
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
  /** Per-mesh materialize-in progress, 0..1 (see WindfoilText's revealDuration prop). Defaults
   *  to a sentinel past 1 so text with no reveal driver renders fully in, unanimated. */
  wfReveal: { value: number }
}

// Width of each glyph's individual fade-in window, in normalized reveal-progress units. Multiple
// glyphs fade concurrently within this band, reading as a soft cascading materialize rather than
// one glyph at a time.
const REVEAL_WINDOW = 0.14
// Past 1 + REVEAL_WINDOW, every glyph's smoothstep saturates to 1 — the "fully revealed" rest state.
const REVEAL_DONE = 1 + REVEAL_WINDOW

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
  const reveal = uniform(REVEAL_DONE)

  // Explicit <'vec4'> type argument: the plain 'vec4' string argument alone widens to `string` in
  // generic inference (literal inference only kicks in for the type PARAMETER position, not a
  // same-named runtime argument), which drops swizzle typings (.xy, .zw, ...).
  const place = instancedBufferAttribute<'vec4'>(placeAttr, 'vec4') // originX, originY (Y-down), unitsToLocal, fillRule
  const bbox = instancedBufferAttribute<'vec4'>(bboxAttr, 'vec4') // ink box in font units, Y-down
  const color = instancedBufferAttribute<'vec4'>(colorAttr, 'vec4') // straight-alpha RGBA
  const band = instancedBufferAttribute<'vec4'>(bandAttr, 'vec4') // rowBase, bandCount, y0, invH

  // Vertex: expand the unit quad over the padded ink box, place it in block-local space, flip Y up.
  const corner = positionGeometry.xy
  const pad = float(padUnits)
  const lo = bbox.xy.sub(pad)
  const hi = bbox.zw.add(pad)
  const em = lo.add(hi.sub(lo).mul(corner)) // mix(), spelled out for the typings
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

  // Materialize-in: instanceIndex is emission order (reading order — line by line, char by char,
  // per layoutText), a vertex-stage-only WGSL builtin, so the ordinal and its fade window are
  // computed here and carried to the fragment stage as a varying like everything else above.
  const revealDenom = Math.max(layout.glyphCount - 1, 1)
  const ordinal = float(instanceIndex).div(revealDenom)
  // Each glyph is 0% revealed at reveal===ordinal, ramping to 100% by ordinal+REVEAL_WINDOW — NOT
  // the mirrored [ordinal-window, ordinal] form, which would put glyph 0's window entirely at or
  // below reveal=0 and pop it in fully formed instead of fading it in with the rest.
  const vReveal = varying(smoothstep(ordinal, ordinal.add(REVEAL_WINDOW), reveal))

  if (options.debug === 'solid') {
    material.fragmentNode = vec4(0, 1, 0, 1)
  } else if (options.debug === 'rc') {
    const t = vRC.sub(vBbox.xy).div(vBbox.zw.sub(vBbox.xy))
    material.fragmentNode = vec4(t.x, t.y, 0, 1)
  } else if (options.debug === 'fwidth') {
    const fw = vRC.fwidth().mul(0.01)
    material.fragmentNode = vec4(fw.x, fw.y, 0, 1)
  } else {
    // wgslFn's declared return type is an untemplated Node (TS can't parse the WGSL return type
    // from the source string), so float() — which only accepts already-scalar-typed nodes —
    // needs a cast at this one boundary. The WGSL itself declares `-> f32`, so this is accurate.
    const cov = wfCoverage({
      rc: vRC,
      band: vBand,
      bbox: vBbox,
      fillRule: vFill,
      style: vec2(float(gamma), float(sharp)),
      curves,
      rows,
    }) as unknown as Parameters<typeof float>[0]
    const a = vColor.w.mul(float(cov)).mul(opacity).mul(vReveal)
    material.fragmentNode = vec4(vColor.xyz.mul(a), a)
    material.transparent = true
    material.premultipliedAlpha = true
  }

  material.depthWrite = options.depthWrite ?? false
  material.depthTest = options.depthTest ?? true
  material.side = THREE.DoubleSide
  // Text is emissive UI — scene fog must never haze it (NodeMaterial.setupOutput applies fog
  // even over a custom fragmentNode, so the opt-out has to be explicit).
  material.fog = false

  const mesh = new THREE.Mesh(geometry, material) as unknown as WindfoilTextMesh
  mesh.wfOpacity = opacity
  mesh.wfReveal = reveal
  mesh.frustumCulled = true
  return mesh
}
