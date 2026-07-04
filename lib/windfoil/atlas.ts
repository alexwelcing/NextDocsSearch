// Runtime atlas loading: fetch a compiled .wfa.json manifest + .wfa.bin blob (built by
// scripts/generate-font-atlas.ts) and expose the typed arrays + glyph table. Browser-only.

import type { AtlasManifest, FontAtlas, GlyphEntry } from './types'

const cache = new Map<string, Promise<FontAtlas>>()

async function fetchAtlas(name: string): Promise<FontAtlas> {
  const [manifest, bin] = await Promise.all([
    fetch(`/fonts/${name}.wfa.json`).then((r) => {
      if (!r.ok) throw new Error(`font atlas manifest ${name}: HTTP ${r.status}`)
      return r.json() as Promise<AtlasManifest>
    }),
    fetch(`/fonts/${name}.wfa.bin`).then((r) => {
      if (!r.ok) throw new Error(`font atlas bin ${name}: HTTP ${r.status}`)
      return r.arrayBuffer()
    }),
  ])

  const curves = new Float32Array(bin, 0, manifest.curveBytes / 4)
  const rows = new Uint32Array(bin, manifest.curveBytes, manifest.rowBytes / 4)

  const glyphs = new Map<string, GlyphEntry>()
  for (const [ch, g] of Object.entries(manifest.glyphs)) {
    glyphs.set(ch, {
      rowBase: g[0],
      bandCount: g[1],
      y0: g[2],
      invH: g[3],
      advance: g[4],
      bbox: [g[5], g[6], g[7], g[8]],
    })
  }
  return { manifest, glyphs, curves, rows }
}

const resolved = new Map<string, FontAtlas>()

/** Load (and cache) a compiled font atlas by name, e.g. 'vt323' or 'share-tech-mono'. */
export function loadFontAtlas(name: string): Promise<FontAtlas> {
  let p = cache.get(name)
  if (!p) {
    p = fetchAtlas(name).then(
      (atlas) => {
        resolved.set(name, atlas)
        return atlas
      },
      (err) => {
        cache.delete(name) // allow retry after a transient network failure
        throw err
      }
    )
    cache.set(name, p)
  }
  return p
}

/** Synchronously read an already-loaded atlas (undefined until loadFontAtlas resolves). */
export function peekFontAtlas(name: string): FontAtlas | undefined {
  return resolved.get(name)
}
