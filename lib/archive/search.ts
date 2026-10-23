import type { ArchiveRecord, SearchHit } from './types'

// Start with Ship's lexical vocabulary/weights. Migrating Ship and changing dock
// ranking are separate changes; both can consume this engine without loading MDX.
const stopWords = new Set([
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
  'alex',
  'welcing',
  'ship',
  'ai',
])

function tokenize(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9]+/))].filter(
    (token) => token.length > 2 && !stopWords.has(token)
  )
}

function scoreField(value: string, terms: string[], weight: number): number {
  const text = value.toLowerCase()
  return terms.reduce((score, term) => score + (text.includes(term) ? weight : 0), 0)
}

function scoreRecord(record: ArchiveRecord, query: string, terms: string[]): number {
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
  if (record.title.toLowerCase().includes(query.trim().toLowerCase())) score += 20
  return score
}

function snippet(record: ArchiveRecord, terms: string[]): string {
  const text = (record.searchText || record.description).replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()
  const positions = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0)
  if (!positions.length) return text.slice(0, 420)
  const match = Math.min(...positions)
  const start = Math.max(0, match - 140)
  const end = Math.min(text.length, match + 320)
  return `${start > 0 ? '... ' : ''}${text.slice(start, end).trim()}${
    end < text.length ? ' ...' : ''
  }`
}

/** Pure lexical ranking over complete records, independent of their transport. */
export function searchRecords(records: ArchiveRecord[], query: string, limit = 30): SearchHit[] {
  const terms = tokenize(query)
  if (!terms.length || limit <= 0 || Number.isNaN(limit)) return []
  const ranked = records
    .map((record) => ({ record, score: scoreRecord(record, query, terms) }))
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
