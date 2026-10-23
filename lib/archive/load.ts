import type { ArchiveRecord, ArchiveSource } from './types'

const cache = new WeakMap<ArchiveSource, Promise<ArchiveRecord[]>>()

/** Cache successful loads per source; a failed or absent index can be retried. */
export async function listRecords(source: ArchiveSource): Promise<ArchiveRecord[]> {
  let pending = cache.get(source)
  if (!pending) {
    pending = Promise.resolve()
      .then(() => source.load())
      .then((records) => [...records].sort((a, b) => b.date.localeCompare(a.date)))
      .catch(() => {
        cache.delete(source)
        return []
      })
    cache.set(source, pending)
  }
  // Callers can sort/filter their own list without corrupting the cached order.
  return [...(await pending)]
}
