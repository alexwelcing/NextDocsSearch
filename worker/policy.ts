// Header policy shared by the two halves of the Cloudflare target: scripts/cf-finalize.ts writes it
// into out/_headers for static assets, and worker/index.ts applies it to the responses it makes
// itself (_headers never applies to those). Plain constants, no runtime dependencies.

/** Vercel's header today, on every response. */
export const HSTS = 'max-age=63072000'

/** Every host but the canonical one (workers.dev, preview URLs, next.alexwelcing.com). */
export const NOINDEX = 'noindex, nofollow'

/** Content-hashed paths only (see IMMUTABLE_PREFIXES in scripts/cf-finalize.ts). */
export const IMMUTABLE = 'public, max-age=31536000, immutable'

/** Unhashed media: a week fresh, then served stale while revalidating for up to 30 days. */
export const MEDIA_CACHE = 'public, max-age=604800, stale-while-revalidate=2592000'

/**
 * The windfoil atlases are unhashed and their format is coupled to the JS that reads them, so a
 * returning visitor must pick up a new pair within the hour.
 */
export const FONT_CACHE = 'public, max-age=3600, stale-while-revalidate=86400'

/** Generated data (archive index, records, search index): a deploy shows within five minutes. */
export const DATA_CACHE = 'public, max-age=300, stale-while-revalidate=86400'

/**
 * Film directories the Worker serves itself, so that Range requests get 206 Partial Content.
 * Workers Static Assets answer a Range request with the whole file and a 200 (measured on
 * workers.dev, 2026-10-25), and Safari will not play a video from a server that does that. Each
 * prefix is also listed in wrangler.jsonc assets.run_worker_first (worker/index.test.ts checks).
 */
export const RANGED_PREFIXES = ['/images/article-videos/', '/videos/articles/']
