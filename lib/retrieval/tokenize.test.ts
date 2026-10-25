import { describe, expect, it } from 'vitest'
import * as find from '../archive/search'
import { buildBm25, loadBm25, searchBm25 } from './bm25'
import {
  TOKENIZER_VERSION,
  findMatch,
  foldText,
  matchingTermRange,
  normalizedTokens,
  queryTerms,
} from './tokenize'

describe('foldText', () => {
  it('strips diacritics so accented names read as whole ASCII words', () => {
    expect(foldText('Tomáš, Tūhoe and Solène')).toBe('tomas, tuhoe and solene')
    expect(foldText('Māori, Ngũgĩ, Kovačević, Hôpital, São Paulo')).toBe(
      'maori, ngugi, kovacevic, hopital, sao paulo'
    )
  })

  it('folds Latin letters that have no Unicode decomposition', () => {
    expect(foldText('Tromsø, Łódź, Straße, Æsir, Œuvre')).toBe('tromso, lodz, strasse, aesir, oeuvre')
  })

  it('treats precomposed and combining-mark spellings the same', () => {
    expect(foldText('Solène')).toBe('solene')
    expect(foldText('Solène')).toBe('solene')
  })

  it('applies compatibility folds without gluing symbols onto words', () => {
    expect(foldText('ＡＩ ﬁeld')).toBe('ai field')
    expect(foldText('Pro™ suite')).toBe('pro  suite')
    expect(normalizedTokens('Pro™ suite ✅ done')).toEqual(['pro', 'suite', 'done'])
  })

  it('only lowercases ASCII and keeps a folded string the same length', () => {
    expect(foldText('AI-Driven VR, v2')).toBe('ai-driven vr, v2')
    // General Punctuation never folds into a word, so it takes the same fast path.
    expect(foldText('Dashes—“Quotes”… ‘End’')).toBe('dashes—“quotes”… ‘end’')
    expect(normalizedTokens('Dashes—“Quotes”… ‘End’')).toEqual(['dashes', 'quotes', 'end'])
    expect(normalizedTokens('Dashes—“Quotes”… ‘End’ é')).toEqual(['dashes', 'quotes', 'end'])
    for (const text of ['Tomáš Horák', 'Solène ✅ Tūhoe', 'naïve café']) {
      expect(foldText(text)).toHaveLength(text.length)
    }
  })
})

describe('normalizedTokens', () => {
  it('keeps accented names whole instead of splitting them at the accent', () => {
    // The archive-v1 tokenizer split on [^a-z0-9]: Solène → 'sol', 'ne'; Tomáš → 'tom'.
    expect(normalizedTokens('Solène met Tomáš and the Tūhoe elders')).toEqual([
      'solene',
      'met',
      'tomas',
      'tuhoe',
      'elders',
    ])
  })

  it('keeps words of other scripts whole', () => {
    expect(normalizedTokens('latency in μs, λόγος')).toEqual(['latency', 'μs', 'λογος'])
  })

  it('dedupes accented and plain spellings into one query term', () => {
    expect(queryTerms('Tomáš tomas TOMAS')).toEqual(['tomas'])
  })
})

describe('findMatch over folded text', () => {
  it('finds accented names by their plain spelling and as they are typed', () => {
    const text = foldText('Notes from Tomáš Horák and Solène.')
    expect(findMatch(text, 'tomas')).toBe(11)
    expect(findMatch(text, 'horak')).toBe(17)
    expect(findMatch(text, 'sol')).toBe(27)
  })

  it('treats folded letters as part of the word', () => {
    // 'ne' was a whole word inside the archive-v1 split of Solène; now it is not.
    expect(findMatch(foldText('Solène'), 'ne')).toBe(-1)
    expect(findMatch(foldText('naïve'), 'ai')).toBe(-1)
    expect(findMatch(foldText('latency in μs'), 'μs')).toBe(11)
  })
})

describe('FIND and the BM25 index share one tokenizer', () => {
  it('is the very same set of functions', () => {
    expect(find.normalizedTokens).toBe(normalizedTokens)
    expect(find.findMatch).toBe(findMatch)
    expect(find.foldText).toBe(foldText)
    expect(find.tokenize).toBe(queryTerms)
    expect(TOKENIZER_VERSION).toBe('archive-v2')
  })

  it.each(['Solène', 'solene', 'SOLENE', 'Solène', 'sol'])(
    "finds the Solène record for '%s' in both rankers",
    (query) => {
      const records = [
        { slug: 'other', title: 'Other', searchText: 'A sol-gel process.' },
        { slug: 'solene', title: 'The Archivist', searchText: 'Solène kept the records.' },
      ].map((record) => ({
        ...record,
        date: '2026-01-01',
        description: '',
        type: 'fiction',
        minutes: 1,
        keywords: [],
        domains: [],
        mechanics: [],
        hero: null,
      }))
      const index = loadBm25(buildBm25(records.map((record) => ({ body: record.searchText }))))
      const bm25 = searchBm25(index, query, 10).map((hit) => records[hit.doc].slug)
      const lexical = find.searchRecords(records, query).map((hit) => hit.record.slug)

      expect(bm25).toContain('solene')
      expect(lexical).toContain('solene')
      // 'sol' prefixes both 'sol' and 'solene'; whole names match only the name.
      expect(bm25.sort()).toEqual(lexical.sort())
    }
  )

  it('looks folded query terms up in a folded vocabulary', () => {
    const terms = normalizedTokens('Solène Tomáš Tromsø').sort()
    expect(terms).toEqual(['solene', 'tomas', 'tromso'])
    expect(matchingTermRange(terms, 'tom')).toEqual([1, 2])
  })
})
