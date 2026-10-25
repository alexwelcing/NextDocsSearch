// Chunk-level BM25F over precomputed postings. Tokens and term matching are FIND's
// (lib/archive/search.ts), so a term matches a chunk here exactly when findMatch would.
import { matchingTermRange, normalizedTokens, queryTerms, TOKENIZER_VERSION } from './tokenize'
import type { Bm25File, Bm25FieldName } from './types'

export const BM25_FIELDS: Bm25FieldName[] = ['title', 'heading', 'keywords', 'body', 'doc2query']

export const BM25_WEIGHTS: Record<Bm25FieldName, number> = {
  title: 3,
  heading: 2,
  keywords: 2,
  body: 1,
  doc2query: 1.5,
}

export const BM25_PARAMS = { k1: 1.2, b: 0.75 } as const

export type Bm25Fields = Partial<Record<Bm25FieldName, string>>

/** Build the serialized postings for documents in index order. */
export function buildBm25(docs: Bm25Fields[]): Bm25File {
  const fieldCount = BM25_FIELDS.length
  const lengths: number[] = new Array(docs.length * fieldCount).fill(0)
  const byTerm = new Map<string, number[]>()

  docs.forEach((fields, doc) => {
    BM25_FIELDS.forEach((field, f) => {
      const tokens = normalizedTokens(fields[field] ?? '')
      lengths[doc * fieldCount + f] = tokens.length
      const counts = new Map<string, number>()
      for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
      for (const [token, tf] of counts) {
        let list = byTerm.get(token)
        if (!list) byTerm.set(token, (list = []))
        list.push(doc, tf * 8 + f)
      }
    })
  })

  const terms = [...byTerm.keys()].sort()
  const postings = terms.map((term) => {
    const list = byTerm.get(term) as number[]
    let previous = 0
    for (let i = 0; i < list.length; i += 2) {
      const doc = list[i]
      list[i] = doc - previous
      previous = doc
    }
    return list
  })
  // Average each field over the chunks that have it. Keywords live only on cards (and doc2query
  // only where it is filled), so an all-chunk average would inflate every norm for that field
  // and undo its weight: a typical card's keywords norm came out near 6, making ×2 act like ×0.3.
  const avgLengths = BM25_FIELDS.map((_, f) => {
    let total = 0
    let present = 0
    for (let doc = 0; doc < docs.length; doc++) {
      const length = lengths[doc * fieldCount + f]
      total += length
      if (length > 0) present++
    }
    return present ? total / present : 0
  })

  return {
    schema: 1,
    tokenizer: TOKENIZER_VERSION,
    ...BM25_PARAMS,
    fields: BM25_FIELDS,
    weights: BM25_FIELDS.map((field) => BM25_WEIGHTS[field]),
    docs: docs.length,
    lengths,
    avgLengths,
    terms,
    postings,
  }
}

export interface Bm25Index {
  file: Bm25File
  /**
   * Per doc and field: 1 - b + b * length / avgLength, where avgLength is over the docs that have
   * the field (0 marks a field empty everywhere).
   */
  norms: Float64Array
}

export function loadBm25(file: Bm25File): Bm25Index {
  const fieldCount = file.fields?.length ?? 0
  if (
    file.schema !== 1 ||
    file.tokenizer !== TOKENIZER_VERSION ||
    !fieldCount ||
    fieldCount > 8 ||
    file.weights.length !== fieldCount ||
    file.lengths.length !== file.docs * fieldCount ||
    file.postings.length !== file.terms.length
  ) {
    throw new Error('bm25: incompatible index')
  }
  const norms = new Float64Array(file.lengths.length)
  for (let doc = 0; doc < file.docs; doc++) {
    for (let f = 0; f < fieldCount; f++) {
      const avg = file.avgLengths[f]
      const i = doc * fieldCount + f
      norms[i] = avg > 0 ? 1 - file.b + (file.b * file.lengths[i]) / avg : 0
    }
  }
  return { file, norms }
}

export interface Bm25Hit {
  doc: number
  score: number
}

/** Best-first chunk hits; a query with no usable terms returns []. */
export function searchBm25(index: Bm25Index, query: string, limit = 50): Bm25Hit[] {
  const { file, norms } = index
  const fieldCount = file.fields.length
  const scores = new Float64Array(file.docs)
  const touched = new Set<number>()

  for (const term of queryTerms(query)) {
    const [start, end] = matchingTermRange(file.terms, term)
    if (start === end) continue
    // Prefix expansions count as one term: summed field-weighted tf, union df.
    const weighted = new Map<number, number>()
    for (let t = start; t < end; t++) {
      const list = file.postings[t]
      let doc = 0
      for (let i = 0; i < list.length; i += 2) {
        doc += list[i]
        const f = list[i + 1] & 7
        const norm = norms[doc * fieldCount + f]
        if (!norm) continue
        const tf = list[i + 1] >>> 3
        weighted.set(doc, (weighted.get(doc) ?? 0) + (file.weights[f] * tf) / norm)
      }
    }
    const df = weighted.size
    const idf = Math.log(1 + (file.docs - df + 0.5) / (df + 0.5))
    for (const [doc, tf] of weighted) {
      scores[doc] += (idf * tf * (file.k1 + 1)) / (file.k1 + tf)
      touched.add(doc)
    }
  }

  return [...touched]
    .map((doc) => ({ doc, score: scores[doc] }))
    .sort((a, b) => b.score - a.score || a.doc - b.doc)
    .slice(0, Math.max(0, limit))
}
