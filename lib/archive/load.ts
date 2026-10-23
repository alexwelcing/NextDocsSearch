import type { ArchiveRecord, ArchiveSource } from './types'

const cache = new WeakMap<ArchiveSource, Promise<ArchiveRecord[]>>()

/** Cache successful loads per source; strict callers can distinguish failure from an empty index. */
export async function listRecords(
  source: ArchiveSource,
  options: { throwOnError?: boolean } = {}
): Promise<ArchiveRecord[]> {
  let pending = cache.get(source)
  if (!pending) {
    pending = Promise.resolve()
      .then(() => source.load())
      .then((records) => [...records].sort((a, b) => b.date.localeCompare(a.date)))
      .catch((error) => {
        cache.delete(source)
        throw error
      })
    cache.set(source, pending)
  }
  try {
    // Callers can sort/filter their own list without corrupting the cached order.
    return [...(await pending)]
  } catch (error) {
    if (options.throwOnError) throw error
    return []
  }
}
