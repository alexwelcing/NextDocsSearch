// Row-band acceleration structure (port of upstream windfoil src/bands.js).
//
// Each glyph's monotone pieces are filed into horizontal row bands — the structure the fragment
// shader gathers over. A piece is duplicated into every band its y-extent touches, under the same
// `floor((y − y0)·invH)` mapping the shader selects with. Long bands are sorted by hull x-max so
// the shader can stop at the first piece fully left of the pixel. Each band also carries the exact
// winding integral of its y-strip plus its ink hull in x, which the shader's minification guard
// renders from when a glyph is only a few pixels tall.

// Aim for ~this many pieces per band before y-overlap duplication (upstream-tuned).
const TARGET_PER_BAND = 10
const MAX_BANDS = 64
// Bands with MORE than this many pieces are x-sorted (hull x-max, descending). MUST equal
// SORT_MIN in the WGSL — the shader only breaks early on bands it assumes are sorted.
export const BAND_SORT_MIN = 4

export interface BandHeader {
  rowBase: number
  bandCount: number
  y0: number
  invH: number
}

function chooseBands(pieceCount: number, targetPerBand: number): number {
  if (pieceCount <= targetPerBand) return 1
  return Math.min(Math.ceil(pieceCount / targetPerBand), MAX_BANDS)
}

// The band index a y-value maps to: floor((y − y0)·invH) clamped to [0, R−1].
function bandIndex(y: number, y0: number, invH: number, R: number): number {
  if (invH <= 0) return 0
  return Math.min(Math.max(Math.floor((y - y0) * invH), 0), R - 1)
}

// Solve the monotone quadratic component a·t² + b·t + e0 = v on [0, 1] (f64 twin of the shader's
// mono_root): saturate to the endpoint if the piece starts past / never reaches v, else take the
// branch whose derivative sign matches `rising`.
function monoRootT(a: number, b: number, e0: number, e1: number, v: number, rising: boolean) {
  if (rising ? e0 >= v : e0 <= v) return 0
  if (rising ? e1 <= v : e1 >= v) return 1
  const c = e0 - v
  if (Math.abs(a) < 1e-12 * Math.max(Math.abs(b), 1)) return Math.min(Math.max(-c / b, 0), 1)
  const disc = Math.max(b * b - 4 * a * c, 0)
  const q = -0.5 * (b + Math.sign(b || 1) * Math.sqrt(disc))
  const r1 = q / a
  const r2 = q !== 0 ? c / q : 0
  const want = rising ? 1 : -1
  const t = (2 * a * r1 + b) * want >= 0 ? r1 : r2
  return Math.min(Math.max(t, 0), 1)
}

// Exact winding integral ∫∫_strip w dA of one band's pieces over its y-strip [b0, b1]. Each piece
// contributes ∫ (x(t) − x0)·y′(t) dt over the t-range where y(t) ∈ [b0, b1] — a quartic
// antiderivative, exact in f64. Windows tile across bands, so duplicated pieces never double-count.
function bandWindingArea(pieces: number[], bucket: number[], x0: number, b0: number, b1: number) {
  let area = 0
  for (const k of bucket) {
    const p = k * 6
    const X0 = pieces[p]
    const Y0 = pieces[p + 1]
    const CX = pieces[p + 2]
    const CY = pieces[p + 3]
    const X1 = pieces[p + 4]
    const Y1 = pieces[p + 5]
    const lo = Math.max(b0, Math.min(Y0, Y1))
    const hi = Math.min(b1, Math.max(Y0, Y1))
    if (hi <= lo) continue
    const rising = Y1 >= Y0
    const ay = Y0 - 2 * CY + Y1
    const by = 2 * (CY - Y0)
    const tA = monoRootT(ay, by, Y0, Y1, rising ? lo : hi, rising)
    const tB = monoRootT(ay, by, Y0, Y1, rising ? hi : lo, rising)
    if (tB <= tA) continue
    const ax = X0 - 2 * CX + X1
    const bx = 2 * (CX - X0)
    const cx = X0 - x0
    // (ax·t² + bx·t + cx)·(2·ay·t + by), integrated term-by-term
    const c3 = 2 * ax * ay
    const c2 = ax * by + 2 * bx * ay
    const c1 = bx * by + 2 * cx * ay
    const c0 = cx * by
    const F = (t: number) => (((c3 / 4) * t + c2 / 3) * t + c1 / 2) * t * t + c0 * t
    area += F(tB) - F(tA)
  }
  return area
}

// Bit-pun an f32 into a u32 so the area/hull floats ride in the (integer) row table.
const punBuf = new DataView(new ArrayBuffer(4))
function f32bits(v: number): number {
  punBuf.setFloat32(0, Math.fround(v), true)
  return punBuf.getUint32(0, true)
}

/**
 * File a shape's monotone `pieces` (flat 6-float runs) into row bands over [y0, y1], appending the
 * band-duplicated pieces to `curveOut` and each band's [start, count, areaBits, xMinBits, xMaxBits]
 * to `rowOut`. Returns the band header the shader reads (rowBase in row-quintuple units).
 */
export function bandPieces(
  pieces: number[],
  y0: number,
  y1: number,
  curveOut: number[],
  rowOut: number[],
  targetPerBand = TARGET_PER_BAND
): BandHeader {
  const n = pieces.length / 6
  const R = chooseBands(n, targetPerBand)
  const invH = R > 1 && y1 > y0 ? R / (y1 - y0) : 0

  const buckets: number[][] = Array.from({ length: R }, () => [])
  let xLeft = Infinity // x reference for winding areas (any constant works for closed contours)
  for (let k = 0; k < n; k++) {
    const yLo = Math.min(pieces[k * 6 + 1], pieces[k * 6 + 3], pieces[k * 6 + 5])
    const yHi = Math.max(pieces[k * 6 + 1], pieces[k * 6 + 3], pieces[k * 6 + 5])
    const lo = bandIndex(yLo, y0, invH, R)
    const hi = bandIndex(yHi, y0, invH, R)
    for (let b = lo; b <= hi; b++) buckets[b].push(k)
    xLeft = Math.min(xLeft, pieces[k * 6], pieces[k * 6 + 2], pieces[k * 6 + 4])
  }

  const rowBase = rowOut.length / 5
  const bandH = R > 1 ? (y1 - y0) / R : y1 - y0
  const xMax = (k: number) => Math.max(pieces[k * 6], pieces[k * 6 + 2], pieces[k * 6 + 4])
  const xMin = (k: number) => Math.min(pieces[k * 6], pieces[k * 6 + 2], pieces[k * 6 + 4])
  for (let b = 0; b < R; b++) {
    const bucket = buckets[b]
    if (bucket.length > BAND_SORT_MIN) bucket.sort((a, c) => xMax(c) - xMax(a))
    const start = curveOut.length / 6
    let bxMin = 3e38 // empty band ⇒ inverted far sentinels — the skip tests see "no ink"
    let bxMax = -3e38 // (finite, since WGSL implementations may assume floats are finite)
    for (const k of bucket) {
      for (let j = 0; j < 6; j++) curveOut.push(pieces[k * 6 + j])
      bxMin = Math.min(bxMin, xMin(k))
      bxMax = Math.max(bxMax, xMax(k))
    }
    const area = n ? bandWindingArea(pieces, bucket, xLeft, y0 + b * bandH, y0 + (b + 1) * bandH) : 0
    rowOut.push(start, bucket.length, f32bits(area), f32bits(bxMin), f32bits(bxMax))
  }
  return { rowBase, bandCount: R, y0, invH }
}
