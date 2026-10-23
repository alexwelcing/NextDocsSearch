/** Complete, normalized metadata used by both browser and server lexical search. */
export interface ArchiveRecord {
  slug: string
  title: string
  date: string
  description: string
  type: string
  minutes: number
  keywords: string[]
  domains: string[]
  mechanics: string[]
  searchText: string
  hero: string | null
  horizon?: string
  polarity?: string
}

/** The existing dock wire format; it is intentionally insufficient for rich search. */
export type ArcRecordSlim = Pick<
  ArchiveRecord,
  'slug' | 'title' | 'date' | 'description' | 'type' | 'minutes'
>

export interface ArchiveSource {
  load(): Promise<ArchiveRecord[]>
}

export interface SearchHit {
  record: ArchiveRecord
  score: number
  snippet: string
}
