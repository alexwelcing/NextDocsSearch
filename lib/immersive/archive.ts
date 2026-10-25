// Compact display index for the dock and collections: the static /arc/archive.json the build
// writes. FIND loads the complete search index on demand through lib/archive instead of this
// eager preload.

import type { ArcRecordSlim } from '@/lib/archive'
import { ARCHIVE_URL } from '@/lib/archive/http'

export type ArcRecord = ArcRecordSlim

let cache: Promise<ArcRecord[]> | null = null

export function loadArchive(): Promise<ArcRecord[]> {
  if (!cache) {
    cache = fetch(ARCHIVE_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`archive: HTTP ${r.status}`)
        return r.json()
      })
      .then((d: { records: ArcRecord[] }) => d.records)
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}

export const HUB_COLLECTIONS: Record<string, { title: string; blurb: string; match: (r: ArcRecord) => boolean }> = {
  'agent-futures': {
    title: 'AGENT FUTURES',
    blurb: 'autonomy, delegation, and what agents do to institutions',
    match: (r) => /agent|autonom|delegat/i.test(r.title + ' ' + r.description),
  },
  'emergent-intelligence': {
    title: 'EMERGENT INTELLIGENCE',
    blurb: 'capabilities nobody ordered, arriving anyway',
    match: (r) => /emerg|intelligen|mind|cognit/i.test(r.title + ' ' + r.description),
  },
  'speculative-ai': {
    title: 'SPECULATIVE AI',
    blurb: 'near futures, told from the inside',
    match: (r) => r.type === 'fiction' || /speculat|future|2\d{3}/i.test(r.title + ' ' + r.description),
  },
  'the-interface': {
    title: 'THE INTERFACE',
    blurb: 'a 24-part series on the membrane between us and them',
    match: (r) => /interface/i.test(r.slug) || /interface/i.test(r.title),
  },
}
