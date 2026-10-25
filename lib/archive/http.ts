import type { ArchiveRecord, ArchiveSource } from './types'

/**
 * The static archive index, written at build time by scripts/generate-archive-index.ts into
 * public/ and served as plain files: the slim dock list and the complete records FIND searches.
 * Both use the `{ records, total }` envelope of the legacy /api/arc/archive alias.
 */
export const ARCHIVE_URL = '/arc/archive.json'
export const ARCHIVE_FULL_URL = '/arc/archive-full.json'

function isRecord(value: unknown): value is ArchiveRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const textFields = ['slug', 'title', 'date', 'description', 'type', 'searchText']
  const listFields = ['keywords', 'domains', 'mechanics']
  return (
    textFields.every((field) => typeof record[field] === 'string') &&
    typeof record.minutes === 'number' &&
    Number.isFinite(record.minutes) &&
    listFields.every(
      (field) =>
        Array.isArray(record[field]) && record[field].every((item) => typeof item === 'string')
    ) &&
    (record.hero === null || typeof record.hero === 'string') &&
    (record.horizon === undefined || typeof record.horizon === 'string') &&
    (record.polarity === undefined || typeof record.polarity === 'string')
  )
}

/** Fetch the complete index; never invent search fields from a slim response. */
export class HttpIndexSource implements ArchiveSource {
  /**
   * The URL is fetched exactly as given. The default is the static full index; the legacy API
   * alias serves the same records at '/api/arc/archive?view=full'.
   */
  constructor(private readonly url = ARCHIVE_FULL_URL) {}

  async load(): Promise<ArchiveRecord[]> {
    // Keep the default request relative so it works on any deployed origin.
    const response = await fetch(this.url)
    if (!response.ok) throw new Error(`archive: HTTP ${response.status}`)
    const payload: unknown = await response.json()
    const records =
      payload && typeof payload === 'object' && 'records' in payload ? payload.records : undefined
    if (!Array.isArray(records) || !records.every(isRecord)) {
      throw new Error('archive: expected complete records from the full index')
    }
    return records
  }
}
