import type { ArchiveRecord, ArchiveSource } from './types'

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

/** Fetch the explicit full view; never invent search fields from a slim response. */
export class HttpIndexSource implements ArchiveSource {
  constructor(private readonly endpoint = '/api/arc/archive') {}

  async load(): Promise<ArchiveRecord[]> {
    // Keep the default request relative so it works on any deployed origin.
    const [path, query = ''] = this.endpoint.split('?')
    const params = new URLSearchParams(query)
    params.set('view', 'full')
    const response = await fetch(`${path}?${params}`)
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
