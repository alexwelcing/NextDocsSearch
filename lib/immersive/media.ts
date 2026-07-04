// Client-side media index: which records have companion films and which have multi-art plates.
// Built by scripts/generate-media-manifest.ts; fetched once and cached module-level (same
// pattern as archive.ts) so list surfaces and the reader share one request.

export interface ArcMedia {
  films: Set<string>
  plates: Record<string, string[]>
}

let cache: Promise<ArcMedia> | null = null

export function loadMedia(): Promise<ArcMedia> {
  if (!cache) {
    cache = fetch('/arc/media.json')
      .then((r) => {
        if (!r.ok) throw new Error(`media: HTTP ${r.status}`)
        return r.json()
      })
      .then((d: { films: string[]; plates: Record<string, string[]> }) => ({
        films: new Set(d.films),
        plates: d.plates,
      }))
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}
