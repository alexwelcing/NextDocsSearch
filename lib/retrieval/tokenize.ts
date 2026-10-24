// One lexical vocabulary for FIND, the chunk BM25 index and record-level ranking: the
// tokenizer lives in lib/archive/search.ts and is only re-exported here.
import { findMatch, normalizedTokens, tokenize as queryTerms } from '../archive/search'

export { findMatch, normalizedTokens, queryTerms }

/** Bumped whenever normalizedTokens or the matching rules below change. */
export const TOKENIZER_VERSION = 'archive-v1'

/**
 * findMatch semantics over a sorted vocabulary: two-character terms match whole words only
 * ('ai' never hits 'said' or 'aim'), longer terms also match any word they prefix ('agent' hits
 * 'agents' and 'agentic'). Returns the [start, end) range of matching vocabulary entries.
 */
export function matchingTermRange(sortedTerms: string[], term: string): [number, number] {
  let lo = 0
  let hi = sortedTerms.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sortedTerms[mid] < term) lo = mid + 1
    else hi = mid
  }
  if (term.length <= 2) return sortedTerms[lo] === term ? [lo, lo + 1] : [lo, lo]
  let end = lo
  while (end < sortedTerms.length && sortedTerms[end].startsWith(term)) end++
  return [lo, end]
}
