#!/usr/bin/env node

/**
 * Generate SVG article images and OG cards for the 3 fiction series.
 * Each series has a distinct visual identity:
 *   Threshold: warm golden/amber, organic curves, intimate
 *   Residue: cool blue-gray, geometric/industrial, sparse
 *   Cartography: luminous blue-violet with amber accents, vast/crystalline
 */

import fs from 'fs'
import path from 'path'

const ARTICLES_DIR = path.join(process.cwd(), 'public', 'images', 'articles')
const OG_DIR = path.join(process.cwd(), 'public', 'images', 'og')

// Ensure output dirs exist
for (const dir of [ARTICLES_DIR, OG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// Seeded random for reproducibility per slug
function seededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    return h / 0x7fffffff
  }
}

interface SeriesStyle {
  bgGradient: [string, string]
  accentHues: number[]
  glowColor: string
  lineColor: string
  shapeStyle: 'organic' | 'geometric' | 'crystalline'
  opacity: { shape: number; line: number; glow: number }
}

const SERIES_STYLES: Record<string, SeriesStyle> = {
  threshold: {
    bgGradient: ['hsl(30, 40%, 10%)', 'hsl(35, 50%, 16%)'],
    accentHues: [35, 40, 45, 30, 25],
    glowColor: 'hsl(40, 80%, 55%)',
    lineColor: 'hsl(35, 70%, 55%)',
    shapeStyle: 'organic',
    opacity: { shape: 0.2, line: 0.35, glow: 0.4 },
  },
  residue: {
    bgGradient: ['hsl(210, 25%, 8%)', 'hsl(215, 30%, 14%)'],
    accentHues: [210, 215, 220, 200, 205],
    glowColor: 'hsl(210, 40%, 50%)',
    lineColor: 'hsl(210, 35%, 45%)',
    shapeStyle: 'geometric',
    opacity: { shape: 0.15, line: 0.25, glow: 0.3 },
  },
  cartography: {
    bgGradient: ['hsl(260, 45%, 10%)', 'hsl(270, 50%, 16%)'],
    accentHues: [260, 265, 270, 40, 35],
    glowColor: 'hsl(265, 70%, 60%)',
    lineColor: 'hsl(45, 80%, 60%)',
    shapeStyle: 'crystalline',
    opacity: { shape: 0.18, line: 0.3, glow: 0.45 },
  },
}

function generateOrganicShapes(rand: () => number, w: number, h: number, count: number): string {
  let shapes = ''
  for (let i = 0; i < count; i++) {
    const cx = Math.round(rand() * w)
    const cy = Math.round(rand() * h)
    const rx = Math.round(80 + rand() * 200)
    const ry = Math.round(60 + rand() * 150)
    const rot = Math.round(rand() * 360)
    const hue = 30 + Math.round(rand() * 20)
    const op = (0.08 + rand() * 0.18).toFixed(2)
    shapes += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="hsl(${hue}, 65%, 50%)" opacity="${op}" />\n`
  }
  return shapes
}

function generateGeometricShapes(rand: () => number, w: number, h: number, count: number): string {
  let shapes = ''
  for (let i = 0; i < count; i++) {
    const x = Math.round(rand() * w)
    const y = Math.round(rand() * h)
    const size = Math.round(40 + rand() * 180)
    const hue = 200 + Math.round(rand() * 25)
    const op = (0.06 + rand() * 0.14).toFixed(2)
    if (rand() > 0.5) {
      shapes += `<rect x="${x}" y="${y}" width="${size}" height="${Math.round(size * (0.3 + rand() * 0.7))}" rx="2" fill="hsl(${hue}, 30%, 45%)" opacity="${op}" />\n`
    } else {
      shapes += `<rect x="${x}" y="${y}" width="${size}" height="${Math.round(size * 0.08)}" fill="hsl(${hue}, 30%, 50%)" opacity="${(parseFloat(op) + 0.05).toFixed(2)}" />\n`
    }
  }
  return shapes
}

function generateCrystallineShapes(rand: () => number, w: number, h: number, count: number): string {
  let shapes = ''
  for (let i = 0; i < count; i++) {
    const cx = Math.round(rand() * w)
    const cy = Math.round(rand() * h)
    const size = Math.round(60 + rand() * 200)
    const isAmber = rand() > 0.7
    const hue = isAmber ? 35 + Math.round(rand() * 15) : 255 + Math.round(rand() * 20)
    const sat = isAmber ? 75 : 60
    const light = isAmber ? 55 : 55
    const op = (0.08 + rand() * 0.16).toFixed(2)
    const points: string[] = []
    const sides = 5 + Math.floor(rand() * 4)
    for (let j = 0; j < sides; j++) {
      const angle = (j / sides) * Math.PI * 2 + rand() * 0.5
      const r = size * (0.6 + rand() * 0.4)
      points.push(`${Math.round(cx + Math.cos(angle) * r)},${Math.round(cy + Math.sin(angle) * r)}`)
    }
    shapes += `<polygon points="${points.join(' ')}" fill="hsl(${hue}, ${sat}%, ${light}%)" opacity="${op}" />\n`
  }
  return shapes
}

function generateLines(rand: () => number, style: SeriesStyle, w: number, h: number, count: number): string {
  let lines = ''
  for (let i = 0; i < count; i++) {
    const x1 = Math.round(rand() * w)
    const y1 = Math.round(rand() * h)
    const x2 = Math.round(rand() * w)
    const y2 = Math.round(rand() * h)
    const op = (0.15 + rand() * 0.25).toFixed(2)
    const sw = style.shapeStyle === 'geometric' ? '1' : '2'
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${style.lineColor}" stroke-width="${sw}" opacity="${op}" />\n`
  }
  return lines
}

function generateSVG(slug: string, series: string, w: number, h: number): string {
  const style = SERIES_STYLES[series]
  const rand = seededRandom(slug)

  const shapeCount = 5 + Math.floor(rand() * 3)
  const lineCount = 3 + Math.floor(rand() * 2)
  const glowCx = (0.1 + rand() * 0.4).toFixed(2)
  const glowCy = (0.1 + rand() * 0.4).toFixed(2)

  // Blurred circles for depth
  const blurCircles: string[] = []
  for (let i = 0; i < 4; i++) {
    const cx = Math.round(rand() * w)
    const cy = Math.round(rand() * h)
    const r = Math.round(150 + rand() * 200)
    const hue = style.accentHues[i % style.accentHues.length]
    const op = (0.1 + rand() * 0.2).toFixed(2)
    blurCircles.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="hsl(${hue}, 60%, 45%)" opacity="${op}" />`)
  }

  let shapes = ''
  if (style.shapeStyle === 'organic') shapes = generateOrganicShapes(rand, w, h, shapeCount)
  else if (style.shapeStyle === 'geometric') shapes = generateGeometricShapes(rand, w, h, shapeCount)
  else shapes = generateCrystallineShapes(rand, w, h, shapeCount)

  const lines = generateLines(rand, style, w, h, lineCount)

  // Optional accent rectangle (common in OG pattern)
  const accentX = Math.round(w * 0.55 + rand() * w * 0.3)
  const accentY = Math.round(h * 0.1 + rand() * h * 0.3)
  const accentW = Math.round(150 + rand() * 200)
  const accentH = Math.round(40 + rand() * 60)

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${style.bgGradient[0]}" />
      <stop offset="100%" stop-color="${style.bgGradient[1]}" />
    </linearGradient>
    <radialGradient id="glow" cx="${glowCx}" cy="${glowCy}" r="0.8">
      <stop offset="0%" stop-color="${style.glowColor}" stop-opacity="${style.opacity.glow}" />
      <stop offset="100%" stop-color="${style.glowColor}" stop-opacity="0" />
    </radialGradient>
    <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="30" />
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" />
  <rect width="100%" height="100%" fill="url(#glow)" />
  <g filter="url(#blur)">
${blurCircles.join('\n')}
  </g>
  <g>
${shapes}  </g>
  <g>
${lines}  </g>
  <rect x="${accentX}" y="${accentY}" width="${accentW}" height="${accentH}" rx="20" fill="${style.glowColor}" opacity="0.15" />
</svg>`
}

// ── Article definitions ──
const ARTICLES: Array<{ slug: string; series: string }> = [
  { slug: 'threshold-01-the-last-diagnosis', series: 'threshold' },
  { slug: 'threshold-02-the-closing-window', series: 'threshold' },
  { slug: 'threshold-03-the-weight-of-the-hammer', series: 'threshold' },
  { slug: 'threshold-04-the-student-who-stopped-asking', series: 'threshold' },
  { slug: 'threshold-05-the-beautiful-redundancy', series: 'threshold' },
  { slug: 'residue-01-the-last-prompt-engineer', series: 'residue' },
  { slug: 'residue-02-the-training-data-ghosts', series: 'residue' },
  { slug: 'residue-03-the-deprecated-caretaker', series: 'residue' },
  { slug: 'residue-04-the-analog-holdouts', series: 'residue' },
  { slug: 'residue-05-the-compatibility-museum', series: 'residue' },
  { slug: 'cartography-01-the-unnamed-continent', series: 'cartography' },
  { slug: 'cartography-02-the-isthmus-of-intent', series: 'cartography' },
  { slug: 'cartography-03-the-depth-soundings', series: 'cartography' },
  { slug: 'cartography-04-the-tidal-zone', series: 'cartography' },
  { slug: 'cartography-05-the-atlas-of-disappearances', series: 'cartography' },
]

let articleCount = 0
let ogCount = 0

for (const { slug, series } of ARTICLES) {
  // Article image (1376x768 to match interface series)
  const articleSvg = generateSVG(slug, series, 1376, 768)
  const articlePath = path.join(ARTICLES_DIR, `${slug}.svg`)
  fs.writeFileSync(articlePath, articleSvg)
  articleCount++

  // OG card (1200x630 standard)
  const ogSvg = generateSVG(`${slug}-og`, series, 1200, 630)
  const ogPath = path.join(OG_DIR, `${slug}.svg`)
  fs.writeFileSync(ogPath, ogSvg)
  ogCount++
}

console.log(`Generated ${articleCount} article SVGs in ${ARTICLES_DIR}`)
console.log(`Generated ${ogCount} OG SVGs in ${OG_DIR}`)
console.log('Series visual identities:')
console.log('  Threshold: warm golden/amber, organic ellipses')
console.log('  Residue:   cool blue-gray, geometric rectangles')
console.log('  Cartography: blue-violet + amber, crystalline polygons')
