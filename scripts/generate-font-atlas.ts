// Compile TTF fonts into windfoil glyph atlases: for every charset glyph, extract the quadratic
// outline, split it into xy-monotone pieces (lib/windfoil/geometry), file the pieces into row
// bands (lib/windfoil/bands), and write:
//
//   public/fonts/<name>.wfa.bin   — [curves Float32][rows Uint32], offsets in the manifest
//   public/fonts/<name>.wfa.json  — metrics, per-glyph band headers, kerning pairs
//
// Run via `pnpm build` (or directly: `tsx scripts/generate-font-atlas.ts`). Fonts are TrueType, so
// outlines are already quadratics — no curve conversion loss. Coordinates are font units, Y-DOWN,
// baseline at y = 0 (opentype's getPath at size = upem).

import fs from 'node:fs'
import path from 'node:path'
import opentype from 'opentype.js'
import { pushMonotonePieces } from '../lib/windfoil/geometry'
import { bandPieces } from '../lib/windfoil/bands'
import { ATLAS_CHARSET } from '../lib/windfoil/charset'
import type { AtlasManifest } from '../lib/windfoil/types'

const FONTS_DIR = path.join(process.cwd(), 'public', 'fonts')

const FONTS: { file: string; out: string }[] = [
  { file: 'VT323-Regular.ttf', out: 'vt323' },
  { file: 'ShareTechMono-Regular.ttf', out: 'share-tech-mono' },
]

// A cubic → two quadratics (only reached if a font carries cubic outlines; TrueType does not).
function cubicToQuads(
  x0: number, y0: number, c1x: number, c1y: number,
  c2x: number, c2y: number, x1: number, y1: number, out: number[]
) {
  const m = (a: number, b: number) => (a + b) / 2
  const ax = m(x0, c1x)
  const ay = m(y0, c1y)
  const bx = m(c1x, c2x)
  const by = m(c1y, c2y)
  const cx = m(c2x, x1)
  const cy = m(c2y, y1)
  const dx = m(ax, bx)
  const dy = m(ay, by)
  const ex = m(bx, cx)
  const ey = m(by, cy)
  const mx = m(dx, ex)
  const my = m(dy, ey)
  out.push(x0, y0, 1.5 * dx - 0.25 * (x0 + mx), 1.5 * dy - 0.25 * (y0 + my), mx, my)
  out.push(mx, my, 1.5 * ex - 0.25 * (mx + x1), 1.5 * ey - 0.25 * (my + y1), x1, y1)
}

// A glyph's outline as flat quadratics [x0,y0, cx,cy, x1,y1] (font units, Y-down, baseline at 0).
// Straight segments become quads with the control point at their midpoint. Returns null for a
// blank glyph.
function glyphQuads(font: opentype.Font, glyph: opentype.Glyph) {
  const p = glyph.getPath(0, 0, font.unitsPerEm)
  const quads: number[] = []
  const line = (x0: number, y0: number, x1: number, y1: number) =>
    quads.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2, x1, y1)
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  for (const c of p.commands) {
    if (c.type === 'M') {
      cx = c.x
      cy = c.y
      sx = c.x
      sy = c.y
    } else if (c.type === 'L') {
      line(cx, cy, c.x, c.y)
      cx = c.x
      cy = c.y
    } else if (c.type === 'Q') {
      quads.push(cx, cy, c.x1, c.y1, c.x, c.y)
      cx = c.x
      cy = c.y
    } else if (c.type === 'C') {
      cubicToQuads(cx, cy, c.x1, c.y1, c.x2, c.y2, c.x, c.y, quads)
      cx = c.x
      cy = c.y
    } else if (c.type === 'Z') {
      if (cx !== sx || cy !== sy) line(cx, cy, sx, sy)
      cx = sx
      cy = sy
    }
  }
  if (quads.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < quads.length; i += 2) {
    x0 = Math.min(x0, quads[i])
    x1 = Math.max(x1, quads[i])
    y0 = Math.min(y0, quads[i + 1])
    y1 = Math.max(y1, quads[i + 1])
  }
  return { quads, bbox: [x0, y0, x1, y1] as [number, number, number, number] }
}

function compileFont(file: string, outName: string) {
  const buf = fs.readFileSync(path.join(FONTS_DIR, file))
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const upem = font.unitsPerEm
  const os2 = font.tables.os2 ?? {}

  const curves: number[] = []
  const rows: number[] = []
  const glyphs: Record<string, number[]> = {}
  const present: string[] = []
  let monotoneTotal = 0

  for (const ch of ATLAS_CHARSET) {
    const glyph = font.charToGlyph(ch)
    if (!glyph || glyph.index === 0) continue // not in font — runtime falls back
    const g = glyphQuads(font, glyph)
    const advance = glyph.advanceWidth ?? upem / 2
    if (!g) {
      glyphs[ch] = [0, 0, 0, 0, advance, 0, 0, 0, 0] // advance-only (bandCount 0 ⇒ never drawn)
      continue
    }
    const pieces: number[] = []
    for (let i = 0; i < g.quads.length; i += 6) pushMonotonePieces(g.quads.slice(i, i + 6), pieces)
    monotoneTotal += pieces.length / 6
    const [, y0, , y1] = g.bbox
    const h = bandPieces(pieces, y0, y1, curves, rows)
    glyphs[ch] = [h.rowBase, h.bandCount, h.y0, h.invH, advance, ...g.bbox]
    present.push(ch)
  }

  // Kerning across every present pair (GPOS/kern via opentype); sparse — only nonzero pairs kept.
  const kerning: Record<string, number> = {}
  for (const a of present) {
    const ga = font.charToGlyph(a)
    for (const b of present) {
      const k = font.getKerningValue(ga, font.charToGlyph(b))
      if (k) kerning[a + b] = k
    }
  }

  const curvesF32 = new Float32Array(curves)
  const rowsU32 = new Uint32Array(rows)
  const bin = Buffer.concat([
    Buffer.from(curvesF32.buffer, 0, curvesF32.byteLength),
    Buffer.from(rowsU32.buffer, 0, rowsU32.byteLength),
  ])

  const manifest: AtlasManifest = {
    version: 1,
    family: font.names.fontFamily?.en ?? outName,
    upem,
    ascender: font.ascender,
    descender: font.descender,
    lineGap: os2.sTypoLineGap ?? 0,
    capHeight: os2.sCapHeight ?? Math.round(font.ascender * 0.7),
    xHeight: os2.sxHeight ?? Math.round(font.ascender * 0.5),
    spaceAdvance: font.charToGlyph(' ')?.advanceWidth ?? upem / 2,
    curveBytes: curvesF32.byteLength,
    rowBytes: rowsU32.byteLength,
    glyphs,
    kerning,
  }

  fs.writeFileSync(path.join(FONTS_DIR, `${outName}.wfa.bin`), bin)
  fs.writeFileSync(path.join(FONTS_DIR, `${outName}.wfa.json`), JSON.stringify(manifest))
  console.log(
    `[font-atlas] ${outName}: ${present.length} glyphs, ${monotoneTotal} monotone pieces, ` +
      `${(bin.byteLength / 1024).toFixed(1)} KiB bin, ${Object.keys(kerning).length} kern pairs`
  )
}

for (const f of FONTS) compileFont(f.file, f.out)
