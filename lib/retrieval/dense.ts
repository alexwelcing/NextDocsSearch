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
 * Why `vector` cannot be scanned against `set`, or null when it can. Its length must equal the
 * set's dims, unless the set is Matryoshka (`mrl`) and the vector longer. A static model returns
 * all zeros for a stop-word-only or all-unknown-token query: that is no dense signal, not a
 * ranking, and neither is a non-finite vector.
 */
export function queryVectorProblem(
  vector: ArrayLike<number>,
  set: Pick<VectorSetEntry, 'dims' | 'mrl'>
): string | null {
  if (vector.length < set.dims || (vector.length > set.dims && !set.mrl)) {
    return (
      `query vector has ${vector.length} dims, the vector set has ${set.dims}` +
      (vector.length > set.dims ? ' and is not Matryoshka' : '')
    )
  }
  let sum = 0
  for (let i = 0; i < set.dims; i++) {
    if (!Number.isFinite(vector[i])) return 'query vector is not finite'
    sum += vector[i] * vector[i]
  }
  if (!Number.isFinite(sum)) return 'query vector is not finite'
  return sum > 0 ? null : 'empty query embedding'
}

/**
 * Score every present row and keep the best `limit` at or above `floor`. A longer query vector
 * is truncated to the matrix dims (callers check queryVectorProblem against the set first); a
 * shorter one throws. A zero query returns no hits: every row would tie at 0, and ranking on that
 * surfaces the first rows in index order.
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
  if (!(limit > 0) || q.every((value) => value === 0)) return hits
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
