// Pure logic for the Vercel vs Cloudflare parity crawl (scripts/verify/parity-crawl.ts): HTML fact
// extraction, normalization, sitemap parsing, the per-URL diff rules and the report renderers. No
// network and no filesystem here, so every rule is unit-tested in parity.test.ts.
//
// Severity model (what the crawl's exit code keys on):
// - regression: B is missing something A serves, or serves different content (status, type,
//   #arc-page-content text or links, <title>, canonical, og:image, robots meta, JSON-LD types,
//   bodies of JSON/text/binary assets, MP4 Range answers, a must-serve file, the X-Robots-Tag gate,
//   a B sitemap that does not list exactly B's indexable pages).
// - warning: a difference that does not change what readers or crawlers get (Cache-Control, a
//   charset parameter, equivalent MIME aliases, a path only B serves, a changed redirect code), and
//   production defects that are not parity differences (a path A names that neither origin serves,
//   A's own sitemap/robots-meta mismatch).
// - expected: a documented platform difference (see REDIRECT_RULES), reported but never fatal.

import { createHash } from 'node:crypto'

export type Severity = 'regression' | 'warning' | 'expected'
export type Verdict = 'identical' | Severity

/** Why a path is in the crawl. */
export type Group =
  | 'sitemap' // a <loc> of sitemap.xml or video-sitemap.xml
  | 'archive' // an archive record left out of the sitemap (thin, noindex), still deep-linkable
  | 'static' // a fixed static route (scripts/generate-sitemaps.ts STATIC_ROUTES)
  | 'asset' // scripts/verify/must-serve.txt
  | 'search' // a full-text search index asset named by lib/generated/search-manifest.json
  | 'record' // /arc/records/<slug>.json, fetched by the in-scene reader
  | 'next-data' // /_next/data/<buildId>/<page>.json, fetched on in-scene navigation
  | 'probe' // 404 / redirect / trailing-slash behaviour
  | 'cache' // a /_next/static file named by each origin's own home page

export type BodyKind = 'html' | 'json' | 'xml' | 'text' | 'binary' | 'range' | 'none'

/** One URL to compare. `a` and `b` are the request paths, equal except for build-specific files. */
export interface Target {
  key: string
  group: Group
  a: string | null
  b: string | null
  /** Request with Range: bytes=0-1 (MP4s); the answer must be 206. */
  range?: boolean
  /** B must answer 2xx whatever A does (scripts/verify/must-serve.txt). */
  mustServe?: boolean
  /**
   * For a page: whether each origin's own sitemaps list it (unset for an origin whose sitemap did
   * not load). The sitemap must list exactly the indexable pages, so a listed noindex page and an
   * indexable page left out are both reported.
   */
  listed?: { a?: boolean; b?: boolean }
}

export interface PageSummary {
  title: string | null
  description: string | null
  canonical: string | null
  ogImage: string | null
  robots: string | null
  jsonLdTypes: string[]
  /** Whether the page has a #arc-page-content element at all. */
  contentFound: boolean
  textHash: string
  textLength: number
  linksHash: string
  linkCount: number
  buildId: string | null
  /** The page has getStaticProps (__NEXT_DATA__.gsp), so the client fetches its /_next/data JSON. */
  gsp: boolean
  /** The __NEXT_DATA__ page, e.g. '/articles/[slug]'. */
  nextPage: string | null
}

export interface RangeSummary {
  contentRange: string | null
  /** The complete length from Content-Range (the N of bytes 0-1/N), or null. */
  total: number | null
  /** The bytes received, hex (2 bytes for a 206 to bytes=0-1). */
  head: string
}

export interface Snapshot {
  url: string | null
  /** HTTP status, or null when the request failed (error says why). */
  status: number | null
  error?: string
  contentType: string | null
  /** The redirect target, as a path when it stays on the answering origin. */
  location: string | null
  xRobotsTag: string | null
  cacheControl: string | null
  kind: BodyKind
  bodyHash?: string
  bodyBytes?: number
  page?: PageSummary
  range?: RangeSummary
  // Working fields, never serialized (reportJson drops every key that starts with '_'):
  /** The normalized #arc-page-content text and links, for diff excerpts. */
  _text?: string
  _links?: string[]
  /** The /_next/static files the page references (cache probes). */
  _assets?: string[]
  /** A parsed sitemap body (diffed entry by entry, not by hash). */
  _sitemap?: ParsedSitemap
  /** The raw JSON text, kept only for the archive index (it names the records). */
  _body?: string
}

export interface FieldDiff {
  field: string
  a: string
  b: string
  severity: Severity
  note?: string
}

export interface TargetResult {
  key: string
  group: Group
  mustServe?: boolean
  verdict: Verdict
  diffs: FieldDiff[]
  a: Snapshot
  b: Snapshot
}

/** What an origin's X-Robots-Tag must say on its HTML and PDF responses. */
export type RobotsExpectation = 'noindex' | 'absent' | 'any'

export interface CompareOptions {
  expectXRobots: { a: RobotsExpectation; b: RobotsExpectation }
}

// ---------------------------------------------------------------------------------------------
// Hashing and normalization

export const hash16 = (data: string | Uint8Array) =>
  createHash('sha256').update(data).digest('hex').slice(0, 16)

/**
 * Patterns that legitimately differ between two builds of one commit and are masked before
 * hashing: ISO timestamps that carry a time, Next build ids in /_next/ paths, and CSP nonces.
 * Bare dates (2045-04-12) are content (story dates) and are kept.
 */
export const VOLATILE_PATTERNS: [RegExp, string][] = [
  [
    /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2}| ?UTC| ?GMT)?/g,
    '<timestamp>',
  ],
  [/\/_next\/(static|data)\/[A-Za-z0-9_-]{16,}\//g, '/_next/$1/<build>/'],
  [/\bnonce-[A-Za-z0-9+/=_-]{8,}/g, 'nonce-<nonce>'],
]

/** Whitespace (incl. NBSP and the other Unicode spaces) collapses; zero-width characters drop. */
export function normalizeText(text: string, extra: RegExp[] = []): string {
  let out = text.normalize('NFC').replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
  for (const [pattern, replacement] of VOLATILE_PATTERNS) out = out.replace(pattern, replacement)
  for (const pattern of extra) out = out.replace(pattern, '<ignored>')
  return out.replace(/[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/g, ' ').trim()
}

/**
 * A URL reference from page content, comparable across origins: any of `origins` (A, B and the
 * canonical site) collapses to a path, so B linking to /about matches A linking to
 * https://alexwelcing.com/about. Every /_next/ file collapses to one token, since chunk and build
 * hashes differ between two builds of one commit. Relative references resolve against origins[0].
 */
export function normalizeRef(value: string, origins: string[]): string {
  const raw = value.trim()
  let url: URL
  try {
    url = new URL(raw, `${origins[0] ?? 'https://invalid.example'}/`)
  } catch {
    return raw
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return raw
  const known = origins.some((origin) => sameOrigin(origin, url.origin))
  if (!known) return url.href
  return url.pathname.startsWith('/_next/')
    ? '/_next/<asset>'
    : `${url.pathname}${url.search}${url.hash}`
}

function sameOrigin(origin: string, other: string): boolean {
  try {
    return new URL(origin).origin === other
  } catch {
    return false
  }
}

/** Stable JSON: object keys sorted at every depth, so key order never changes the hash. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** The hash of a JSON body by value (whitespace and key order ignored), else of its text. */
export function jsonHash(text: string): string {
  try {
    return hash16(stableStringify(JSON.parse(text)))
  } catch {
    return hash16(text)
  }
}

/** The hash of a text body with line endings and trailing whitespace normalized. */
export const textBodyHash = (text: string) =>
  hash16(
    text
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+$/gm, '')
      .trimEnd()
  )

// ---------------------------------------------------------------------------------------------
// HTML

export type HtmlToken =
  | { type: 'start'; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { type: 'end'; name: string }
  | { type: 'text'; text: string }
  /** The undecoded contents of a raw-text element (script, style, title, ...). */
  | { type: 'raw'; name: string; text: string }

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
/** Elements whose contents are not markup. noscript counts: browsers with scripting do the same. */
const RAW_TEXT_ELEMENTS = new Set([
  'script',
  'style',
  'title',
  'textarea',
  'noscript',
  'iframe',
  'xmp',
  'noembed',
  'noframes',
])

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  ndash: '\u2013',
  mdash: '—',
  hellip: '\u2026',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  laquo: '\u00ab',
  raquo: '\u00bb',
  middot: '\u00b7',
  bull: '\u2022',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  deg: '\u00b0',
  times: '\u00d7',
  rarr: '\u2192',
  larr: '\u2190',
  eacute: '\u00e9',
}

/** Decodes numeric references and the common named entities; unknown names stay as written. */
export function decodeEntities(text: string): string {
  if (!text.includes('&')) return text
  return text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);?/g, (match, ref: string) => {
    if (ref[0] === '#') {
      const hex = ref[1] === 'x' || ref[1] === 'X'
      const code = hex ? parseInt(ref.slice(2), 16) : Number(ref.slice(1))
      const valid = Number.isFinite(code) && code > 0 && code <= 0x10ffff
      return valid && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd'
    }
    if (!match.endsWith(';')) return match
    return NAMED_ENTITIES[ref] ?? match
  })
}

/**
 * A small, lenient HTML tokenizer: enough for server-rendered Next pages (comments, doctype, quoted
 * attributes containing '>', raw-text elements). It never throws on malformed input.
 */
export function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = []
  const lower = html.toLowerCase()
  let i = 0
  let textStart = 0
  const flushText = (end: number) => {
    if (end > textStart) tokens.push({ type: 'text', text: html.slice(textStart, end) })
  }
  while (i < html.length) {
    const lt = html.indexOf('<', i)
    if (lt === -1) break
    const next = html[lt + 1] ?? ''
    if (html.startsWith('<!--', lt)) {
      flushText(lt)
      const close = html.indexOf('-->', lt + 4)
      i = textStart = close === -1 ? html.length : close + 3
      continue
    }
    if (next === '!' || next === '?') {
      flushText(lt)
      const close = html.indexOf('>', lt)
      i = textStart = close === -1 ? html.length : close + 1
      continue
    }
    if (next === '/') {
      const match = /^<\/([A-Za-z][^\s/>]*)[^>]*>/.exec(html.slice(lt, lt + 256))
      if (!match) {
        i = lt + 1
        continue
      }
      flushText(lt)
      tokens.push({ type: 'end', name: match[1].toLowerCase() })
      i = textStart = lt + match[0].length
      continue
    }
    if (!/[A-Za-z]/.test(next)) {
      i = lt + 1
      continue
    }
    flushText(lt)
    const tag = readStartTag(html, lt)
    tokens.push(tag.token)
    i = textStart = tag.end
    const { name, selfClosing } = tag.token
    if (RAW_TEXT_ELEMENTS.has(name) && !selfClosing) {
      const close = lower.indexOf(`</${name}`, i)
      const end = close === -1 ? html.length : close
      tokens.push({ type: 'raw', name, text: html.slice(i, end) })
      if (close === -1) {
        i = textStart = html.length
      } else {
        const gt = html.indexOf('>', close)
        tokens.push({ type: 'end', name })
        i = textStart = gt === -1 ? html.length : gt + 1
      }
    }
  }
  flushText(html.length)
  return tokens
}

function readStartTag(
  html: string,
  lt: number
): { token: Extract<HtmlToken, { type: 'start' }>; end: number } {
  let i = lt + 1
  while (i < html.length && !/[\s/>]/.test(html[i])) i++
  const name = html.slice(lt + 1, i).toLowerCase()
  const attrs: Record<string, string> = {}
  let selfClosing = false
  while (i < html.length) {
    const c = html[i]
    if (c === '>') {
      i++
      break
    }
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '/') {
      selfClosing = html[i + 1] === '>'
      i++
      continue
    }
    const nameStart = i
    while (i < html.length && !/[\s=/>]/.test(html[i])) i++
    const attr = html.slice(nameStart, i).toLowerCase()
    while (i < html.length && /\s/.test(html[i])) i++
    let value = ''
    if (html[i] === '=') {
      i++
      while (i < html.length && /\s/.test(html[i])) i++
      const quote = html[i]
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1)
        const end = close === -1 ? html.length : close
        value = html.slice(i + 1, end)
        i = end + 1
      } else {
        const start = i
        while (i < html.length && !/[\s>]/.test(html[i])) i++
        value = html.slice(start, i)
      }
    }
    if (attr && !(attr in attrs)) attrs[attr] = decodeEntities(value)
  }
  return { token: { type: 'start', name, attrs, selfClosing }, end: i }
}

export interface PageFacts {
  title: string | null
  /** The first <meta name|property> of each key (lowercased), with its content. */
  metas: Record<string, string>
  canonical: string | null
  jsonLdTypes: string[]
  next: { buildId: string | null; page: string | null; gsp: boolean }
  content: { found: boolean; text: string; links: string[] }
  /** /_next/static stylesheets and scripts, in document order. */
  nextAssets: string[]
}

/** The `@type`s of a JSON-LD value, through arrays and @graph. */
export function jsonLdTypes(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) jsonLdTypes(item, out)
  } else if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const type = record['@type']
    for (const t of Array.isArray(type) ? type : [type]) if (typeof t === 'string') out.push(t)
    if (record['@graph']) jsonLdTypes(record['@graph'], out)
  }
  return out
}

/** Link-bearing attributes inside #arc-page-content. */
const REF_ATTRS: Record<string, string[]> = {
  a: ['href'],
  img: ['src'],
  source: ['src'],
  video: ['src', 'poster'],
  audio: ['src'],
  iframe: ['src'],
}

/** Everything the parity diff reads from one HTML document. */
export function extractPage(html: string): PageFacts {
  const facts: PageFacts = {
    title: null,
    metas: {},
    canonical: null,
    jsonLdTypes: [],
    next: { buildId: null, page: null, gsp: false },
    content: { found: false, text: '', links: [] },
    nextAssets: [],
  }
  const text: string[] = []
  /** Open elements inside #arc-page-content; capture ends when it empties again. */
  let stack: string[] | null = null
  let captured = false
  let svgDepth = 0
  let pendingScript: Record<string, string> | null = null

  for (const token of tokenizeHtml(html)) {
    if (token.type === 'start') {
      const { name, attrs } = token
      if (name === 'svg' && !token.selfClosing) svgDepth++
      if (name === 'meta') {
        const key = (attrs.name ?? attrs.property ?? '').toLowerCase()
        if (key && !(key in facts.metas)) facts.metas[key] = attrs.content ?? ''
      } else if (name === 'link') {
        const rel = (attrs.rel ?? '').toLowerCase().split(/\s+/)
        if (rel.includes('canonical') && facts.canonical === null)
          facts.canonical = attrs.href ?? ''
        if (rel.includes('stylesheet') && attrs.href?.startsWith('/_next/static/')) {
          facts.nextAssets.push(attrs.href)
        }
      } else if (name === 'script') {
        pendingScript = attrs
        if (attrs.src?.startsWith('/_next/static/')) facts.nextAssets.push(attrs.src)
      }

      if (stack) {
        for (const attr of REF_ATTRS[name] ?? []) {
          if (attrs[attr]) facts.content.links.push(`${name}:${attrs[attr]}`)
        }
        text.push(' ')
        if (!VOID_ELEMENTS.has(name) && !token.selfClosing) stack.push(name)
      } else if (!captured && attrs.id === 'arc-page-content') {
        facts.content.found = true
        captured = true
        if (!VOID_ELEMENTS.has(name) && !token.selfClosing) stack = [name]
      }
    } else if (token.type === 'end') {
      if (token.name === 'svg' && svgDepth > 0) svgDepth--
      if (stack) {
        const at = stack.lastIndexOf(token.name)
        if (at !== -1) stack.length = at
        text.push(' ')
        if (stack.length === 0) stack = null
      }
    } else if (token.type === 'text') {
      if (stack) text.push(decodeEntities(token.text))
    } else {
      if (token.name === 'title' && facts.title === null && svgDepth === 0) {
        facts.title = normalizeText(decodeEntities(token.text))
      } else if (token.name === 'script' && pendingScript) {
        readScript(pendingScript, token.text, facts)
      }
      // Raw-text contents (scripts, styles, noscript) are never page text.
      pendingScript = null
    }
  }
  facts.content.text = text.join('')
  facts.jsonLdTypes.sort()
  return facts
}

function readScript(attrs: Record<string, string>, body: string, facts: PageFacts) {
  const type = (attrs.type ?? '').toLowerCase()
  if (type === 'application/ld+json') {
    try {
      jsonLdTypes(JSON.parse(body), facts.jsonLdTypes)
    } catch {
      facts.jsonLdTypes.push('(invalid JSON-LD)')
    }
  } else if (attrs.id === '__NEXT_DATA__') {
    try {
      const data = JSON.parse(body) as { buildId?: unknown; page?: unknown; gsp?: unknown }
      facts.next = {
        buildId: typeof data.buildId === 'string' ? data.buildId : null,
        page: typeof data.page === 'string' ? data.page : null,
        gsp: data.gsp === true,
      }
    } catch {
      // A page without readable __NEXT_DATA__ simply has no build id.
    }
  }
}

/** The parity summary of an HTML document, plus the normalized text and links for excerpts. */
export function summarizePage(
  html: string,
  origins: string[],
  ignore: RegExp[] = []
): { page: PageSummary; text: string; links: string[]; assets: string[] } {
  const facts = extractPage(html)
  const text = normalizeText(facts.content.text, ignore)
  const links = facts.content.links.map((link) => {
    const colon = link.indexOf(':')
    return `${link.slice(0, colon)}:${normalizeRef(link.slice(colon + 1), origins)}`
  })
  const meta = (key: string) => (key in facts.metas ? facts.metas[key] : null)
  return {
    page: {
      title: facts.title,
      description: meta('description'),
      canonical: facts.canonical,
      ogImage: meta('og:image'),
      robots: meta('robots'),
      jsonLdTypes: facts.jsonLdTypes,
      contentFound: facts.content.found,
      textHash: hash16(text),
      textLength: text.length,
      linksHash: hash16(links.join('\n')),
      linkCount: links.length,
      buildId: facts.next.buildId,
      gsp: facts.next.gsp,
      nextPage: facts.next.page,
    },
    text,
    links,
    assets: facts.nextAssets,
  }
}

/** The /_next/data URL the client fetches for a getStaticProps page at `route`. */
export function nextDataPath(buildId: string, route: string): string {
  const pathname = route.split(/[?#]/)[0].replace(/\/+$/, '')
  return `/_next/data/${buildId}${pathname === '' ? '/index' : pathname}.json`
}

// ---------------------------------------------------------------------------------------------
// Sitemaps

export interface SitemapEntry {
  loc: string
  lastmod?: string
  video?: { title?: string; thumbnail?: string; content?: string }
}

export interface ParsedSitemap {
  urls: SitemapEntry[]
  /** <sitemapindex> children, when the file is an index. */
  sitemaps: string[]
}

function xmlText(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block)
  if (!match) return undefined
  const inner = match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
  return decodeEntities(inner).trim()
}

export function parseSitemap(xml: string): ParsedSitemap {
  const urls: SitemapEntry[] = []
  for (const [block] of xml.matchAll(/<url\b[^>]*>[\s\S]*?<\/url>/gi)) {
    const loc = xmlText(block, 'loc')
    if (!loc) continue
    const entry: SitemapEntry = { loc }
    const lastmod = xmlText(block, 'lastmod')
    if (lastmod) entry.lastmod = lastmod
    if (/<video:video\b/i.test(block)) {
      entry.video = {
        title: xmlText(block, 'video:title'),
        thumbnail: xmlText(block, 'video:thumbnail_loc'),
        content: xmlText(block, 'video:content_loc'),
      }
    }
    urls.push(entry)
  }
  const sitemaps: string[] = []
  for (const [block] of xml.matchAll(/<sitemap\b[^>]*>[\s\S]*?<\/sitemap>/gi)) {
    const loc = xmlText(block, 'loc')
    if (loc) sitemaps.push(loc)
  }
  return { urls, sitemaps }
}

/** The site-relative path of a sitemap <loc> (path and query; the host is compared separately). */
export function locPath(loc: string): string {
  try {
    const url = new URL(loc)
    return `${url.pathname}${url.search}`
  } catch {
    return loc
  }
}

function locOrigin(loc: string): string {
  try {
    return new URL(loc).origin
  } catch {
    return '(invalid)'
  }
}

/** The hash of a sitemap by content: its entries sorted by <loc>. */
export const sitemapHash = (entries: SitemapEntry[]) =>
  hash16(stableStringify([...entries].sort((x, y) => (x.loc < y.loc ? -1 : x.loc > y.loc ? 1 : 0))))

export interface SitemapDiff {
  sitemap: string
  path: string
  field: string
  a: string
  b: string
  severity: Severity
}

/**
 * Entry-level diff of one sitemap. A <loc> A lists and B does not is a regression; one only B lists
 * is a warning; a changed <lastmod> is a warning; changed video fields and a different <loc> host
 * (a staging build advertising itself) are regressions.
 */
export function compareSitemaps(
  name: string,
  a: SitemapEntry[],
  b: SitemapEntry[] | null
): SitemapDiff[] {
  const diff = (path: string, field: string, x: string, y: string, severity: Severity) => ({
    sitemap: name,
    path,
    field,
    a: x,
    b: y,
    severity,
  })
  if (!b) return [diff(name, 'sitemap', `${a.length} URLs`, 'unavailable', 'regression')]

  const diffs: SitemapDiff[] = []
  const byPath = (entries: SitemapEntry[]) => new Map(entries.map((e) => [locPath(e.loc), e]))
  const hosts = (entries: SitemapEntry[]) =>
    [...new Set(entries.map((e) => locOrigin(e.loc)))].sort().join(' ')
  const aMap = byPath(a)
  const bMap = byPath(b)
  if (a.length > 0 && b.length > 0 && hosts(a) !== hosts(b)) {
    diffs.push(diff(name, 'loc host', hosts(a), hosts(b), 'regression'))
  }
  for (const [path, entry] of aMap) {
    const other = bMap.get(path)
    if (!other) {
      diffs.push(diff(path, 'loc', 'listed', 'missing', 'regression'))
      continue
    }
    if ((entry.lastmod ?? '') !== (other.lastmod ?? '')) {
      diffs.push(
        diff(path, 'lastmod', entry.lastmod ?? '(none)', other.lastmod ?? '(none)', 'warning')
      )
    }
    for (const field of ['title', 'thumbnail', 'content'] as const) {
      const x = entry.video?.[field] ?? ''
      const y = other.video?.[field] ?? ''
      if (x !== y)
        diffs.push(diff(path, `video:${field}`, x || '(none)', y || '(none)', 'regression'))
    }
  }
  for (const path of bMap.keys()) {
    if (!aMap.has(path)) diffs.push(diff(path, 'loc', 'missing', 'listed', 'warning'))
  }
  return diffs
}

// ---------------------------------------------------------------------------------------------
// The diff rules

const PERMANENT_REDIRECTS = new Set([301, 308])
const TEMPORARY_REDIRECTS = new Set([302, 303, 307])
const isRedirect = (status: number | null) =>
  status !== null && (PERMANENT_REDIRECTS.has(status) || TEMPORARY_REDIRECTS.has(status))
const ok = (status: number | null) => status !== null && status >= 200 && status < 300

/**
 * Documented redirect-code differences between the two platforms, in order. Each names its
 * evidence, so a reader of the report can tell an accepted difference from a surprise.
 */
export const REDIRECT_RULES: {
  name: string
  applies: (path: string, a: number, b: number) => boolean
  note: string
}[] = [
  {
    name: 'permanent-equivalent',
    applies: (_path, a, b) => PERMANENT_REDIRECTS.has(a) && PERMANENT_REDIRECTS.has(b),
    note: 'both permanent: Next redirects() answer 308 on Vercel, Cloudflare _redirects rules 301',
  },
  {
    name: 'temporary-equivalent',
    applies: (_path, a, b) => TEMPORARY_REDIRECTS.has(a) && TEMPORARY_REDIRECTS.has(b),
    note: 'both temporary redirects',
  },
  {
    name: 'trailing-slash',
    applies: (path, a, b) => a === 308 && b === 307 && path.length > 1 && path.endsWith('/'),
    note:
      'Workers assets html_handling auto-trailing-slash answers 307 where Vercel answers 308 ' +
      '(accepted in the P2 plan)',
  },
]

/** MIME types that name the same format; a swap between them is a warning, not a regression. */
const MIME_ALIASES: string[][] = [
  ['image/x-icon', 'image/vnd.microsoft.icon'],
  ['application/xml', 'text/xml'],
  ['application/javascript', 'text/javascript', 'application/x-javascript'],
  ['font/ttf', 'application/x-font-ttf', 'font/sfnt', 'application/font-sfnt'],
  ['font/woff2', 'application/font-woff2'],
  ['application/octet-stream', 'binary/octet-stream'],
]

export const mimeEssence = (contentType: string | null) =>
  (contentType ?? '').split(';')[0].trim().toLowerCase()

const mimeParams = (contentType: string | null) =>
  (contentType ?? '')
    .split(';')
    .slice(1)
    .map((p) =>
      p
        .trim()
        .toLowerCase()
        .replace(/\s*=\s*/, '=')
    )
    .filter(Boolean)
    .sort()
    .join('; ')

/** Cache-Control as a sorted directive set, so 'public,max-age=1' equals 'max-age=1, public'. */
export const normalizeCacheControl = (value: string | null) =>
  (value ?? '')
    .split(',')
    .map((d) =>
      d
        .trim()
        .toLowerCase()
        .replace(/\s*=\s*/, '=')
    )
    .filter(Boolean)
    .sort()
    .join(', ')

/** Whether X-Robots-Tag applies: HTML and PDF are the documents search engines index. */
const indexable = (snap: Snapshot) =>
  snap.kind === 'html' || mimeEssence(snap.contentType) === 'application/pdf'

function show(value: unknown): string {
  if (value === null || value === undefined) return '(none)'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)'
  return String(value)
}

function statusText(snap: Snapshot): string {
  if (snap.status === null) return `error: ${snap.error ?? 'request failed'}`
  if (isRedirect(snap.status)) return `${snap.status} -> ${snap.location ?? '(no location)'}`
  return String(snap.status)
}

/** Where two normalized texts first differ, with a little context on each side. */
export function firstDifference(a: string, b: string, context = 40): string {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const from = Math.max(0, i - context)
  const cut = (s: string) =>
    (from > 0 ? '...' : '') + s.slice(from, i + context) + (i + context < s.length ? '...' : '')
  return `first difference at char ${i}: A "${cut(a)}" | B "${cut(b)}"`
}

function listDifference(a: string[], b: string[], limit = 3): string {
  const aSet = new Set(a)
  const bSet = new Set(b)
  const part = (label: string, items: string[]) => {
    if (items.length === 0) return ''
    const more = items.length > limit ? ` (+${items.length - limit})` : ''
    return `${label}: ${items.slice(0, limit).join(', ')}${more}`
  }
  const parts = [
    part(
      'only A',
      a.filter((x) => !bSet.has(x))
    ),
    part(
      'only B',
      b.filter((x) => !aSet.has(x))
    ),
  ].filter(Boolean)
  return parts.length ? parts.join('; ') : 'same links in a different order'
}

type Add = (field: string, a: unknown, b: unknown, severity: Severity, note?: string) => void

/** Every difference between A's and B's answer for one target. */
export function compareSnapshots(
  target: Target,
  a: Snapshot,
  b: Snapshot,
  options: CompareOptions
): FieldDiff[] {
  const diffs: FieldDiff[] = []
  const add: Add = (field, x, y, severity, note) =>
    diffs.push({ field, a: show(x), b: show(y), severity, ...(note ? { note } : {}) })

  // A file every deployment must serve: B failing is a regression even when A fails too.
  if (target.mustServe) {
    const listed = 'listed in scripts/verify/must-serve.txt'
    if (!ok(b.status))
      add('must-serve', statusText(a), statusText(b), 'regression', `B must answer 2xx: ${listed}`)
    if (!ok(a.status))
      add(
        'must-serve',
        statusText(a),
        statusText(b),
        'warning',
        `A does not serve it either: ${listed}`
      )
  }

  checkXRobots(a, b, options, add)
  checkIndexable(target, a, b, add)

  if (a.status === null || b.status === null) {
    if (a.status === null && b.status === null) {
      add('status', statusText(a), statusText(b), 'warning', 'neither origin answered')
    } else if (b.status === null) {
      add('status', statusText(a), statusText(b), 'regression', 'B did not answer')
    } else {
      add('status', statusText(a), statusText(b), 'warning', 'A did not answer: nothing to compare')
    }
    return diffs
  }

  // Both failing alike is no parity difference, but a path A itself names (its sitemap, archive,
  // build) should exist: say so rather than report it identical.
  if (a.status === b.status && !ok(a.status) && !isRedirect(a.status)) {
    const note = SHOULD_SERVE[target.group]
    if (note) add('status', a.status, b.status, 'warning', note)
  }

  if (a.status !== b.status) {
    if (isRedirect(a.status) && isRedirect(b.status)) {
      const rule = REDIRECT_RULES.find((r) => r.applies(target.key, a.status!, b.status!))
      const note = rule?.note ?? 'redirect permanence changed (301/308 vs 302/303/307)'
      add('status', a.status, b.status, rule ? 'expected' : 'warning', note)
    } else {
      const lost = b.status >= 500 || (a.status >= 200 && a.status < 400)
      const note = lost ? undefined : 'A does not serve this path; B answers differently'
      add('status', statusText(a), statusText(b), lost ? 'regression' : 'warning', note)
      return diffs
    }
  }

  if (isRedirect(a.status)) {
    if ((a.location ?? '') !== (b.location ?? ''))
      add('location', a.location, b.location, 'regression')
    return diffs
  }

  compareContentType(a, b, add)
  if (normalizeCacheControl(a.cacheControl) !== normalizeCacheControl(b.cacheControl)) {
    add('cache-control', a.cacheControl, b.cacheControl, 'warning')
  }
  // Cache probes name different hashed files per origin: only status, type and caching compare.
  if (target.group === 'cache') return diffs

  if (a.kind === 'html' && b.kind === 'html' && a.page && b.page) {
    comparePages(a, b, add)
  } else if (a.kind === 'range' && b.kind === 'range' && a.range && b.range) {
    if ((a.range.contentRange ?? '') !== (b.range.contentRange ?? '')) {
      const note = a.range.total !== b.range.total ? 'different file length' : undefined
      add('content-range', a.range.contentRange, b.range.contentRange, 'regression', note)
    }
    if (a.range.head !== b.range.head) add('range bytes', a.range.head, b.range.head, 'regression')
  } else if (a.kind !== b.kind) {
    add('body kind', a.kind, b.kind, 'regression')
  } else if (a.kind === 'xml' && a._sitemap && b._sitemap) {
    // Sitemaps are diffed entry by entry (compareSitemaps), so an added URL stays a warning.
  } else if ((a.bodyHash ?? '') !== (b.bodyHash ?? '')) {
    const sized = a.bodyBytes !== undefined && b.bodyBytes !== undefined
    add(
      'body',
      a.bodyHash,
      b.bodyHash,
      'regression',
      sized ? `${a.bodyBytes} vs ${b.bodyBytes} bytes` : undefined
    )
  }
  return diffs
}

/** Groups whose paths A itself names, so both origins failing them is worth a warning. */
const SHOULD_SERVE: Partial<Record<Group, string>> = {
  sitemap: 'neither origin serves a page a sitemap lists',
  static: 'neither origin serves a static route (scripts/generate-sitemaps.ts STATIC_ROUTES)',
  archive: "neither origin serves a record A's /arc/archive.json names",
  record: 'neither origin serves the reader JSON of an archive record',
  'next-data': 'neither origin serves the /_next/data JSON its own page names',
  search:
    'neither origin serves this search asset: lib/generated/search-manifest.json names ' +
    'content-hashed files, so run the crawl from the commit both origins deployed',
}

/** The robots meta of a page says noindex (X-Robots-Tag is the staging gate, checked apart). */
const metaNoindex = (page: PageSummary) => /noindex|\bnone\b/i.test(page.robots ?? '')

/**
 * Each origin's sitemaps must list exactly its indexable pages: a listed page with a noindex robots
 * meta, or an indexable page they leave out, fails for B and warns for A (production is the
 * reference, so its own inconsistency is reported but is not a parity regression).
 */
function checkIndexable(target: Target, a: Snapshot, b: Snapshot, add: Add) {
  if (!target.listed) return
  const sides = [
    ['A', a, target.listed.a, 'warning'],
    ['B', b, target.listed.b, 'regression'],
  ] as const
  for (const [side, snap, listed, severity] of sides) {
    if (listed === undefined || snap.status !== 200 || snap.kind !== 'html' || !snap.page) continue
    const noindex = metaNoindex(snap.page)
    if (listed === noindex) {
      const note = listed
        ? `${side}'s sitemap lists a page whose robots meta says noindex`
        : `${side}'s sitemaps leave out a page whose robots meta lets it be indexed`
      const state = (s: Snapshot, l: boolean | undefined) =>
        `${l === undefined ? '?' : l ? 'listed' : 'unlisted'}, ${
          s.page?.robots ?? 'no robots meta'
        }`
      add(
        `indexable (${side})`,
        state(a, target.listed.a),
        state(b, target.listed.b),
        severity,
        note
      )
    }
  }
}

function checkXRobots(a: Snapshot, b: Snapshot, options: CompareOptions, add: Add) {
  const sides = [
    ['A', a, options.expectXRobots.a],
    ['B', b, options.expectXRobots.b],
  ] as const
  for (const [side, snap, expectation] of sides) {
    if (expectation === 'any' || !ok(snap.status) || !indexable(snap)) continue
    const noindex = /noindex|\bnone\b/i.test(snap.xRobotsTag ?? '')
    const field = `x-robots-tag (${side})`
    if (expectation === 'noindex' && !noindex) {
      const note = `${side} must send X-Robots-Tag: noindex (a staging origin stays out of the index)`
      add(field, a.xRobotsTag, b.xRobotsTag, 'regression', note)
    } else if (expectation === 'absent' && noindex) {
      const note = `${side} sends noindex, which would deindex the production page`
      add(field, a.xRobotsTag, b.xRobotsTag, 'regression', note)
    }
  }
}

function compareContentType(a: Snapshot, b: Snapshot, add: Add) {
  const x = mimeEssence(a.contentType)
  const y = mimeEssence(b.contentType)
  if (x !== y) {
    const alias = MIME_ALIASES.some((group) => group.includes(x) && group.includes(y))
    const severity = alias ? 'warning' : 'regression'
    add(
      'content-type',
      a.contentType,
      b.contentType,
      severity,
      alias ? 'equivalent MIME types' : undefined
    )
  } else if (mimeParams(a.contentType) !== mimeParams(b.contentType)) {
    add('content-type', a.contentType, b.contentType, 'warning', 'same type, different parameters')
  }
}

function comparePages(a: Snapshot, b: Snapshot, add: Add) {
  const x = a.page!
  const y = b.page!
  for (const field of ['title', 'description', 'canonical', 'ogImage', 'robots'] as const) {
    if (x[field] !== y[field]) add(field, x[field], y[field], 'regression')
  }
  if (x.jsonLdTypes.join(',') !== y.jsonLdTypes.join(',')) {
    add('json-ld types', x.jsonLdTypes, y.jsonLdTypes, 'regression')
  }
  if (x.contentFound !== y.contentFound) {
    const state = (found: boolean) => (found ? 'present' : 'missing')
    add('#arc-page-content', state(x.contentFound), state(y.contentFound), 'regression')
    return
  }
  if (x.textHash !== y.textHash) {
    const excerpt =
      a._text !== undefined && b._text !== undefined ? `; ${firstDifference(a._text, b._text)}` : ''
    add(
      'text',
      x.textHash,
      y.textHash,
      'regression',
      `${x.textLength} vs ${y.textLength} chars${excerpt}`
    )
  }
  if (x.linksHash !== y.linksHash) {
    const detail = a._links && b._links ? `; ${listDifference(a._links, b._links)}` : ''
    add(
      'links',
      x.linksHash,
      y.linksHash,
      'regression',
      `${x.linkCount} vs ${y.linkCount} links${detail}`
    )
  }
}

const RANK: Record<Verdict, number> = { identical: 0, expected: 1, warning: 2, regression: 3 }

/** The worst severity among a target's diffs. */
export const verdictOf = (diffs: { severity: Severity }[]): Verdict =>
  diffs.reduce<Verdict>(
    (worst, d) => (RANK[d.severity] > RANK[worst] ? d.severity : worst),
    'identical'
  )

// ---------------------------------------------------------------------------------------------
// Targets

/** Parses scripts/verify/must-serve.txt: one site-relative path per line, '#' comments. */
export function parseMustServe(text: string): string[] {
  const paths: string[] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    if (!line.startsWith('/')) throw new Error(`must-serve: "${line}" is not a site-relative path`)
    paths.push(line)
  }
  return paths
}

/** n items evenly spread over `items`, always including the first; all of them when n is 0. */
export function sample<T>(items: T[], n: number): T[] {
  if (n <= 0 || n >= items.length) return items
  const step = items.length / n
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)])
}

/** Targets keyed by path: the first group added wins, the must-serve and range flags accumulate. */
export class TargetSet {
  private byKey = new Map<string, Target>()

  add(path: string, group: Group, flags: { range?: boolean; mustServe?: boolean } = {}): void {
    const existing = this.byKey.get(path)
    if (existing) {
      if (flags.range) existing.range = true
      if (flags.mustServe) existing.mustServe = true
      return
    }
    this.byKey.set(path, { key: path, group, a: path, b: path, ...flags })
  }

  addTarget(target: Target): void {
    if (!this.byKey.has(target.key)) this.byKey.set(target.key, target)
  }

  get size() {
    return this.byKey.size
  }

  list(): Target[] {
    return [...this.byKey.values()]
  }
}

// ---------------------------------------------------------------------------------------------
// The report

export interface OriginInfo {
  origin: string
  /** Every Next build id seen; more than one means the origin redeployed during the crawl. */
  buildIds: string[]
}

export interface ParitySummary {
  targets: number
  identical: number
  expected: number
  warnings: number
  regressions: number
  sitemapRegressions: number
  sitemapWarnings: number
  byGroup: Record<string, { targets: number; regressions: number; warnings: number }>
}

export interface ParityReport {
  schema: 'parity-report/1'
  startedAt: string
  finishedAt: string
  a: OriginInfo
  b: OriginInfo
  options: Record<string, unknown>
  summary: ParitySummary
  notes: string[]
  sitemaps: Record<string, { a: number; b: number | null; diffs: SitemapDiff[] }>
  results: TargetResult[]
}

export function summarize(
  results: TargetResult[],
  sitemaps: ParityReport['sitemaps']
): ParitySummary {
  const summary: ParitySummary = {
    targets: results.length,
    identical: 0,
    expected: 0,
    warnings: 0,
    regressions: 0,
    sitemapRegressions: 0,
    sitemapWarnings: 0,
    byGroup: {},
  }
  for (const result of results) {
    const group = (summary.byGroup[result.group] ??= { targets: 0, regressions: 0, warnings: 0 })
    group.targets++
    if (result.verdict === 'identical') summary.identical++
    else if (result.verdict === 'expected') summary.expected++
    else if (result.verdict === 'warning') {
      summary.warnings++
      group.warnings++
    } else {
      summary.regressions++
      group.regressions++
    }
  }
  for (const { diffs } of Object.values(sitemaps)) {
    for (const diff of diffs) {
      if (diff.severity === 'regression') summary.sitemapRegressions++
      else if (diff.severity === 'warning') summary.sitemapWarnings++
    }
  }
  return summary
}

/** The exit code: 1 on any regression (or, with strict, any warning), else 0. */
export function exitCode(summary: ParitySummary, strict = false): number {
  if (summary.regressions > 0 || summary.sitemapRegressions > 0) return 1
  if (strict && (summary.warnings > 0 || summary.sitemapWarnings > 0)) return 1
  return 0
}

/** JSON.stringify for the report: drops the underscore-prefixed working fields. */
export const reportJson = (report: ParityReport) =>
  `${JSON.stringify(report, (key, value) => (key.startsWith('_') ? undefined : value), 2)}\n`

export interface Row {
  severity: Severity
  path: string
  field: string
  a: string
  b: string
  note?: string
}

const SEVERITY_ORDER: Record<Severity, number> = { regression: 0, warning: 1, expected: 2 }
const byText = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0)

/** Every diff as a flat row: regressions first, then warnings, then expected; by path within. */
export function reportRows(report: ParityReport): Row[] {
  const rows: Row[] = []
  for (const result of report.results) {
    for (const diff of result.diffs) rows.push({ path: result.key, ...diff })
  }
  for (const { diffs } of Object.values(report.sitemaps)) {
    for (const d of diffs) {
      rows.push({
        severity: d.severity,
        path: d.path,
        field: `${d.sitemap} ${d.field}`,
        a: d.a,
        b: d.b,
      })
    }
  }
  return rows.sort(
    (x, y) =>
      SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity] ||
      byText(x.path, y.path) ||
      byText(x.field, y.field)
  )
}

export interface GroupedRow extends Row {
  /** Every path with exactly this difference, in report order; `path` is the first of them. */
  paths: string[]
}

/**
 * Rows that differ only in their path collapse into one, so a platform-wide difference (a default
 * Cache-Control, say) prints as one line instead of hundreds. Rows keep reportRows' order.
 */
export function groupRows(rows: Row[]): GroupedRow[] {
  const groups = new Map<string, GroupedRow>()
  for (const row of rows) {
    const key = JSON.stringify([row.severity, row.field, row.a, row.b, row.note ?? ''])
    const group = groups.get(key)
    if (group) group.paths.push(row.path)
    else groups.set(key, { ...row, paths: [row.path] })
  }
  return [...groups.values()]
}

const clip = (value: string, width: number) =>
  value.length <= width ? value : `${value.slice(0, Math.max(0, width - 3))}...`

/** The first path, clipped so that a "(+N)" count of the others always fits in `width`. */
function pathCell(row: GroupedRow, width: number): string {
  const more = row.paths.length > 1 ? ` (+${row.paths.length - 1})` : ''
  return `${clip(row.path, width - more.length)}${more}`
}

function summaryLine(report: ParityReport): string {
  const s = report.summary
  return (
    `${s.targets} URLs: ${s.identical} identical, ${s.expected} expected-only, ` +
    `${s.warnings} with warnings, ${s.regressions} with regressions; sitemaps: ` +
    `${s.sitemapRegressions} regressions, ${s.sitemapWarnings} warnings`
  )
}

const groupedLine = (rows: Row[], grouped: GroupedRow[]) =>
  `${grouped.length} distinct differences (${rows.length} rows; "(+N)" counts the other paths ` +
  'with the same difference, all listed in the JSON report)'

/**
 * The readable terminal table: fixed-width columns, each note on an indented line below, rows
 * that differ only by path grouped into one.
 */
export function renderTable(report: ParityReport, maxRows = 200): string {
  const all = reportRows(report)
  const rows = groupRows(all)
  const lines = [`parity  A ${report.a.origin}  vs  B ${report.b.origin}`, summaryLine(report)]
  for (const note of report.notes) lines.push(`note: ${note}`)
  if (rows.length === 0) {
    lines.push('', 'no differences')
    return `${lines.join('\n')}\n`
  }
  lines.push(groupedLine(all, rows))
  const w = { severity: 10, path: 48, field: 16, value: 34 }
  const header = [
    'SEVERITY'.padEnd(w.severity),
    'PATH'.padEnd(w.path),
    'FIELD'.padEnd(w.field),
    'A'.padEnd(w.value),
    'B',
  ].join('  ')
  lines.push('', header, '-'.repeat(header.length + w.value - 1))
  for (const row of rows.slice(0, maxRows)) {
    lines.push(
      [
        row.severity.padEnd(w.severity),
        pathCell(row, w.path).padEnd(w.path),
        clip(row.field, w.field).padEnd(w.field),
        clip(row.a, w.value).padEnd(w.value),
        clip(row.b, w.value),
      ].join('  ')
    )
    if (row.note) lines.push(`${' '.repeat(w.severity + 2)}${clip(row.note, 160)}`)
  }
  if (rows.length > maxRows) {
    lines.push(`... ${rows.length - maxRows} more distinct differences in the JSON report`)
  }
  return `${lines.join('\n')}\n`
}

const cell = (value: string, width = 120) =>
  clip(value, width).replace(/\|/g, '\\|').replace(/\n/g, ' ')

/** The same rows as a GitHub-flavoured Markdown table (a job summary or a PR comment). */
export function renderMarkdown(report: ParityReport, maxRows = 200): string {
  const all = reportRows(report)
  const rows = groupRows(all)
  const verdict = exitCode(report.summary) === 0 ? 'PASS' : 'FAIL'
  const lines = [
    `### Parity crawl: ${verdict}`,
    '',
    `A \`${report.a.origin}\` vs B \`${report.b.origin}\` (${report.finishedAt})`,
    '',
    summaryLine(report),
  ]
  for (const note of report.notes) lines.push('', `> ${cell(note, 400)}`)
  if (rows.length > 0) {
    lines.push(
      '',
      groupedLine(all, rows),
      '',
      '| severity | path | field | A | B | note |',
      '| --- | --- | --- | --- | --- | --- |'
    )
    for (const row of rows.slice(0, maxRows)) {
      const more = row.paths.length > 1 ? ` (+${row.paths.length - 1})` : ''
      const cells = [
        row.severity,
        `\`${cell(row.path, 80)}\`${more}`,
        cell(row.field),
        cell(row.a, 60),
        cell(row.b, 60),
        cell(row.note ?? '', 200),
      ]
      lines.push(`| ${cells.join(' | ')} |`)
    }
    if (rows.length > maxRows)
      lines.push('', `${rows.length - maxRows} more distinct differences in the JSON report.`)
  }
  return `${lines.join('\n')}\n`
}
