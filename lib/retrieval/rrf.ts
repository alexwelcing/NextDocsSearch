// Weighted reciprocal rank fusion: score(key) = Σ weight / (k + rank), ranks from 1 within each
// list (a repeated key keeps its first rank). Ties break like searchRecords: title, then slug.
import { compareTitleThenSlug } from '../archive/search'

export const RRF_K = 60

export interface RrfWeights {
  dense: number
  bm25: number
  records: number
}

/** Plan weights: dense and chunk BM25 count fully, record-level searchRecords at half. */
export const RRF_WEIGHTS: Readonly<RrfWeights> = Object.freeze({ dense: 1, bm25: 1, records: 0.5 })

export interface RankedList {
  name: string
  weight: number
  /** Best first. */
  keys: string[]
}

export interface FusedHit {
  key: string
  score: number
}

function byKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function fuseRrf(
  lists: RankedList[],
  options: { k?: number; compare?: (a: string, b: string) => number } = {}
): FusedHit[] {
  const k = options.k ?? RRF_K
  const compare = options.compare ?? byKey
  const scores = new Map<string, number>()
  for (const list of lists) {
    if (!(list.weight > 0)) continue
    const seen = new Set<string>()
    for (const key of list.keys) {
      if (seen.has(key)) continue
      seen.add(key)
      scores.set(key, (scores.get(key) ?? 0) + list.weight / (k + seen.size))
    }
  }
  return [...scores]
    .map(([key, score]) => ({ key, score }))
    .sort((a, b) => b.score - a.score || compare(a.key, b.key))
}

/**
 * searchRecords' order for equal scores (lib/archive/search.ts): title, then slug, then
 * `tieBreak` for keys that share a slug (chunks of one doc pass a numeric comparator). Never date:
 * the archive's dates are largely diegetic, and newest-first lifted future-dated fiction.
 */
export function byTitleThenSlug(
  lookup: (key: string) => { title: string; slug: string } | undefined,
  tieBreak: (a: string, b: string) => number = byKey
) {
  const meta = (key: string) => lookup(key) ?? { title: '', slug: key }
  return (a: string, b: string): number =>
    compareTitleThenSlug(meta(a), meta(b)) || tieBreak(a, b)
}
