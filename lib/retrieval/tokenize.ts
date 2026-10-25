// One lexical vocabulary for FIND, the chunk BM25 index and record-level ranking. FIND
// (lib/archive/search.ts) re-exports it, so every surface folds, splits and matches identically.

/** Bumped whenever foldText, normalizedTokens or the matching rules below change. */
export const TOKENIZER_VERSION = 'archive-v2'

const stopWords = new Set([
  'am',
  'an',
  'as',
  'at',
  'be',
  'by',
  'do',
  'he',
  'if',
  'in',
  'is',
  'it',
  'me',
  'my',
  'no',
  'of',
  'on',
  'or',
  'so',
  'to',
  'up',
  'we',
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'into',
  'your',
  'have',
  'what',
  'about',
  'would',
  'there',
  'their',
  'them',
  'then',
  'when',
  'where',
  'which',
  'while',
  'were',
  'been',
  'will',
  'just',
  'like',
  'than',
  'they',
])

// Nothing in General Punctuation (dashes, quotes, ellipses, spaces) folds into a word character,
// so text that is otherwise ASCII (most of the archive) skips normalization.
const NEEDS_FOLD = /[^\x00-\x7f\u2000-\u206f]/
// Symbols never belong to a word, and NFKD would otherwise spell some out ('Pro™' → 'protm').
const SYMBOL = /\p{S}/gu
const MARKS = /\p{M}+/gu
// Latin letters with no Unicode decomposition, folded the way they are typed in ASCII.
const LETTER_FOLDS: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
  ı: 'i',
}
const UNDECOMPOSED = /[ßæœøłđðþı]/g
const WORD_CHAR = /[\p{L}\p{N}]/u
const NON_WORD = /[^\p{L}\p{N}]+/u

/**
 * The search form of a text: lowercased, NFKD with combining marks stripped, so 'Tomáš', 'Tūhoe'
 * and 'Solène' read as 'tomas', 'tuhoe' and 'solene'. findMatch positions index this form, which
 * keeps the input's length except around folds that expand or drop characters (ß, ligatures,
 * already-decomposed input).
 */
export function foldText(value: string): string {
  if (!NEEDS_FOLD.test(value)) return value.toLowerCase()
  return value
    .replace(SYMBOL, (symbol) => ' '.repeat(symbol.length))
    .normalize('NFKD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(UNDECOMPOSED, (letter) => LETTER_FOLDS[letter])
}

/** Folded words (letters and digits of any script) of 2+ characters, minus stop words. */
export function normalizedTokens(value: string): string[] {
  return foldText(value)
    .split(NON_WORD)
    .filter((token) => token.length >= 2 && !stopWords.has(token))
}

/** The unique query terms FIND and BM25 rank on. */
export function queryTerms(query: string): string[] {
  return [...new Set(normalizedTokens(query))]
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && WORD_CHAR.test(char)
}

/**
 * Where query term `term` occurs in `text` (already folded by foldText), or -1. Short terms are
 * whole words; longer terms also match a word as it is typed.
 */
export function findMatch(text: string, term: string): number {
  let index = text.indexOf(term)
  while (index >= 0) {
    const startsWord = !isWordChar(text[index - 1])
    const endsWord = !isWordChar(text[index + term.length])
    if (startsWord && (term.length > 2 || endsWord)) return index
    index = text.indexOf(term, index + 1)
  }
  return -1
}

/**
 * findMatch semantics over a sorted vocabulary: two-character terms match whole words only
 * ('ai' never hits 'said' or 'aim'), longer terms also match any word they prefix ('agent' hits
 * 'agents' and 'agentic'). Returns the [start, end) range of matching vocabulary entries.
 * One known gap: the vocabulary has no stop words, so a partial query term that only prefixes
 * a stop word ('ther' → 'there') matches in findMatch but not here.
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
