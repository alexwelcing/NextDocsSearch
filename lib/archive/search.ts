import type { ArchiveRecord, SearchHit } from './types'

// Shared lexical vocabulary and field weights; consumers never need to load MDX.
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

/** Lowercased alphanumeric words of 2+ characters, minus stop words; shared with lib/retrieval. */
export function normalizedTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !stopWords.has(token))
}

/** The unique query terms searchRecords ranks on. */
export function tokenize(query: string): string[] {
  return [...new Set(normalizedTokens(query))]
}

/** Short terms are whole words; longer terms also match a word as it is typed. */
export function findMatch(text: string, term: string): number {
  let index = text.indexOf(term)
  while (index >= 0) {
    const startsWord = index === 0 || !/[a-z0-9]/.test(text[index - 1])
    const endsWord = !/[a-z0-9]/.test(text[index + term.length] ?? '')
    if (startsWord && (term.length > 2 || endsWord)) return index
    index = text.indexOf(term, index + 1)
  }
  return -1
}

function scoreField(value: string, terms: string[], weight: number): number {
  const text = value.toLowerCase()
  return terms.reduce((score, term) => score + (findMatch(text, term) >= 0 ? weight : 0), 0)
}

function scoreRecord(record: ArchiveRecord, terms: string[]): number {
  let score =
    scoreField(record.title, terms, 9) +
    scoreField(record.description, terms, 5) +
    scoreField(record.searchText, terms, 2) +
    scoreField(record.slug, terms, 4) +
    scoreField(record.type, terms, 2) +
    scoreField(record.date, terms, 1)
  for (const [values, weight] of [
    [record.keywords, 7],
    [record.domains, 5],
    [record.mechanics, 3],
  ] as const) {
    score += values.reduce((sum, value) => sum + scoreField(value, terms, weight), 0)
  }
  // Use the same normalized query as field scoring, with complete token boundaries.
  const title = ` ${normalizedTokens(record.title).join(' ')} `
  if (title.includes(` ${terms.join(' ')} `)) score += 20
  return score
}

function snippet(record: ArchiveRecord, terms: string[]): string {
  const candidates = [
    record.searchText,
    record.description,
    [...record.keywords, ...record.domains, ...record.mechanics].join(' '),
  ].map((value) => value.replace(/\s+/g, ' ').trim())

  for (const text of candidates) {
    const lower = text.toLowerCase()
    const positions = terms.map((term) => findMatch(lower, term)).filter((index) => index >= 0)
    if (!positions.length) continue
    const match = Math.min(...positions)
    // Keep the match visible in the dock's compact selected-result preview.
    const start = Math.max(0, match - 48)
    const end = Math.min(text.length, match + 320)
    return `${start > 0 ? '... ' : ''}${text.slice(start, end).trim()}${
      end < text.length ? ' ...' : ''
    }`
  }

  return (candidates[0] || candidates[1]).slice(0, 420)
}

/** Pure lexical ranking over complete records, independent of their transport. */
export function searchRecords(records: ArchiveRecord[], query: string, limit = 30): SearchHit[] {
  const terms = tokenize(query)
  if (!terms.length || limit <= 0 || Number.isNaN(limit)) return []
  const ranked = records
    .map((record) => ({ record, score: scoreRecord(record, terms) }))
    .filter((hit) => hit.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.record.date.localeCompare(a.record.date) ||
        a.record.slug.localeCompare(b.record.slug)
    )
  const seen = new Set<string>()
  return ranked
    .filter(({ record }) => {
      if (seen.has(record.slug)) return false
      seen.add(record.slug)
      return true
    })
    .slice(0, limit)
    .map((hit) => ({ ...hit, snippet: snippet(hit.record, terms) }))
}
