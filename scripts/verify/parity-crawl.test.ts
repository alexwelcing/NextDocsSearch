import { mkdtemp, readFile, rm } from 'node:fs/promises'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { STATIC_ROUTES } from '../generate-sitemaps'
import {
  FatalError,
  type Options,
  Pacer,
  UsageError,
  archiveSlugs,
  main,
  parseCli,
  parseOrigin,
  retryDelay,
  runParity,
  searchAssets,
} from './parity-crawl'
import { exitCode } from './parity'

const SITE = 'https://alexwelcing.com'

interface Variant {
  buildId: string
  /** X-Robots-Tag on every HTML answer (the staging gate). */
  xRobots?: string
  /** Status for permanent redirects (Vercel 308, Cloudflare _redirects 301). */
  permanent: number
  /** Status for the trailing-slash redirect (Vercel 308, Workers assets 307). */
  slash: number
  /** Whether MP4s answer Range requests. */
  ranges: boolean
  /** Per-path text replacements in the page body. */
  text?: Record<string, string>
  /** /_next/data routes this build lacks. */
  missingData?: string[]
  cssCache?: string
  /** Per-path robots meta, overriding the default (thin records are noindex). */
  robots?: Record<string, string>
}

const VERCEL: Variant = {
  buildId: 'vercelBuildId000000001',
  permanent: 308,
  slash: 308,
  ranges: true,
}
const MP4 = Buffer.from('0123456789abcdefghij')

function page(route: string, v: Variant, robots = 'index, follow') {
  const text = v.text?.[route] ?? `The record at ${route}.`
  const data = { props: { pageProps: { route } }, page: route, buildId: v.buildId, gsp: true }
  return (
    `<!DOCTYPE html><html><head><title>${route} — Alex Welcing</title>` +
    `<meta name="robots" content="${robots}"/><link rel="canonical" href="${SITE}${route}"/>` +
    `<meta property="og:image" content="${SITE}/social-preview.png"/>` +
    `<link rel="stylesheet" href="/_next/static/css/${v.buildId}.css"/>` +
    `<script src="/_next/static/chunks/main-${v.buildId}.js" defer=""></script></head><body>` +
    `<div id="arc-page-content"><main><h1>${route}</h1><p>${text}</p><a href="${SITE}/articles">Archive</a></main></div>` +
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
      data
    )}</script></body></html>`
  )
}

const ARTICLES = ['one', 'two', 'thin']
const PAGES = [...STATIC_ROUTES, '/articles/one', '/articles/two', '/articles/thin', '/videos/one']
const urlset = (paths: string[], extra = '') =>
  `<?xml version="1.0"?><urlset>${paths
    .map((p) => `<url><loc>${SITE}${p}</loc>${extra}</url>`)
    .join('')}</urlset>`

/** A tiny copy of the site, as one platform would serve it. */
function site(v: Variant): http.RequestListener {
  return (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    const route = url.pathname
    const send = (
      status: number,
      type: string,
      body: string | Buffer,
      headers: Record<string, string> = {}
    ) => {
      res.writeHead(status, {
        'content-type': type,
        'cache-control': 'public, max-age=0, must-revalidate',
        ...headers,
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    }
    const html = (status: number, body: string) =>
      send(status, 'text/html; charset=utf-8', body, v.xRobots ? { 'x-robots-tag': v.xRobots } : {})
    const redirects: Record<string, [number, string]> = {
      '/explore': [v.permanent, '/'],
      '/docs/articles': [v.permanent, '/articles'],
      '/about/': [v.slash, '/about'],
    }
    const docs = /^\/docs\/articles\/(.+)$/.exec(route)
    if (redirects[route] || docs) {
      const [status, location] = redirects[route] ?? [v.permanent, `/articles/${docs![1]}`]
      return send(status, 'text/plain', '', { location })
    }
    if (route === '/sitemap.xml') {
      return send(200, 'application/xml', urlset(PAGES.filter((p) => p !== '/articles/thin')))
    }
    if (route === '/video-sitemap.xml') {
      const video = `<video:video><video:title>One</video:title><video:content_loc>${SITE}/films/one.mp4</video:content_loc></video:video>`
      return send(200, 'application/xml', urlset(['/videos/one'], video))
    }
    if (route === '/arc/archive.json') {
      return send(
        200,
        'application/json',
        JSON.stringify({ records: ARTICLES.map((slug) => ({ slug })), total: 3 })
      )
    }
    const record = /^\/arc\/records\/([a-z]+)\.json$/.exec(route)
    if (record && ARTICLES.includes(record[1])) {
      return send(200, 'application/json', JSON.stringify({ slug: record[1], blocks: [] }))
    }
    if (route === '/robots.txt') return send(200, 'text/plain', 'User-agent: *\nAllow: /\n')
    if (route === '/search/chunks.abc.json') return send(200, 'application/json', '{"chunks":[]}')
    if (route === `/_next/static/css/${v.buildId}.css`) {
      return send(200, 'text/css', 'body{}', {
        'cache-control': v.cssCache ?? 'public, max-age=31536000, immutable',
      })
    }
    if (route === `/_next/static/chunks/main-${v.buildId}.js`) {
      return send(200, 'application/javascript', 'x', {
        'cache-control': 'public, max-age=31536000, immutable',
      })
    }
    if (route === '/films/one.mp4') {
      const range = /^bytes=(\d+)-(\d+)$/.exec(String(req.headers.range ?? ''))
      if (v.ranges && range) {
        const [start, end] = [Number(range[1]), Number(range[2])]
        return send(206, 'video/mp4', MP4.subarray(start, end + 1), {
          'content-range': `bytes ${start}-${end}/${MP4.length}`,
        })
      }
      return send(200, 'video/mp4', MP4, { 'accept-ranges': 'none' })
    }
    const data = new RegExp(`^/_next/data/${v.buildId}(/.*)\\.json$`).exec(route)
    if (data) {
      const pageRoute = data[1] === '/index' ? '/' : data[1]
      if (PAGES.includes(pageRoute) && !v.missingData?.includes(pageRoute)) {
        return send(
          200,
          'application/json',
          JSON.stringify({ pageProps: { route: pageRoute }, __N_SSG: true })
        )
      }
    }
    if (PAGES.includes(route)) {
      const robots =
        v.robots?.[route] ?? (route === '/articles/thin' ? 'noindex, follow' : undefined)
      return html(200, page(route, v, robots))
    }
    return html(
      404,
      '<html><head><title>RECORD NOT FOUND</title></head><body><div id="arc-page-content"><h1>RECORD NOT FOUND</h1></div></body></html>'
    )
  }
}

const servers: http.Server[] = []
async function serve(v: Variant | http.RequestListener): Promise<string> {
  const server = http.createServer(typeof v === 'function' ? v : site(v))
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const MUST_SERVE =
  '/robots.txt\n/sitemap.xml\n/video-sitemap.xml\n/arc/archive.json\n/films/one.mp4\n/resumes/gone.pdf\n'
const repoFiles = (file: string) =>
  file.endsWith('must-serve.txt')
    ? MUST_SERVE
    : file.endsWith('search-manifest.json')
    ? '{"assets":{"chunks":"/search/chunks.abc.json"},"vectors":[]}'
    : null

function options(a: string, b: string, extra: string[] = []): Options {
  return parseCli([
    b,
    '--a',
    a,
    '--interval-ms',
    '0',
    '--retries',
    '0',
    '--timeout-ms',
    '5000',
    ...extra,
  ])!
}

let vercel: string
let cloudflare: string
let identical: string

beforeAll(async () => {
  vercel = await serve(VERCEL)
  cloudflare = await serve({
    buildId: 'workersBuildId00000002',
    xRobots: 'noindex',
    permanent: 301,
    slash: 307,
    ranges: false,
    text: { '/articles/two': 'A different record.' },
    missingData: ['/articles/one'],
    cssCache: 'public, max-age=0, must-revalidate',
    // Indexable, yet its sitemap leaves it out.
    robots: { '/articles/thin': 'index, follow' },
  })
  identical = await serve({ ...VERCEL, buildId: 'vercelBuildId000000003' })
})

afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))))
})

describe('runParity against two local sites', () => {
  it('passes two builds of the same site, build ids aside', async () => {
    const report = await runParity(options(vercel, identical, ['--b-x-robots', 'absent']), {
      readFile: repoFiles,
    })
    const failing = report.results.filter((r) => r.verdict !== 'identical')
    // Only the must-serve file neither site has.
    expect(failing.map((r) => [r.key, r.verdict])).toEqual([['/resumes/gone.pdf', 'regression']])
    expect(report.summary.sitemapRegressions).toBe(0)
    expect(report.a.buildIds).toEqual(['vercelBuildId000000001'])
    expect(report.b.buildIds).toEqual(['vercelBuildId000000003'])

    const groups = Object.fromEntries(
      Object.entries(report.summary.byGroup).map(([g, s]) => [g, s.targets])
    )
    expect(groups).toEqual({
      asset: 6,
      sitemap: 12,
      archive: 1,
      record: 3,
      search: 1,
      probe: 5,
      'next-data': 13,
      cache: 2,
    })
  })

  it('reports every planted difference with the right severity', async () => {
    const report = await runParity(options(vercel, cloudflare), { readFile: repoFiles })
    const rows = report.results.flatMap((r) =>
      r.diffs.map((d) => `${d.severity} ${r.key} ${d.field}`)
    )
    expect(rows).toEqual(
      expect.arrayContaining([
        'regression /articles/two text',
        'regression /films/one.mp4 status',
        'regression /_next/data/<build>/articles/one.json status',
        'regression /resumes/gone.pdf must-serve',
        'regression /articles/thin robots',
        'regression /articles/thin indexable (B)',
        'expected /about/ status',
        'expected /explore status',
        'expected /docs/articles status',
        'expected /docs/articles/one status',
        'warning /_next/static/<first css on /> cache-control',
      ])
    )
    expect(rows.filter((r) => r.startsWith('regression'))).toHaveLength(6)
    // B sends noindex on every page, as staging must; A sends none, as production must.
    expect(rows.some((r) => r.includes('x-robots-tag'))).toBe(false)
    expect(report.notes).toContain(
      "X-Robots-Tag noindex on 13/13 of B's 200 HTML pages (expected: noindex)"
    )
    const text = report.results.find((r) => r.key === '/articles/two')!.diffs[0]
    expect(text.note).toContain('The record at /articles/two.')
    expect(text.note).toContain('A different record.')
    expect(exitCode(report.summary)).toBe(1)
  })

  it('fails the X-Robots-Tag gate when staging is indexable', async () => {
    const report = await runParity(options(vercel, identical, ['--only', '^/about$']), {
      readFile: repoFiles,
    })
    expect(report.results.map((r) => r.key)).toEqual([
      '/about',
      '/sitemap.xml',
      '/video-sitemap.xml',
    ])
    expect(report.results[0].diffs).toMatchObject([
      { field: 'x-robots-tag (B)', severity: 'regression' },
    ])
  })

  it('samples pages evenly', async () => {
    const report = await runParity(
      options(vercel, identical, [
        '--b-x-robots',
        'any',
        '--sample',
        '2',
        '--no-next-data',
        '--no-records',
      ]),
      { readFile: repoFiles }
    )
    const pages = report.results.filter((r) => ['sitemap', 'static', 'archive'].includes(r.group))
    expect(pages).toHaveLength(2)
    expect(report.summary.byGroup['next-data']).toBeUndefined()
  })

  it('stops when A has no sitemap', async () => {
    const empty = await serve((_req, res) => res.writeHead(404).end())
    await expect(runParity(options(empty, vercel), { readFile: repoFiles })).rejects.toBeInstanceOf(
      FatalError
    )
  })
})

describe('main', () => {
  it('writes the JSON and Markdown reports and exits 1 on regressions', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'parity-'))
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    try {
      const code = await main(
        [
          cloudflare,
          '--a',
          vercel,
          '--quiet',
          '--interval-ms',
          '0',
          '--retries',
          '0',
          '--out',
          path.join(dir, 'r.json'),
          '--markdown',
          path.join(dir, 'r.md'),
        ],
        { readFile: repoFiles }
      )
      expect(code).toBe(1)
      const report = JSON.parse(await readFile(path.join(dir, 'r.json'), 'utf8'))
      expect(report.schema).toBe('parity-report/1')
      expect(JSON.stringify(report)).not.toContain('"_text"')
      expect(await readFile(path.join(dir, 'r.md'), 'utf8')).toContain('### Parity crawl: FAIL')
      const printed = out.mock.calls.map((call) => String(call[0])).join('')
      expect(printed).toContain(`parity  A ${vercel}  vs  B ${cloudflare}`)
      expect(printed).toMatch(/^regression +\/_next\/data/m)
    } finally {
      out.mockRestore()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('exits 2 on bad arguments and 0 for --help', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      expect(await main([])).toBe(2)
      expect(await main(['https://x.example/path'])).toBe(2)
      expect(await main(['--help'])).toBe(0)
    } finally {
      err.mockRestore()
      log.mockRestore()
    }
  })
})

describe('parseCli', () => {
  it('defaults A to production and checks origins', () => {
    const o = parseCli(['https://next.alexwelcing.com/'])!
    expect(o.a).toBe('https://alexwelcing.com')
    expect(o.b).toBe('https://next.alexwelcing.com')
    expect(o.expectXRobots).toEqual({ a: 'absent', b: 'noindex' })
    expect(o).toMatchObject({
      concurrency: 4,
      intervalMs: 100,
      retries: 2,
      sample: 0,
      nextData: true,
      records: true,
      archive: true,
    })
    expect(() => parseOrigin('ftp://x', 'B')).toThrow(UsageError)
    expect(() => parseOrigin('https://x/y', 'B')).toThrow(/bare origin/)
    expect(() => parseOrigin('nope', 'B')).toThrow(/not a URL/)
  })

  it('validates numbers, robots modes and regexes', () => {
    expect(() => parseCli(['https://b.example', '--concurrency', '0'])).toThrow(/--concurrency/)
    expect(() => parseCli(['https://b.example', '--b-x-robots', 'maybe'])).toThrow(/--b-x-robots/)
    expect(() => parseCli(['https://b.example', '--only', '('])).toThrow(/--only/)
    expect(() => parseCli(['https://a.example', 'https://b.example'])).toThrow(UsageError)
    const o = parseCli(['https://b.example', '--ignore', 'v\\d+', '--no-next-data', '--strict'])!
    expect(o.ignore[0].flags).toContain('g')
    expect(o).toMatchObject({ nextData: false, strict: true })
  })
})

describe('Pacer', () => {
  it('never exceeds its concurrency and spaces request starts', async () => {
    const pacer = new Pacer(2, 10)
    let active = 0
    let peak = 0
    const starts: number[] = []
    await Promise.all(
      Array.from({ length: 6 }, () =>
        pacer.run(async () => {
          starts.push(Date.now())
          active++
          peak = Math.max(peak, active)
          await new Promise((r) => setTimeout(r, 50))
          active--
        })
      )
    )
    expect(peak).toBe(2)
    const gaps = starts.slice(1).map((t, i) => t - starts[i])
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(9)
  })

  it('releases its slot when a task throws', async () => {
    const pacer = new Pacer(1, 0)
    await expect(pacer.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    await expect(pacer.run(async () => 'next')).resolves.toBe('next')
  })
})

describe('retries', () => {
  it('honours Retry-After seconds and dates, else backs off exponentially, capped', () => {
    expect(retryDelay('3', 0)).toBe(3000)
    expect(retryDelay(new Date(10_000).toUTCString(), 0, 4000)).toBe(6000)
    expect(retryDelay(null, 0)).toBe(1000)
    expect(retryDelay(null, 2)).toBe(4000)
    expect(retryDelay('600', 0)).toBe(30_000)
  })

  it('retries a 503 and records the eventual answer', async () => {
    let calls = 0
    const fetchStub = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith('/about') && calls++ === 0) {
        return new Response('busy', { status: 503, headers: { 'retry-after': '0' } })
      }
      return fetch(url, init)
    })
    const report = await runParity(
      parseCli([
        identical,
        '--a',
        vercel,
        '--interval-ms',
        '0',
        '--retries',
        '1',
        '--only',
        '^/about$',
        '--b-x-robots',
        'any',
      ])!,
      { readFile: repoFiles, fetch: fetchStub }
    )
    expect(report.results.find((r) => r.key === '/about')?.verdict).toBe('identical')
    expect(calls).toBeGreaterThanOrEqual(2)
  })
})

describe('helpers', () => {
  it('reads search assets and archive slugs', () => {
    expect(
      searchAssets(
        '{"assets":{"chunks":"/search/c.1.json","bm25":"/search/b.2.json"},"vectors":[{"file":"/search/v.bin"}]}'
      )
    ).toEqual(['/search/b.2.json', '/search/c.1.json', '/search/v.bin'])
    expect(archiveSlugs('{"records":[{"slug":"ok-1"},{"slug":"../bad"},{"slug":2}]}')).toEqual([
      'ok-1',
    ])
  })
})
