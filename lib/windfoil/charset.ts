// The character set compiled into every font atlas. Kept as data shared between the build-time
// generator (scripts/generate-font-atlas.ts) and the runtime layout engine (fallback handling).

function range(from: number, to: number): string {
  let s = ''
  for (let c = from; c <= to; c++) s += String.fromCharCode(c)
  return s
}

/** Printable ASCII (space excluded — spaces are advance-only, never drawn). */
const ASCII = range(0x21, 0x7e)

/** Latin-1 supplement letters + punctuation (accents for names/citations, ©®°±µ·×÷ etc.). */
const LATIN1 = range(0xa1, 0xff)

/** Typographic + symbol extras the article corpus and dock UI actually use. */
const EXTRAS = '‐–—‘’‚“”„†‡•…‰′″‹›⁄€™←↑→↓↔⇒∆∑−∙√∞≈≠≤≥▲▶▼◀◆○●★☰⚠✓✗'

export const ATLAS_CHARSET: string = [...new Set([...(ASCII + LATIN1 + EXTRAS)])].join('')

/** Glyph substituted when a character is missing from the atlas. */
export const FALLBACK_CHAR = '?'
