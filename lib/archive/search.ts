import { searchBm25 } from '../retrieval/bm25'
import type { CoreIndex } from '../retrieval/load'
import {
  findMatch,
  foldText,
  foldWithOffsets,
  normalizedTokens,
  queryTerms,
  type FoldedText,
} from '../retrieval/tokenize'
import type { ArchiveRecord, SearchHit } from './types'

// FIND's vocabulary is lib/retrieval/tokenize.ts, shared with the chunk BM25F index, so both
// rankers fold diacritics, split words and match prefixes identically.
export { findMatch, foldText, normalizedTokens, queryTerms as tokenize }

/** A record in search form, folded once per record object (records are never mutated). */
interface SearchForm {
  /** Folded field values with their weights; list fields contribute one entry per value. */
  fields: [string, number][]
  /** The title's tokens, space-delimited, for the exact-phrase bonus. */
  title: string
  /** Snippet sources, whitespace-collapsed, with their folded forms; built on first use. */
  previews?: Preview[]
}

interface Preview extends FoldedText {
  text: string
}

const searchForms = new WeakMap<ArchiveRecord, SearchForm>()

function searchForm(record: ArchiveRecord): SearchForm {
  let form = searchForms.get(record)
  if (!form) {
    const weighted = (values: string[], weight: number) =>
      values.map((value): [string, number] => [value, weight])
    const fields: [string, number][] = [
      [record.title, 9],
      [record.description, 5],
      [record.searchText, 2],
      [record.slug, 4],
      [record.type, 2],
      [record.date, 1],
      ...weighted(record.keywords, 7),
      ...weighted(record.domains, 5),
      ...weighted(record.mechanics, 3),
    ]
    form = {
      fields: fields.map(([value, weight]) => [foldText(value), weight]),
      title: ` ${normalizedTokens(record.title).join(' ')} `,
    }
    searchForms.set(record, form)
  }
  return form
}

function scoreRecord(record: ArchiveRecord, terms: string[]): number {
  const form = searchForm(record)
  let score = 0
  for (const [text, weight] of form.fields) {
    for (const term of terms) if (findMatch(text, term) >= 0) score += weight
  }
  // Use the same normalized query as field scoring, with complete token boundaries.
  if (form.title.includes(` ${terms.join(' ')} `)) score += 20
  return score
}

function preview(value: string): Preview {
  const text = value.replace(/\s+/g, ' ').trim()
  return { text, ...foldWithOffsets(text) }
}

/** `passage`, when given, is searched first: the chunk that matched in the full-text index. */
function snippet(record: ArchiveRecord, terms: string[], passage = ''): string {
  const form = searchForm(record)
  form.previews ??= [
    record.searchText,
    record.description,
    [...record.keywords, ...record.domains, ...record.mechanics].join(' '),
  ].map(preview)
  const candidates = passage ? [preview(passage), ...form.previews] : form.previews

  for (const { text, folded, offsets } of candidates) {
    const positions = terms.map((term) => findMatch(folded, term)).filter((index) => index >= 0)
    if (!positions.length) continue
    const match = Math.min(...positions)
    // Keep the match visible in the dock's compact selected-result preview; the window is cut
    // in folded positions and mapped back to the text's own.
    const at = (index: number) => (offsets ? offsets[index] : index)
    const start = at(Math.max(0, match - 48))
    const end = at(Math.min(folded.length, match + 320))
    return `${start > 0 ? '... ' : ''}${text.slice(start, end).trim()}${
      end < text.length ? ' ...' : ''
    }`
  }

  return (candidates[0].text || candidates[1].text).slice(0, 420)
}

/**
 * Equal scores order by title, then slug, and never by date: the archive's dates are largely
 * diegetic (fiction set in 2067), so a newest-first tiebreak lifted future-dated stories over
 * real research. Shared with Ship's RRF (lib/retrieval/rrf.ts).
 */
export function compareTitleThenSlug(
  a: { title: string; slug: string },
  b: { title: string; slug: string }
): number {
  return a.title.localeCompare(b.title, 'en') || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)
}

type Ranked = { record: ArchiveRecord; score: number }

const byScore = (a: Ranked, b: Ranked) =>
  b.score - a.score || compareTitleThenSlug(a.record, b.record)

/** Records matching any term, best first, once per slug. */
function rankRecords(records: ArchiveRecord[], terms: string[]): Ranked[] {
  const ranked = records
    .map((record) => ({ record, score: scoreRecord(record, terms) }))
    .filter((hit) => hit.score > 0)
    .sort(byScore)
  const seen = new Set<string>()
  return ranked.filter(({ record }) => {
    if (seen.has(record.slug)) return false
    seen.add(record.slug)
    return true
  })
}

/** Pure lexical ranking over complete records, independent of their transport. */
export function searchRecords(records: ArchiveRecord[], query: string, limit = 30): SearchHit[] {
  const terms = queryTerms(query)
  if (!terms.length || limit <= 0 || Number.isNaN(limit)) return []
  return rankRecords(records, terms)
    .slice(0, limit)
    .map((hit) => ({ ...hit, snippet: snippet(hit.record, terms) }))
}

/**
 * FIND over the full-text chunk BM25F index (scripts/generate-search-index.ts): each record ranks
 * by its best chunk, so a match anywhere in an article counts, not only in the manifest's
 * searchText preview, and the snippet comes from that chunk. Only slugs in `records` are returned
 * (the index also holds the operator panels, which FIND does not list).
 *
 * The index holds text, not the record metadata searchRecords also scores (articleType,
 * mechanics, slug, date), so the records only searchRecords matches follow every full-text hit,
 * in its order and with its scores: FIND still finds everything it did before the index. Indexing
 * that metadata on the cards instead would raise the document frequency of heuristic mechanic
 * words ('governance' is tagged on 148 records), lowering their IDF in every chunk, Ship's too.
 */
export function searchFullText(
  index: CoreIndex,
  records: ArchiveRecord[],
  query: string,
  limit = 30
): SearchHit[] {
  const terms = queryTerms(query)
  if (!terms.length || limit <= 0 || Number.isNaN(limit)) return []
  const bySlug = new Map(records.map((record) => [record.slug, record]))
  const best = new Map<string, Ranked & { chunk: number }>()
  // Chunk hits arrive best first, so the first chunk seen for a slug is that record's best.
  for (const { doc: chunk, score } of searchBm25(index.bm25, query, index.chunks.length)) {
    const slug = index.docs[index.chunks[chunk].doc].slug
    const record = bySlug.get(slug)
    if (record && !best.has(slug)) best.set(slug, { record, score, chunk })
  }
  const hits: SearchHit[] = [...best.values()]
    .sort(byScore)
    .slice(0, limit)
    .map(({ record, score, chunk }) => ({
      record,
      score,
      snippet: snippet(record, terms, index.chunks[chunk].text),
    }))
  if (hits.length < limit) {
    for (const hit of rankRecords(records, terms)) {
      if (best.has(hit.record.slug)) continue
      hits.push({ ...hit, snippet: snippet(hit.record, terms) })
      if (hits.length >= limit) break
    }
  }
  return hits
}
