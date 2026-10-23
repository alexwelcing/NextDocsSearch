import type { ArchiveRecord, ArcRecordSlim } from './types'

/** Preserve the dock's six fields and its historical description limit. */
export function toSlim(record: ArchiveRecord): ArcRecordSlim {
  return {
    slug: record.slug,
    title: record.title,
    date: record.date,
    description: record.description.slice(0, 220),
    type: record.type,
    minutes: record.minutes,
  }
}
