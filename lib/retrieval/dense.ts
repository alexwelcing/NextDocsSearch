// Brute-force top-k over an int8 row matrix of any dims. Rows are L2-normalized before
// quantization, so scale * (q · row) approximates the cosine against a normalized query.
import { decodeInt8Rows, truncateNormalize, type Int8RowMatrix } from './quantize'
import type { VectorSetEntry } from './types'

export interface DenseHit {
  row: number
  score: number
}

function byScore(a: DenseHit, b: DenseHit): number {
  return b.score - a.score || a.row - b.row
}

/**
 * Score every present row and keep the best `limit` at or above `floor`. A longer query vector
 * is Matryoshka-truncated to the matrix dims; a shorter one is a model mismatch and throws.
 */
export function denseTopK(
  matrix: Int8RowMatrix,
  query: ArrayLike<number>,
  limit = 50,
  floor = -Infinity
): DenseHit[] {
  const { rows, dims, data, scales } = matrix
  const q = truncateNormalize(query, dims)
  const hits: DenseHit[] = []
  if (!(limit > 0)) return hits
  for (let row = 0; row < rows; row++) {
    const scale = scales[row]
    if (!scale) continue
    let dot = 0
    const offset = row * dims
    for (let i = 0; i < dims; i++) dot += q[i] * data[offset + i]
    const score = dot * scale
    if (!(score >= floor)) continue
    if (hits.length < limit) {
      hits.push({ row, score })
      if (hits.length === limit) hits.sort(byScore)
    } else if (score > hits[limit - 1].score) {
      // Insert into the sorted window; limit is small, so a linear shift is cheapest.
      let i = limit - 1
      while (i > 0 && hits[i - 1].score < score) {
        hits[i] = hits[i - 1]
        i--
      }
      hits[i] = { row, score }
    }
  }
  return hits.sort(byScore)
}

/** Decode a built vector set, checking it against its manifest entry and the chunk count. */
export function decodeVectorSet(
  entry: VectorSetEntry,
  bytes: ArrayBuffer | Uint8Array,
  rows: number
): Int8RowMatrix {
  if (entry.quant !== 'int8-row') throw new Error(`vectors: unsupported quant ${entry.quant}`)
  if (entry.rows !== rows) throw new Error(`vectors: ${entry.rows} rows for ${rows} chunks`)
  return decodeInt8Rows(bytes, entry.rows, entry.dims)
}
