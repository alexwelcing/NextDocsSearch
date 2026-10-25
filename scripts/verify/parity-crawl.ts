// Vercel vs Cloudflare parity crawl (WS2-B). Fetches every page and asset a visitor or crawler can
// reach from two origins and diffs what they answer:
//
//   tsx scripts/verify/parity-crawl.ts <B-origin> [--a https://alexwelcing.com] [options]
//
// A defaults to production (https://alexwelcing.com, Vercel); B is the Cloudflare origin under test
// (a workers.dev URL or https://next.alexwelcing.com). Run it from the repo root. What it crawls:
//
// - every <loc> of A's /sitemap.xml and /video-sitemap.xml (following a sitemap index), plus any
//   <loc> only B lists, and the entry-level diff of the sitemaps themselves;
// - the static routes (scripts/generate-sitemaps.ts STATIC_ROUTES: home, archive, about,
//   current-work, pitch and the four hubs) and the archive records the sitemap leaves out (thin,
//   noindex; still deep-linkable in the scene), from A's /arc/archive.json;
// - /arc/records/<slug>.json for every article (the in-scene reader) and the /_next/data JSON of
//   every getStaticProps page (in-scene navigation), each origin with its own build id;
// - scripts/verify/must-serve.txt (robots, sitemaps, favicon, social preview, resumes, fonts,
//   archive JSON, 3 images, 3 MP4s fetched with Range: bytes=0-1), the search index assets named by
//   lib/generated/search-manifest.json, the 404 / redirect / trailing-slash probes, and one CSS and
//   one JS /_next/static file named by each origin's home page (Cache-Control).
//
// Per URL it compares status (redirect target included), content type, and for HTML the <title>,
// meta description, canonical, og:image, robots meta, JSON-LD @types and two normalized hashes of
// #arc-page-content: its text and its links (build ids, nonces and timestamps masked, any of the
// two origins collapsed to a path). Assets compare by body (JSON by value), MP4s by their 206
// answer. It also asserts the X-Robots-Tag gate: B (staging) must send noindex on every HTML/PDF
// page, A (production) must not; and that each origin's sitemaps list exactly the pages its robots
// meta lets be indexed. Severity rules live in scripts/verify/parity.ts.
//
// Output: a readable table on stdout, the full JSON report (--out, default
// test-output/parity/report.json) and a Markdown table (--markdown, default
// test-output/parity/report.md). The tables group rows that differ only by path (a platform-wide
// Cache-Control default is one line, "(+N)" more paths); the JSON lists every one. Exit 0 = no
// regressions, 1 = regressions (or warnings with --strict), 2 = the crawl could not run (bad
// arguments, A's sitemap unreachable).
//
// Polite by default: at most 4 requests in flight per origin, at least 100 ms between request
// starts per origin, a 30 s timeout, and 2 retries with backoff (honouring Retry-After) on network
// errors, 429 and 502-504. MP4 bodies are never downloaded beyond the 2 requested bytes.
//
// Compare two deployments of the same commit: anything built from different content differs.

import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { SITE_URL } from '../../lib/site-url'
import { STATIC_ROUTES } from '../generate-sitemaps'
import {
  type CompareOptions,
  type Group,
  type ParityReport,
  type ParsedSitemap,
  type RobotsExpectation,
  type Snapshot,
  type Target,
  type TargetResult,
  TargetSet,
  compareSitemaps,
  compareSnapshots,
  exitCode,
  hash16,
  jsonHash,
  locPath,
  mimeEssence,
  nextDataPath,
  normalizeRef,
  parseMustServe,
  parseSitemap,
  renderMarkdown,
  renderTable,
  reportJson,
  sample,
  sitemapHash,
  summarizePage,
  summarize,
  textBodyHash,
  verdictOf,
} from './parity'

export const DEFAULT_A = 'https://alexwelcing.com'
export const SITEMAPS = ['/sitemap.xml', '/video-sitemap.xml']
/** 404, redirect and trailing-slash behaviour (the doc-article redirect is added per crawl). */
export const PROBES = ['/articles/does-not-exist', '/explore', '/docs/articles', '/about/']

const USER_AGENT =
  'alexwelcing-parity-crawl/1 (+https://github.com/alexwelcing/NextDocsSearch; scripts/verify/parity-crawl.ts)'
const RETRY_STATUS = new Set([429, 502, 503, 504])
const MAX_BODY_BYTES = 32 * 1024 * 1024
const MAX_SITEMAPS = 50

export interface Options {
  a: string
  b: string
  concurrency: number
  intervalMs: number
  timeoutMs: number
  retries: number
  sample: number
  only: RegExp | null
  ignore: RegExp[]
  mustServe: string
  searchManifest: string
  nextData: boolean
  records: boolean
  archive: boolean
  expectXRobots: CompareOptions['expectXRobots']
  out: string
  markdown: string
  maxRows: number
  strict: boolean
  quiet: boolean
  userAgent: string
}

export class UsageError extends Error {}
export class FatalError extends Error {}

export const USAGE = `usage: tsx scripts/verify/parity-crawl.ts <B-origin> [options]

  <B-origin>             the Cloudflare origin under test, e.g. https://next.alexwelcing.com
  --a <origin>           the reference origin (default ${DEFAULT_A})
  --concurrency <n>      requests in flight per origin (default 4)
  --interval-ms <n>      minimum gap between request starts per origin (default 100)
  --timeout-ms <n>       per-request timeout (default 30000)
  --retries <n>          retries on network errors, 429 and 502-504 (default 2)
  --sample <n>           crawl only n evenly spread sitemap/archive pages (default 0 = all)
  --only <regex>         crawl only targets whose path matches
  --ignore <regex>       extra text to mask before hashing #arc-page-content (repeatable)
  --must-serve <file>    default scripts/verify/must-serve.txt
  --search-manifest <f>  default lib/generated/search-manifest.json
  --no-next-data         skip the /_next/data JSON of getStaticProps pages
  --no-records           skip /arc/records/<slug>.json
  --no-archive           skip archive records the sitemap leaves out
  --a-x-robots <mode>    noindex | absent | any: what A's X-Robots-Tag must say (default absent)
  --b-x-robots <mode>    noindex | absent | any: what B's X-Robots-Tag must say (default noindex)
  --out <file>           JSON report (default test-output/parity/report.json)
  --markdown <file>      Markdown table (default test-output/parity/report.md)
  --max-rows <n>         rows printed in the tables (default 200; the JSON has all)
  --strict               warnings fail the run too
  --quiet                no progress on stderr
  --user-agent <ua>      override the crawler's User-Agent

exit: 0 no regressions, 1 regressions (or warnings with --strict), 2 the crawl could not run`

/** An http(s) origin with no path, query or fragment, without the trailing slash. */
export function parseOrigin(raw: string, label: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UsageError(`${label}: "${raw}" is not a URL`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UsageError(`${label}: "${raw}" must be http(s)`)
  }
  if ((url.pathname !== '/' && url.pathname !== '') || url.search || url.hash || url.username) {
    throw new UsageError(`${label}: "${raw}" must be a bare origin such as https://example.com`)
  }
  return url.origin
}

const ROBOTS_MODES = new Set(['noindex', 'absent', 'any'])

export function parseCli(argv: string[]): Options | null {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      a: { type: 'string', default: DEFAULT_A },
      concurrency: { type: 'string', default: '4' },
      'interval-ms': { type: 'string', default: '100' },
      'timeout-ms': { type: 'string', default: '30000' },
      retries: { type: 'string', default: '2' },
      sample: { type: 'string', default: '0' },
      only: { type: 'string' },
      ignore: { type: 'string', multiple: true, default: [] },
      'must-serve': { type: 'string', default: 'scripts/verify/must-serve.txt' },
      'search-manifest': { type: 'string', default: 'lib/generated/search-manifest.json' },
      'no-next-data': { type: 'boolean', default: false },
      'no-records': { type: 'boolean', default: false },
      'no-archive': { type: 'boolean', default: false },
      'a-x-robots': { type: 'string', default: 'absent' },
      'b-x-robots': { type: 'string', default: 'noindex' },
      out: { type: 'string', default: 'test-output/parity/report.json' },
      markdown: { type: 'string', default: 'test-output/parity/report.md' },
      'max-rows': { type: 'string', default: '200' },
      strict: { type: 'boolean', default: false },
      quiet: { type: 'boolean', default: false },
      'user-agent': { type: 'string', default: USER_AGENT },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) return null
  if (positionals.length !== 1) throw new UsageError('expected exactly one argument: the B origin')

  const int = (name: string, raw: string, min: number) => {
    const n = Number(raw)
    if (!Number.isInteger(n) || n < min)
      throw new UsageError(`--${name} must be an integer >= ${min}`)
    return n
  }
  const regex = (name: string, raw: string) => {
    try {
      return new RegExp(raw, 'g')
    } catch {
      throw new UsageError(`--${name}: "${raw}" is not a valid regular expression`)
    }
  }
  const robots = (name: string, raw: string): RobotsExpectation => {
    if (!ROBOTS_MODES.has(raw)) throw new UsageError(`--${name} must be noindex, absent or any`)
    return raw as RobotsExpectation
  }

  return {
    a: parseOrigin(values.a, '--a'),
    b: parseOrigin(positionals[0], 'B origin'),
    concurrency: int('concurrency', values.concurrency, 1),
    intervalMs: int('interval-ms', values['interval-ms'], 0),
    timeoutMs: int('timeout-ms', values['timeout-ms'], 1000),
    retries: int('retries', values.retries, 0),
    sample: int('sample', values.sample, 0),
    only: values.only ? new RegExp(regex('only', values.only).source) : null,
    ignore: values.ignore.map((raw) => regex('ignore', raw)),
    mustServe: values['must-serve'],
    searchManifest: values['search-manifest'],
    nextData: !values['no-next-data'],
    records: !values['no-records'],
    archive: !values['no-archive'],
    expectXRobots: {
      a: robots('a-x-robots', values['a-x-robots']),
      b: robots('b-x-robots', values['b-x-robots']),
    },
    out: values.out,
    markdown: values.markdown,
    maxRows: int('max-rows', values['max-rows'], 1),
    strict: values.strict,
    quiet: values.quiet,
    userAgent: values['user-agent'],
  }
}

// ---------------------------------------------------------------------------------------------
// Polite fetching

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Caps one origin's requests in flight and spaces their starts at least `intervalMs` apart. */
export class Pacer {
  private active = 0
  private waiting: (() => void)[] = []
  private nextStart = 0

  constructor(private readonly concurrency: number, private readonly intervalMs: number) {}

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.concurrency) {
      await new Promise<void>((resolve) => this.waiting.push(resolve))
    } else {
      this.active++
    }
    try {
      const now = Date.now()
      const start = Math.max(now, this.nextStart)
      this.nextStart = start + this.intervalMs
      if (start > now) await sleep(start - now)
      return await task()
    } finally {
      // Hand the slot straight to the next waiter, so `active` never dips below the queue's needs.
      const next = this.waiting.shift()
      if (next) next()
      else this.active--
    }
  }
}

/** Milliseconds to wait before retry `attempt` (0-based): Retry-After when given, else 1 s, 2 s, 4 s... */
export function retryDelay(retryAfter: string | null, attempt: number, now = Date.now()): number {
  const cap = 30_000
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(cap, seconds * 1000)
    const date = Date.parse(retryAfter)
    if (Number.isFinite(date)) return Math.min(cap, Math.max(0, date - now))
  }
  return Math.min(cap, 1000 * 2 ** attempt)
}

interface RawResponse {
  status: number
  headers: Headers
  body: Buffer | null
  /** Why the body was not read, when it was not. */
  skipped?: string
}

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface Deps {
  fetch?: FetchLike
  log?: (line: string) => void
  /** Reads a repo file (must-serve list, search manifest); defaults to the filesystem. */
  readFile?: (file: string) => string | null
  now?: () => Date
}

interface Ctx {
  options: Options
  fetch: FetchLike
  pacers: { a: Pacer; b: Pacer }
  /** Origins whose absolute links count as the same site (A, B and the canonical site URL). */
  siteOrigins: string[]
  /** Paths whose JSON text the snapshot keeps (the archive index, which names the records). */
  keepBodies: Set<string>
}

async function request(
  ctx: Ctx,
  url: string,
  headers: Record<string, string>,
  readBody: (status: number) => boolean
): Promise<RawResponse> {
  const { retries, timeoutMs } = ctx.options
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await ctx.fetch(url, {
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (RETRY_STATUS.has(res.status) && attempt < retries) {
        await res.body?.cancel().catch(() => {})
        await sleep(retryDelay(res.headers.get('retry-after'), attempt))
        continue
      }
      const length = Number(res.headers.get('content-length') ?? '0')
      let skipped: string | undefined
      if (!readBody(res.status)) skipped = 'not needed'
      else if (length > MAX_BODY_BYTES) skipped = `larger than ${MAX_BODY_BYTES} bytes`
      if (skipped) {
        await res.body?.cancel().catch(() => {})
        return { status: res.status, headers: res.headers, body: null, skipped }
      }
      return {
        status: res.status,
        headers: res.headers,
        body: Buffer.from(await res.arrayBuffer()),
      }
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(retryDelay(null, attempt))
    }
  }
}

const isRedirectStatus = (status: number) => status >= 300 && status < 400
const errorText = (err: unknown) => {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause
    const detail = cause instanceof Error ? `: ${cause.message}` : ''
    return `${err.name === 'TimeoutError' ? 'timeout' : err.message}${detail}`
  }
  return String(err)
}

/** One origin's answer for one target path, reduced to what the diff compares. */
async function snapshot(ctx: Ctx, side: 'a' | 'b', target: Target): Promise<Snapshot> {
  const requestPath = target[side]
  const empty: Snapshot = {
    url: null,
    status: null,
    contentType: null,
    location: null,
    xRobotsTag: null,
    cacheControl: null,
    kind: 'none',
  }
  if (requestPath === null) return { ...empty, error: 'no path on this origin (no build id seen)' }

  const origin = ctx.options[side]
  const url = `${origin}${requestPath}`
  const headers: Record<string, string> = {
    'user-agent': ctx.options.userAgent,
    accept: target.range
      ? '*/*'
      : 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  }
  if (target.range) headers.range = 'bytes=0-1'

  let raw: RawResponse
  try {
    raw = await ctx.pacers[side].run(() =>
      request(ctx, url, headers, (status) =>
        isRedirectStatus(status) ? false : target.range ? status === 206 : true
      )
    )
  } catch (err) {
    return { ...empty, url, error: errorText(err) }
  }

  const contentType = raw.headers.get('content-type')
  const location = raw.headers.get('location')
  const snap: Snapshot = {
    url,
    status: raw.status,
    contentType,
    location: location ? normalizeRef(location, [origin]) : null,
    xRobotsTag: raw.headers.get('x-robots-tag'),
    cacheControl: raw.headers.get('cache-control'),
    kind: 'none',
  }
  if (target.range) {
    const contentRange = raw.headers.get('content-range')
    const total = /\/(\d+)\s*$/.exec(contentRange ?? '')?.[1]
    snap.kind = 'range'
    snap.range = {
      contentRange,
      total: total ? Number(total) : null,
      head: raw.body ? raw.body.subarray(0, 16).toString('hex') : '',
    }
    return snap
  }
  if (isRedirectStatus(raw.status) || !raw.body) {
    if (raw.skipped && raw.skipped !== 'not needed') snap.error = `body skipped: ${raw.skipped}`
    return snap
  }

  const body = raw.body
  snap.bodyBytes = body.length
  const essence = mimeEssence(contentType)
  const lowerPath = requestPath.split('?')[0].toLowerCase()
  if (essence === 'text/html' || essence === 'application/xhtml+xml') {
    const { page, text, links, assets } = summarizePage(
      body.toString('utf8'),
      [origin, ...ctx.siteOrigins],
      ctx.options.ignore
    )
    snap.kind = 'html'
    snap.page = page
    snap._text = text
    snap._links = links
    snap._assets = assets
  } else if (essence.includes('json') || (!essence && lowerPath.endsWith('.json'))) {
    const text = body.toString('utf8')
    snap.kind = 'json'
    snap.bodyHash = jsonHash(text)
    if (ctx.keepBodies.has(requestPath)) snap._body = text
  } else if (essence.endsWith('xml') || (!essence && lowerPath.endsWith('.xml'))) {
    const text = body.toString('utf8')
    const parsed = parseSitemap(text)
    snap.kind = 'xml'
    if (parsed.urls.length > 0 || parsed.sitemaps.length > 0) {
      snap._sitemap = parsed
      snap.bodyHash = sitemapHash([...parsed.urls, ...parsed.sitemaps.map((loc) => ({ loc }))])
    } else {
      snap.bodyHash = textBodyHash(text)
    }
  } else if (essence.startsWith('text/') || essence === 'application/javascript') {
    snap.kind = 'text'
    snap.bodyHash = textBodyHash(body.toString('utf8'))
  } else {
    snap.kind = 'binary'
    snap.bodyHash = hash16(body)
  }
  return snap
}

// ---------------------------------------------------------------------------------------------
// The crawl

function readRepoFile(file: string): string | null {
  try {
    return fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
  } catch {
    return null
  }
}

/** The search index files a build names in lib/generated/search-manifest.json. */
export function searchAssets(manifestJson: string): string[] {
  const manifest = JSON.parse(manifestJson) as {
    assets?: Record<string, unknown>
    vectors?: unknown
  }
  const found = new Set<string>()
  const visit = (value: unknown) => {
    if (typeof value === 'string' && value.startsWith('/')) found.add(value)
    else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  visit(manifest.assets)
  visit(manifest.vectors)
  return [...found].sort()
}

/** Article slugs from an /arc/archive.json body ({ records: [{ slug }] }). */
export function archiveSlugs(json: string): string[] {
  const data = JSON.parse(json) as { records?: { slug?: unknown }[] }
  return (data.records ?? [])
    .map((record) => record.slug)
    .filter((slug): slug is string => typeof slug === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(slug))
}

const ARTICLE = /^\/articles\/([a-z0-9][a-z0-9-]*)$/

export async function runParity(options: Options, deps: Deps = {}): Promise<ParityReport> {
  const now = deps.now ?? (() => new Date())
  const log = deps.log ?? (() => {})
  const read = deps.readFile ?? readRepoFile
  const startedAt = now().toISOString()
  const ctx: Ctx = {
    options,
    fetch: deps.fetch ?? ((url, init) => fetch(url, init)),
    pacers: {
      a: new Pacer(options.concurrency, options.intervalMs),
      b: new Pacer(options.concurrency, options.intervalMs),
    },
    siteOrigins: [...new Set([options.a, options.b, SITE_URL])],
    keepBodies: new Set(['/arc/archive.json']),
  }
  const notes: string[] = []
  const snapshots = new Map<string, { target: Target; a: Snapshot; b: Snapshot }>()

  let done = 0
  let total = 0
  const crawl = async (targets: Target[]) => {
    total += targets.length
    await Promise.all(
      targets.map(async (target) => {
        const [a, b] = await Promise.all([snapshot(ctx, 'a', target), snapshot(ctx, 'b', target)])
        snapshots.set(target.key, { target, a, b })
        done++
        if (done % 50 === 0 || done === total) log(`[parity] ${done}/${total}`)
      })
    )
  }

  // 1. The sitemaps: A's define the crawl, so A's /sitemap.xml must load.
  const sitemapQueue = [...SITEMAPS]
  const sitemapPaths: string[] = []
  while (sitemapQueue.length > 0 && sitemapPaths.length < MAX_SITEMAPS) {
    const batch = sitemapQueue.splice(0).filter((p) => !sitemapPaths.includes(p))
    sitemapPaths.push(...batch)
    await crawl(
      batch.map((p) => ({ key: p, group: 'asset' as Group, a: p, b: p, mustServe: true }))
    )
    for (const p of batch) {
      for (const child of snapshots.get(p)?.a._sitemap?.sitemaps ?? []) {
        const childPath = locPath(child)
        if (!sitemapPaths.includes(childPath) && !sitemapQueue.includes(childPath))
          sitemapQueue.push(childPath)
      }
    }
  }
  const aSitemap = snapshots.get('/sitemap.xml')!.a
  if (aSitemap.status !== 200 || !aSitemap._sitemap) {
    throw new FatalError(
      `A's /sitemap.xml is unusable (${
        aSitemap.status ?? aSitemap.error
      }): nothing defines the crawl`
    )
  }

  const sitemaps: ParityReport['sitemaps'] = {}
  const pages = new TargetSet()
  for (const name of sitemapPaths) {
    const { a, b } = snapshots.get(name)!
    const aEntries = a._sitemap?.urls ?? []
    if (!a._sitemap && name !== '/sitemap.xml')
      notes.push(`A's ${name} did not load (${a.status ?? a.error})`)
    const bEntries = b._sitemap ? b._sitemap.urls : null
    sitemaps[name] = {
      a: aEntries.length,
      b: bEntries ? bEntries.length : null,
      diffs: a._sitemap ? compareSitemaps(name, aEntries, bEntries) : [],
    }
    for (const entry of aEntries) pages.add(locPath(entry.loc), 'sitemap')
    for (const entry of bEntries ?? []) pages.add(locPath(entry.loc), 'sitemap')
  }
  // What each origin's own sitemaps list, for the indexable-set check; an origin missing any of
  // its sitemaps is left out of it (the sitemap diff already reports that).
  const listedBy = (side: 'a' | 'b') => {
    const parsed = sitemapPaths.map((name) => snapshots.get(name)![side]._sitemap)
    if (parsed.some((sitemap) => !sitemap)) return null
    return new Set(parsed.flatMap((sitemap) => sitemap!.urls.map((entry) => locPath(entry.loc))))
  }
  const listed = { a: listedBy('a'), b: listedBy('b') }

  // 2. Everything else, starting with what decides which pages exist.
  const targets = new TargetSet()
  const mustServeText = read(options.mustServe)
  if (mustServeText === null) throw new FatalError(`cannot read ${options.mustServe}`)
  const mustServe = parseMustServe(mustServeText)
  for (const p of mustServe) {
    if (!snapshots.has(p)) targets.add(p, 'asset', { mustServe: true, range: /\.mp4$/i.test(p) })
  }
  if (options.archive && !snapshots.has('/arc/archive.json')) {
    targets.add('/arc/archive.json', 'asset', {
      mustServe: mustServe.includes('/arc/archive.json'),
    })
  }
  await crawl(filterOnly(targets.list(), options.only, ['/arc/archive.json']))

  for (const route of STATIC_ROUTES) pages.add(route, 'static')
  if (options.archive) {
    const archive = snapshots.get('/arc/archive.json')?.a
    let slugs: string[] = []
    try {
      slugs = archive?.status === 200 && archive._body ? archiveSlugs(archive._body) : []
    } catch (err) {
      notes.push(`A's /arc/archive.json could not be parsed: ${errorText(err)}`)
    }
    for (const slug of slugs) pages.add(`/articles/${slug}`, 'archive')
    if (slugs.length === 0) {
      notes.push("A's /arc/archive.json named no records: archive-only pages were not crawled")
    }
  }

  const pageList = sample(pages.list(), options.sample)
  const rest = new TargetSet()
  for (const page of pageList) {
    page.listed = {
      ...(listed.a ? { a: listed.a.has(page.key) } : {}),
      ...(listed.b ? { b: listed.b.has(page.key) } : {}),
    }
    rest.addTarget(page)
  }
  if (options.records) {
    for (const page of pageList) {
      const slug = ARTICLE.exec(page.key)?.[1]
      if (slug) rest.add(`/arc/records/${slug}.json`, 'record')
    }
  }
  const manifest = read(options.searchManifest)
  if (manifest === null)
    notes.push(`${options.searchManifest} not found: search index assets not crawled`)
  else for (const asset of searchAssets(manifest)) rest.add(asset, 'search')
  const firstArticle = pageList.map((p) => ARTICLE.exec(p.key)?.[1]).find(Boolean) ?? 'x'
  for (const probe of [...PROBES, `/docs/articles/${firstArticle}`]) rest.add(probe, 'probe')
  await crawl(
    filterOnly(
      rest.list().filter((t) => !snapshots.has(t.key)),
      options.only
    )
  )

  // 3. Targets named by what the pages said: their /_next/data JSON and /_next/static files.
  const derived = new TargetSet()
  for (const { target, a, b } of [...snapshots.values()]) {
    if (target.group === 'probe' || a.kind !== 'html' || b.kind !== 'html') continue
    if (!options.nextData || !(a.page?.gsp || b.page?.gsp)) continue
    derived.addTarget({
      key: nextDataPath('<build>', target.key),
      group: 'next-data',
      a: a.page?.buildId ? nextDataPath(a.page.buildId, target.key) : null,
      b: b.page?.buildId ? nextDataPath(b.page.buildId, target.key) : null,
    })
  }
  const home = snapshots.get('/')
  if (home) {
    for (const [label, test] of [
      ['css', (p: string) => p.endsWith('.css')],
      ['js', (p: string) => p.endsWith('.js')],
    ] as const) {
      const a = home.a._assets?.find(test) ?? null
      const b = home.b._assets?.find(test) ?? null
      if (a || b)
        derived.addTarget({ key: `/_next/static/<first ${label} on />`, group: 'cache', a, b })
    }
  }
  await crawl(filterOnly(derived.list(), options.only))

  // 4. Compare.
  const compareOptions: CompareOptions = { expectXRobots: options.expectXRobots }
  const results: TargetResult[] = []
  for (const { target, a, b } of snapshots.values()) {
    if (options.only && !options.only.test(target.key) && !SITEMAPS.includes(target.key)) continue
    const diffs = compareSnapshots(target, a, b, compareOptions)
    results.push({
      key: target.key,
      group: target.group,
      ...(target.mustServe ? { mustServe: true } : {}),
      verdict: verdictOf(diffs),
      diffs,
      a,
      b,
    })
  }
  results.sort((x, y) => (x.key < y.key ? -1 : x.key > y.key ? 1 : 0))

  const buildIds = (side: 'a' | 'b') =>
    [
      ...new Set(results.map((r) => r[side].page?.buildId).filter((id): id is string => !!id)),
    ].sort()
  const info = {
    a: { origin: options.a, buildIds: buildIds('a') },
    b: { origin: options.b, buildIds: buildIds('b') },
  }
  for (const side of ['a', 'b'] as const) {
    if (info[side].buildIds.length > 1) {
      notes.push(
        `${side.toUpperCase()} served ${info[side].buildIds.length} Next build ids (${info[
          side
        ].buildIds.join(', ')}): ` +
          'it redeployed during the crawl, so some diffs may be spurious; rerun'
      )
    }
  }
  const htmlB = results.filter((r) => r.b.kind === 'html' && r.b.status === 200)
  const noindexB = htmlB.filter((r) => /noindex/i.test(r.b.xRobotsTag ?? '')).length
  notes.push(
    `X-Robots-Tag noindex on ${noindexB}/${htmlB.length} of B's 200 HTML pages (expected: ${options.expectXRobots.b})`
  )

  return {
    schema: 'parity-report/1',
    startedAt,
    finishedAt: now().toISOString(),
    a: info.a,
    b: info.b,
    options: {
      concurrency: options.concurrency,
      intervalMs: options.intervalMs,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
      sample: options.sample,
      only: options.only?.source ?? null,
      ignore: options.ignore.map((r) => r.source),
      nextData: options.nextData,
      records: options.records,
      archive: options.archive,
      expectXRobots: options.expectXRobots,
    },
    summary: summarize(results, sitemaps),
    notes,
    sitemaps,
    results,
  }
}

function filterOnly(targets: Target[], only: RegExp | null, keep: string[] = []): Target[] {
  return only ? targets.filter((t) => only.test(t.key) || keep.includes(t.key)) : targets
}

// ---------------------------------------------------------------------------------------------
// CLI

export async function main(argv: string[], deps: Deps = {}): Promise<number> {
  let options: Options | null
  try {
    options = parseCli(argv)
  } catch (err) {
    console.error(`${err instanceof Error ? err.message : err}\n\n${USAGE}`)
    return 2
  }
  if (!options) {
    console.log(USAGE)
    return 0
  }
  const log = options.quiet ? () => {} : (line: string) => console.error(line)
  let report: ParityReport
  try {
    log(`[parity] A ${options.a}  B ${options.b}`)
    report = await runParity(options, { log, ...deps })
  } catch (err) {
    console.error(`[parity] ${err instanceof Error ? err.message : err}`)
    return 2
  }
  for (const [file, contents] of [
    [options.out, reportJson(report)],
    [options.markdown, renderMarkdown(report, options.maxRows)],
  ]) {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true })
    fs.writeFileSync(file, contents)
  }
  process.stdout.write(renderTable(report, options.maxRows))
  log(`[parity] report: ${options.out}, ${options.markdown}`)
  return exitCode(report.summary, options.strict)
}

// CLI entry. Importing the module (the tests) only defines the functions.
if (/parity-crawl\.ts$/.test(process.argv[1] ?? '')) {
  main(process.argv.slice(2)).then((code) => process.exit(code))
}
