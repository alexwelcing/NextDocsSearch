// public/sitemap.xml and public/video-sitemap.xml, generated from the manifests (replacing
// next-sitemap), and a post-build check of the prerendered pages against them.
//
// - sitemap.xml: the static routes, every indexable article and every film page. A <lastmod> is
//   written only when the manifest carries a real `updated` or `published` date; the `date` field
//   is the in-world story date (often in the future), so it never stands in.
// - video-sitemap.xml: one entry per film in public/arc/media.json, all on this domain: the
//   /videos/<slug> page, the MP4 under /images/article-videos/, and the record's og:image poster.
// - Thin records (lib/seo/records.ts thinReason) stay prerendered but are left out; their pages
//   carry noindex.
//
// The files are written BEFORE next build (scripts/steps/pre/70-sitemaps.ts): Vercel's deployment
// adapter (onBuildComplete) and a static export both collect public/ during next build, so a file
// written afterwards never ships. That is why next-sitemap's post-build output never reached
// production, which kept serving the committed sitemap. The files are gitignored build outputs.
//
// After the build, scripts/steps/post/10-verify-sitemaps.ts runs verifyPrerendered(): every
// sitemap URL must have been prerendered, and the noindex pages must be exactly the articles the
// sitemap leaves out. Directly: `tsx scripts/generate-sitemaps.ts [--verify]`.

import fs from 'node:fs'
import path from 'node:path'
import { SITE_URL } from '../lib/site-url'
import { bodyWords, ogImagePath, readImageManifest, thinReason } from '../lib/seo/records'

/** The non-record pages under pages/ worth indexing (404, API routes and redirects are not). */
export const STATIC_ROUTES = [
  '/',
  '/articles',
  '/about',
  '/current-work',
  '/pitch',
  '/agent-futures',
  '/emergent-intelligence',
  '/speculative-ai',
  '/the-interface',
]

/** Google's limit for <video:description>. */
const VIDEO_DESCRIPTION_MAX = 2048

export interface SitemapUrl {
  path: string
  lastmod?: string
}

export interface Film {
  slug: string
  title: string
  description: string
  /** Site-relative poster image. */
  thumbnail: string
}

export interface SitemapPlan {
  urls: SitemapUrl[]
  films: Film[]
  /** Articles left out of the sitemap (their pages carry noindex), with the reason. */
  noindex: { slug: string; reason: string }[]
}

interface ManifestEntry {
  slug: string
  title?: string
  description?: string
  updated?: unknown
  published?: unknown
}

const ENTITIES: Record<string, string> = {
  '&': 'amp',
  '<': 'lt',
  '>': 'gt',
  '"': 'quot',
  "'": 'apos',
}
const xml = (text: string) => text.replace(/[&<>"']/g, (c) => `&${ENTITIES[c]};`)

/** `updated`, else `published`, when it is a real past date; never a guess. */
export function knownLastmod(entry: ManifestEntry, today: string): string | undefined {
  const date = [entry.updated, entry.published].find(
    (value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
  )
  return date && date.slice(0, 10) <= today ? date : undefined
}

export function urlsetXml(siteUrl: string, urls: SitemapUrl[]): string {
  const entries = urls.map(({ path: loc, lastmod }) => {
    const mod = lastmod ? `<lastmod>${xml(lastmod)}</lastmod>` : ''
    return `<url><loc>${xml(siteUrl + loc)}</loc>${mod}</url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}

export function videoSitemapXml(siteUrl: string, films: Film[]): string {
  const entries = films.map((film) => {
    const page = `${siteUrl}/videos/${film.slug}`
    const mp4 = `${siteUrl}/images/article-videos/${film.slug}.mp4`
    const description = film.description.slice(0, VIDEO_DESCRIPTION_MAX)
    return (
      `<url><loc>${xml(page)}</loc><video:video>` +
      `<video:thumbnail_loc>${xml(siteUrl + film.thumbnail)}</video:thumbnail_loc>` +
      `<video:title>${xml(film.title)}</video:title>` +
      `<video:description>${xml(description)}</video:description>` +
      `<video:content_loc>${xml(mp4)}</video:content_loc>` +
      '</video:video></url>'
    )
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
      'xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}

const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

/** What the sitemaps hold, from the generated manifests and records under root. */
export function planSitemaps(
  root: string,
  today = new Date().toISOString().slice(0, 10)
): SitemapPlan {
  const manifest = readJson(
    path.join(root, 'lib', 'generated', 'article-manifest.json')
  ) as ManifestEntry[]
  const films = (readJson(path.join(root, 'public', 'arc', 'media.json')) as { films: string[] })
    .films
  const images = readImageManifest(root)

  const urls: SitemapUrl[] = STATIC_ROUTES.map((route) => ({ path: route }))
  const noindex: SitemapPlan['noindex'] = []
  const heroes = new Map<string, string | null>()
  for (const entry of manifest) {
    const record = readJson(path.join(root, 'public', 'arc', 'records', `${entry.slug}.json`)) as {
      hero: string | null
      blocks: { x: string }[]
    }
    heroes.set(entry.slug, record.hero)
    const reason = thinReason(entry.slug, bodyWords(record.blocks))
    if (reason) noindex.push({ slug: entry.slug, reason })
    else urls.push({ path: `/articles/${entry.slug}`, lastmod: knownLastmod(entry, today) })
  }

  const bySlug = new Map(manifest.map((entry) => [entry.slug, entry]))
  const filmPages = films.map((slug): Film => {
    const entry = bySlug.get(slug)
    // Same fallbacks and poster as pages/videos/[slug].tsx.
    return {
      slug,
      title: entry?.title ?? slug.replace(/-/g, ' '),
      description: entry?.description ?? `Video companion to the record "${slug}".`,
      thumbnail: ogImagePath(heroes.get(slug), images[slug]),
    }
  })
  for (const film of filmPages) urls.push({ path: `/videos/${film.slug}` })

  return { urls, films: filmPages, noindex }
}

export function writeSitemaps(root: string = process.cwd(), siteUrl = SITE_URL): SitemapPlan {
  const plan = planSitemaps(root)
  fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), urlsetXml(siteUrl, plan.urls))
  fs.writeFileSync(
    path.join(root, 'public', 'video-sitemap.xml'),
    videoSitemapXml(siteUrl, plan.films)
  )

  console.log(
    `[sitemaps] sitemap.xml: ${plan.urls.length} URLs; video-sitemap.xml: ${plan.films.length} films`
  )
  console.log(`[sitemaps] ${plan.noindex.length} thin articles left out (noindex,follow):`)
  for (const { slug, reason } of plan.noindex) console.log(`[sitemaps]   ${slug} (${reason})`)
  return plan
}

/** The prerendered HTML file for a route in a next build (.next) or a static export (out). */
function prerenderedHtml(root: string, route: string): string | null {
  const page = route === '/' ? 'index' : route.slice(1)
  const candidates = [
    path.join(root, '.next', 'server', 'pages', `${page}.html`),
    path.join(root, 'out', `${page}.html`),
  ]
  return candidates.find((file) => fs.existsSync(file)) ?? null
}

/** The routes next build prerendered with getStaticProps (.next/prerender-manifest.json). */
function prerenderManifestRoutes(root: string): Set<string> {
  const file = path.join(root, '.next', 'prerender-manifest.json')
  if (!fs.existsSync(file)) return new Set()
  return new Set(Object.keys((readJson(file) as { routes?: object }).routes ?? {}))
}

/** The content of a page's <meta name="robots">, or null when it has none. */
export function robotsMeta(html: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/\bname="robots"/i.test(tag)) continue
    return /\bcontent="([^"]*)"/i.exec(tag)?.[1] ?? ''
  }
  return null
}

/**
 * The crawl assertion: every sitemap URL was prerendered without noindex, and every left-out
 * article was prerendered with it. Throws with every problem found.
 *
 * A deployment adapter (Vercel's onBuildComplete) moves getStaticProps HTML out of .next before
 * this runs. Such a route still counts as prerendered when the prerender manifest lists it, but its
 * robots meta cannot be read there; CI and plain `next build` check every page's HTML.
 */
export function verifyPrerendered(root: string, plan: SitemapPlan): void {
  const problems: string[] = []
  const prerendered = prerenderManifestRoutes(root)
  let handedOff = 0
  const check = (route: string, expectNoindex: boolean) => {
    const file = prerenderedHtml(root, route)
    if (!file) {
      if (prerendered.has(route)) handedOff += 1
      else problems.push(`${route} was not prerendered`)
      return
    }
    const robots = robotsMeta(fs.readFileSync(file, 'utf8')) ?? '(none)'
    if (/noindex/i.test(robots) !== expectNoindex) {
      const listed = expectNoindex ? 'left out of' : 'listed in'
      problems.push(`${route} has robots "${robots}" but is ${listed} the sitemap`)
    }
  }
  for (const url of plan.urls) check(url.path, false)
  for (const { slug } of plan.noindex) check(`/articles/${slug}`, true)

  if (problems.length > 0) {
    throw new Error(
      `[sitemaps] the prerendered pages disagree with the sitemap:\n  ${problems.join('\n  ')}`
    )
  }
  const pages = plan.urls.length + plan.noindex.length
  const note = handedOff
    ? ` (${handedOff} already handed to the deployment adapter: route only)`
    : ''
  console.log(`[sitemaps] verified ${pages} prerendered pages against the sitemap${note}`)
}

// CLI entry. Importing the module (the build steps, the tests) only defines the functions.
if (/generate-sitemaps\.ts$/.test(process.argv[1] ?? '')) {
  try {
    if (process.argv.includes('--verify'))
      verifyPrerendered(process.cwd(), planSitemaps(process.cwd()))
    else writeSitemaps()
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}
