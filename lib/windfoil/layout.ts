// Text layout for the windfoil engine: turn a string (or styled runs) into packed per-glyph
// shader instances with greedy word wrapping, alignment, letter spacing, and line capping.
//
// Coordinates are Y-DOWN local units with the block origin at the top-left; the mesh vertex stage
// flips to three.js Y-up. Each visible glyph emits FLOATS_PER_INSTANCE floats:
//   place(penX, baselineY, unitsToLocal, fillRule) · bbox(4) · color(4) · band(rowBase, count, y0, invH)

import { FALLBACK_CHAR } from './charset'
import type { FontAtlas, GlyphEntry, LayoutOptions, TextLayout, TextRun } from './types'
import { FLOATS_PER_INSTANCE } from './types'

const WHITESPACE = /[ \t]/

interface Token {
  /** 'word' carries glyphs; 'space' carries only advance; 'break' forces a new line. */
  kind: 'word' | 'space' | 'break'
  chars: string[]
  size: number
  color: [number, number, number, number]
  /** Advance in local units (kerning + tracking included). */
  width: number
}

function glyphOf(atlas: FontAtlas, ch: string): GlyphEntry | undefined {
  return atlas.glyphs.get(ch) ?? atlas.glyphs.get(FALLBACK_CHAR)
}

function advanceOf(atlas: FontAtlas, ch: string): number {
  if (ch === ' ') return atlas.manifest.spaceAdvance
  if (ch === '\t') return atlas.manifest.spaceAdvance * 4
  return glyphOf(atlas, ch)?.advance ?? atlas.manifest.spaceAdvance
}

function kernOf(atlas: FontAtlas, a: string, b: string): number {
  return atlas.manifest.kerning[a + b] ?? 0
}

function tokenWidth(atlas: FontAtlas, chars: string[], scale: number, tracking: number): number {
  let w = 0
  for (let i = 0; i < chars.length; i++) {
    if (i > 0) w += kernOf(atlas, chars[i - 1], chars[i]) * scale
    w += advanceOf(atlas, chars[i]) * scale + tracking
  }
  return w
}

function tokenize(atlas: FontAtlas, runs: TextRun[], opts: Required<Pick<LayoutOptions, 'fontSize' | 'color' | 'letterSpacing'>>): Token[] {
  const tokens: Token[] = []
  for (const run of runs) {
    const size = run.size ?? opts.fontSize
    const color = run.color ?? opts.color
    const scale = size / atlas.manifest.upem
    const tracking = opts.letterSpacing * size
    let word: string[] = []
    const flush = () => {
      if (word.length) {
        tokens.push({ kind: 'word', chars: word, size, color, width: tokenWidth(atlas, word, scale, tracking) })
        word = []
      }
    }
    for (const ch of run.text) {
      if (ch === '\n') {
        flush()
        tokens.push({ kind: 'break', chars: [], size, color, width: 0 })
      } else if (WHITESPACE.test(ch)) {
        flush()
        tokens.push({ kind: 'space', chars: [ch], size, color, width: advanceOf(atlas, ch) * scale + tracking })
      } else {
        word.push(ch)
      }
    }
    flush()
  }
  return tokens
}

interface Line {
  tokens: Token[]
  width: number
  /** Tallest run size on the line (drives its advance to the next baseline). */
  size: number
}

function breakLines(tokens: Token[], maxWidth: number, maxLines: number): { lines: Line[]; clipped: boolean } {
  const lines: Line[] = []
  let cur: Line = { tokens: [], width: 0, size: 0 }
  let clipped = false
  const push = () => {
    // trim trailing spaces from the measured width
    while (cur.tokens.length && cur.tokens[cur.tokens.length - 1].kind === 'space') {
      cur.width -= cur.tokens.pop()!.width
    }
    lines.push(cur)
    cur = { tokens: [], width: 0, size: 0 }
  }
  for (const tok of tokens) {
    if (lines.length >= maxLines) {
      clipped = true
      break
    }
    if (tok.kind === 'break') {
      cur.size = Math.max(cur.size, tok.size)
      push()
      continue
    }
    if (tok.kind === 'space' && cur.tokens.length === 0) continue // swallow leading spaces
    if (tok.kind === 'word' && cur.width + tok.width > maxWidth && cur.tokens.length > 0) {
      push()
      if (lines.length >= maxLines) {
        clipped = true
        break
      }
    }
    cur.tokens.push(tok)
    cur.width += tok.width
    cur.size = Math.max(cur.size, tok.size)
  }
  if (cur.tokens.length || lines.length === 0) {
    if (lines.length < maxLines) push()
    else clipped = clipped || cur.tokens.length > 0
  }
  return { lines, clipped }
}

/** Measure a single-line string's advance width in local units (no wrapping). */
export function measureText(atlas: FontAtlas, text: string, fontSize: number, letterSpacing = 0): number {
  const scale = fontSize / atlas.manifest.upem
  return tokenWidth(atlas, [...text], scale, letterSpacing * fontSize)
}

/**
 * Lay out a paragraph. Returns packed shader instances plus the measured block box.
 * The block origin (0, 0) is the top-left; +y runs DOWN in the instance data.
 */
export function layoutText(
  atlas: FontAtlas,
  content: string | TextRun[],
  options: LayoutOptions
): TextLayout {
  const fontSize = options.fontSize
  const color = options.color ?? [1, 1, 1, 1]
  const letterSpacing = options.letterSpacing ?? 0
  const lineHeight = options.lineHeight ?? 1.35
  const maxWidth = options.maxWidth ?? Infinity
  const align = options.align ?? 'left'
  const maxLines = options.maxLines ?? Infinity

  const runs: TextRun[] = typeof content === 'string' ? [{ text: content }] : content
  const tokens = tokenize(atlas, runs, { fontSize, color, letterSpacing })
  const { lines, clipped } = breakLines(tokens, maxWidth, maxLines)

  if (clipped && lines.length > 0) {
    // ellipsize the last kept line
    const last = lines[lines.length - 1]
    const size = last.tokens.length ? last.tokens[last.tokens.length - 1].size : fontSize
    const scale = size / atlas.manifest.upem
    const ell: Token = {
      kind: 'word',
      chars: ['…'],
      size,
      color: last.tokens.length ? last.tokens[last.tokens.length - 1].color : color,
      width: tokenWidth(atlas, ['…'], scale, letterSpacing * size),
    }
    while (last.tokens.length && last.width + ell.width > maxWidth) {
      last.width -= last.tokens.pop()!.width
    }
    last.tokens.push(ell)
    last.width += ell.width
  }

  const upem = atlas.manifest.upem
  const ascent = (atlas.manifest.ascender / upem) * fontSize
  const descent = (-atlas.manifest.descender / upem) * fontSize

  let width = 0
  for (const line of lines) width = Math.max(width, line.width)
  if (!isFinite(maxWidth) || width === 0) width = Math.max(width, 0)
  const blockWidth = isFinite(maxWidth) && align !== 'left' ? maxWidth : width

  const floats: number[] = []
  let glyphCount = 0
  let y = 0
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]
    const lineSize = line.size || fontSize
    const baselineY = y + (atlas.manifest.ascender / upem) * lineSize
    let pen =
      align === 'center' ? (blockWidth - line.width) / 2 : align === 'right' ? blockWidth - line.width : 0
    for (const tok of line.tokens) {
      if (tok.kind !== 'word') {
        pen += tok.width
        continue
      }
      const scale = tok.size / upem
      const tracking = letterSpacing * tok.size
      for (let i = 0; i < tok.chars.length; i++) {
        const ch = tok.chars[i]
        if (i > 0) pen += kernOf(atlas, tok.chars[i - 1], ch) * scale
        const g = glyphOf(atlas, ch)
        if (g && g.bandCount > 0) {
          floats.push(
            pen, baselineY, scale, 0,
            g.bbox[0], g.bbox[1], g.bbox[2], g.bbox[3],
            tok.color[0], tok.color[1], tok.color[2], tok.color[3],
            g.rowBase, g.bandCount, g.y0, g.invH
          )
          glyphCount++
        }
        pen += (g?.advance ?? atlas.manifest.spaceAdvance) * scale + tracking
      }
    }
    y += lineHeight * lineSize
  }
  // block height: full line rhythm for all but the last line, ascent+descent for the last
  const lastSize = lines.length ? lines[lines.length - 1].size || fontSize : fontSize
  const height = lines.length ? y - lineHeight * lastSize + ascent + descent : 0

  return {
    instances: new Float32Array(floats),
    glyphCount,
    width: blockWidth,
    height: Math.max(height, 0),
    lineCount: lines.length,
  }
}

export { FLOATS_PER_INSTANCE }
