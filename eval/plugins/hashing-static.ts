// Example EvalPlugin: a deliberately tiny static embedding model (token-vector lookup + IDF-
// weighted mean pooling, the same shape as a trained static model) whose token vectors come
// from a hash instead of training. It smoke-tests the dense and hybrid paths end to end and is
// the template for a research program's plugin; it is not a retriever worth shipping.
//
//   pnpm exec tsx scripts/eval-retrieval.ts --plugin eval/plugins/hashing-static.ts --out -
import { embedInputs } from '../../lib/retrieval/build'
import type { EvalPlugin } from '../../lib/retrieval/eval'
import { normalizedTokens } from '../../lib/retrieval/tokenize'

const MODEL = 'hash-static-d256'
const DIMS = 256

/** Deterministic ±1 token vector from FNV-1a seeding an xorshift stream. */
function addTokenVector(token: string, weight: number, out: Float32Array) {
  let h = 2166136261
  for (let i = 0; i < token.length; i++) h = Math.imul(h ^ token.charCodeAt(i), 16777619)
  h ||= 1
  for (let d = 0; d < DIMS; d++) {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    out[d] += h & 1 ? weight : -weight
  }
}

const idf = new Map<string, number>()
let unknownIdf = 1

function embed(text: string): Float32Array {
  const vector = new Float32Array(DIMS)
  for (const token of normalizedTokens(text)) {
    addTokenVector(token, idf.get(token) ?? unknownIdf, vector)
  }
  return vector
}

const plugin: EvalPlugin = {
  name: 'hashing-static',
  vectorSources({ built }) {
    const { chunks, chunkerVersion } = built.chunks
    const texts = embedInputs(built.chunks).map((line) => line.text)
    const df = new Map<string, number>()
    for (const text of texts) {
      for (const token of new Set(normalizedTokens(text))) df.set(token, (df.get(token) ?? 0) + 1)
    }
    idf.clear()
    for (const [token, count] of df) idf.set(token, Math.log(1 + chunks.length / count))
    unknownIdf = Math.log(1 + chunks.length)

    const rows = new Float32Array(chunks.length * DIMS)
    texts.forEach((text, i) => rows.set(embed(text), i * DIMS))
    return [
      {
        manifest: {
          model: MODEL,
          dims: DIMS,
          quant: 'f32',
          chunkerVersion,
          hashes: chunks.map((chunk) => chunk.hash),
        },
        bytes: new Uint8Array(rows.buffer),
      },
    ]
  },
  embedders: {
    [MODEL]: async (q: string) => embed(q),
  },
}

export default plugin
