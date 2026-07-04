// Shared types for the windfoil text engine: the build-time atlas format and the
// runtime layout structures. Coordinates follow the upstream convention — font
// units, Y-DOWN, baseline at y = 0 — until the three.js vertex stage flips Y.

/** Per-glyph entry: band header + metrics. Packed as a flat tuple in the JSON sidecar. */
export interface GlyphEntry {
  /** First row-band record for this glyph, in row-quintuple units. */
  rowBase: number
  /** Number of row bands (1–64). */
  bandCount: number
  /** Ink-box top (y-down font units); origin of the band mapping. */
  y0: number
  /** Bands per font unit (0 when bandCount === 1). */
  invH: number
  /** Advance width in font units. */
  advance: number
  /** Ink bbox [loX, loY, hiX, hiY] in y-down font units. */
  bbox: [number, number, number, number]
}

/** JSON sidecar of a compiled `.wfa.bin` atlas. */
export interface AtlasManifest {
  version: 1
  family: string
  /** Font units per em. */
  upem: number
  /** Ascender in font units (positive, above baseline). */
  ascender: number
  /** Descender in font units (negative, below baseline). */
  descender: number
  lineGap: number
  capHeight: number
  xHeight: number
  spaceAdvance: number
  /** Byte length of the curve block at the start of the .bin (Float32, 6 floats per piece). */
  curveBytes: number
  /** Byte length of the row-table block that follows (Uint32, 5 per band). */
  rowBytes: number
  /** char → [rowBase, bandCount, y0, invH, advance, bboxLoX, bboxLoY, bboxHiX, bboxHiY] */
  glyphs: Record<string, number[]>
  /** Kerning pairs: two-char string → adjustment in font units. */
  kerning: Record<string, number>
}

/** A parsed, ready-to-upload atlas. */
export interface FontAtlas {
  manifest: AtlasManifest
  glyphs: Map<string, GlyphEntry>
  /** Curve atlas: 3 vec2 (6 floats) per xy-monotone piece, band-duplicated. */
  curves: Float32Array
  /** Row-band table: [start, count, areaBits, xMinBits, xMaxBits] per band. */
  rows: Uint32Array
}

/** One styled run inside a paragraph. */
export interface TextRun {
  text: string
  /** Font size in local/world units (default: layout-level fontSize). */
  size?: number
  /** Straight-alpha RGBA, 0..1 (default: layout-level color). */
  color?: [number, number, number, number]
}

export type TextAlign = 'left' | 'center' | 'right'

export interface LayoutOptions {
  fontSize: number
  color?: [number, number, number, number]
  /** Wrap width in local units; Infinity disables wrapping. */
  maxWidth?: number
  align?: TextAlign
  /** Line height as a multiple of fontSize (default 1.35). */
  lineHeight?: number
  /** Extra tracking in ems (default 0). */
  letterSpacing?: number
  /** Cap total laid-out lines; the last kept line is ellipsized. */
  maxLines?: number
}

export const FLOATS_PER_INSTANCE = 16

/** Result of laying out a paragraph: packed shader instances + measured box. */
export interface TextLayout {
  /** FLOATS_PER_INSTANCE per visible glyph: place(4) bbox(4) color(4) band(4). */
  instances: Float32Array
  glyphCount: number
  /** Tight layout width in local units (max line advance). */
  width: number
  /** Layout height in local units, from top of first line to bottom of last. */
  height: number
  lineCount: number
}
