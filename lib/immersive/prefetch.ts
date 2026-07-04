// Warm the HTTP cache for a record body while the user is still hovering/selecting it in a
// list, so the reader opens with zero visible fetch. Deduped; failures are silent (the reader
// does its own error handling).

const warmed = new Set<string>()

export function prefetchRecord(slug: string): void {
  if (typeof window === 'undefined' || warmed.has(slug)) return
  warmed.add(slug)
  fetch(`/arc/records/${slug}.json`).catch(() => warmed.delete(slug))
}
