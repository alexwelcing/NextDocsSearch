import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type ParityReport,
  type Snapshot,
  type Target,
  TargetSet,
  compareSitemaps,
  compareSnapshots,
  decodeEntities,
  exitCode,
  extractPage,
  firstDifference,
  groupRows,
  jsonHash,
  nextDataPath,
  normalizeCacheControl,
  normalizeRef,
  normalizeText,
  parseMustServe,
  parseSitemap,
  renderMarkdown,
  renderTable,
  reportJson,
  reportRows,
  sample,
  stableStringify,
  summarize,
  summarizePage,
  textBodyHash,
  tokenizeHtml,
  verdictOf,
} from './parity'

const A = 'https://alexwelcing.com'
const B = 'https://alexwelcing-site.example.workers.dev'
const ORIGINS = [A, B]

/** A server-rendered page shaped like the site's: head metadata, then #arc-page-content. */
function html({
  title = 'Record — Alex Welcing',
  body = '<main><h1>Record</h1><p>Body text.</p></main>',
  head = '',
  buildId = 'gnUTLG1YVW7ISemjGLiYv',
  gsp = true,
}: { title?: string; body?: string; head?: string; buildId?: string; gsp?: boolean } = {}) {
  const data = { props: { pageProps: {} }, page: '/articles/[slug]', buildId, gsp }
  return (
    `<!DOCTYPE html><html lang="en"><head><meta charSet="utf-8"/><title>${title}</title>` +
    '<meta name="description" content="A record."/><meta name="robots" content="index, follow"/>' +
    `<link rel="canonical" href="${A}/articles/record"/>` +
    `<meta property="og:image" content="${A}/social-preview.png"/>` +
    `<link rel="stylesheet" href="/_next/static/css/${buildId}.css"/>` +
    `<script src="/_next/static/${buildId}/_buildManifest.js" defer=""></script>${head}</head>` +
    `<body><div id="__next"><div class="arc-checking"></div><div id="arc-page-content">${body}</div></div>` +
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>` +
    '<noscript><iframe src="https://www.googletagmanager.com/ns.html"></iframe></noscript></body></html>'
  )
}

function snap(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    url: `${A}/x`,
    status: 200,
    contentType: 'application/json; charset=utf-8',
    location: null,
    xRobotsTag: null,
    cacheControl: 'public, max-age=0, must-revalidate',
    kind: 'json',
    bodyHash: 'aaaa',
    ...overrides,
  }
}

function pageSnap(origin: string, page: string, overrides: Partial<Snapshot> = {}): Snapshot {
  const { page: summary, text, links } = summarizePage(page, [origin, ...ORIGINS])
  return snap({
    url: `${origin}/articles/record`,
    contentType: 'text/html; charset=utf-8',
    kind: 'html',
    bodyHash: undefined,
    page: summary,
    _text: text,
    _links: links,
    ...overrides,
  })
}

const target = (key: string, extra: Partial<Target> = {}): Target => ({
  key,
  group: 'sitemap',
  a: key,
  b: key,
  ...extra,
})
const NO_ROBOTS = { expectXRobots: { a: 'any', b: 'any' } } as const
const STAGING = { expectXRobots: { a: 'absent', b: 'noindex' } } as const

describe('normalizeText', () => {
  it('collapses all whitespace, NBSP included, and drops zero-width characters', () => {
    expect(normalizeText('  a\u00a0\n\tb\u200b c\u2009d  ')).toBe('a b c d')
  })

  it('masks timestamps but keeps bare (story) dates', () => {
    expect(normalizeText('built 2026-10-25T02:10:05.123Z for 2045-04-12')).toBe(
      'built <timestamp> for 2045-04-12'
    )
    expect(normalizeText('at 2026-10-25 02:10 UTC')).toBe('at <timestamp>')
  })

  it('masks Next build ids and CSP nonces', () => {
    expect(normalizeText('/_next/static/gnUTLG1YVW7ISemjGLiYv/_ssgManifest.js')).toBe(
      '/_next/static/<build>/_ssgManifest.js'
    )
    expect(normalizeText("script-src 'nonce-r4nd0mNonceValue=='")).toBe(
      "script-src 'nonce-<nonce>'"
    )
    // Short path segments (chunks, css, media) are not build ids.
    expect(normalizeText('/_next/static/chunks/main.js')).toBe('/_next/static/chunks/main.js')
  })

  it('applies extra ignore patterns', () => {
    expect(normalizeText('visitor #4521 today', [/#\d+/g])).toBe('visitor <ignored> today')
  })

  it('composes NFC, so decomposed and composed accents hash alike', () => {
    expect(normalizeText('Cafe\u0301')).toBe(normalizeText('Caf\u00e9'))
  })
})

describe('normalizeRef', () => {
  it('collapses either origin, or the canonical site, to a path', () => {
    expect(normalizeRef(`${A}/about`, ORIGINS)).toBe('/about')
    expect(normalizeRef(`${B}/about?x=1#y`, ORIGINS)).toBe('/about?x=1#y')
    expect(normalizeRef('/about', ORIGINS)).toBe('/about')
    expect(normalizeRef('about', ORIGINS)).toBe('/about')
  })

  it('keeps foreign hosts absolute and non-http references verbatim', () => {
    expect(normalizeRef('https://www.linkedin.com/in/alexwelcing', ORIGINS)).toBe(
      'https://www.linkedin.com/in/alexwelcing'
    )
    expect(normalizeRef('mailto:alex@example.com', ORIGINS)).toBe('mailto:alex@example.com')
  })

  it('collapses every /_next/ file, whose hashes differ between builds', () => {
    expect(normalizeRef('/_next/static/chunks/707-c788a1569f6ad28f.js', ORIGINS)).toBe(
      '/_next/<asset>'
    )
  })
})

describe('body hashes', () => {
  it('hashes JSON by value: key order and whitespace do not matter, array order does', () => {
    expect(jsonHash('{"a":1,"b":[1,2]}')).toBe(jsonHash('{ "b": [1, 2],\n  "a": 1 }'))
    expect(jsonHash('{"b":[2,1]}')).not.toBe(jsonHash('{"b":[1,2]}'))
    expect(stableStringify({ z: { y: 1, x: undefined }, a: null })).toBe('{"a":null,"z":{"y":1}}')
  })

  it('falls back to the text for invalid JSON', () => {
    expect(jsonHash('not json')).toBe(jsonHash('not json'))
    expect(jsonHash('not json')).not.toBe(jsonHash('not json!'))
  })

  it('ignores line endings and trailing whitespace in text bodies', () => {
    expect(textBodyHash('User-agent: *\r\nAllow: /  \r\n\r\n')).toBe(
      textBodyHash('User-agent: *\nAllow: /\n')
    )
  })
})

describe('decodeEntities', () => {
  it('decodes numeric and common named references', () => {
    expect(decodeEntities('Yusuf&#x27;s &amp; ORIN&#45;7 &quot;x&quot; &mdash; &nbsp;')).toBe(
      'Yusuf\'s & ORIN-7 "x" \u2014 \u00a0'
    )
  })

  it('leaves unknown names and bare ampersands alone, and replaces invalid code points', () => {
    expect(decodeEntities('AT&T &bogus; &#xD800; &#0;')).toBe('AT&T &bogus; \ufffd \ufffd')
  })
})

describe('tokenizeHtml', () => {
  it('reads quoted attributes containing > and skips comments', () => {
    const tokens = tokenizeHtml('<a title="1 > 0" href=/x>go</a><!-- <b>hidden</b> -->')
    expect(tokens).toEqual([
      { type: 'start', name: 'a', attrs: { title: '1 > 0', href: '/x' }, selfClosing: false },
      { type: 'text', text: 'go' },
      { type: 'end', name: 'a' },
    ])
  })

  it('keeps raw-text contents out of the markup', () => {
    const tokens = tokenizeHtml('<script>if (a < b) document.write("<p>x</p>")</script><p>y</p>')
    expect(tokens.map((t) => t.type)).toEqual(['start', 'raw', 'end', 'start', 'text', 'end'])
  })

  it('survives malformed input', () => {
    expect(() => tokenizeHtml('<div <p class="x>text</ <script>never closed')).not.toThrow()
  })
})

describe('extractPage', () => {
  it('reads head metadata, JSON-LD types and __NEXT_DATA__', () => {
    const ld = {
      '@context': 'https://schema.org',
      '@graph': [{ '@type': ['Article', 'CreativeWork'] }, { '@type': 'BreadcrumbList' }],
    }
    const facts = extractPage(
      html({
        head:
          `<script type="application/ld+json">${JSON.stringify({ '@type': 'Person' })}</script>` +
          `<script type="application/ld+json">${JSON.stringify(ld)}</script>` +
          '<script type="application/ld+json">{oops</script>' +
          '<meta name="description" content="second, ignored"/>',
      })
    )
    expect(facts.title).toBe('Record — Alex Welcing')
    expect(facts.metas.description).toBe('A record.')
    expect(facts.metas.robots).toBe('index, follow')
    expect(facts.metas['og:image']).toBe(`${A}/social-preview.png`)
    expect(facts.canonical).toBe(`${A}/articles/record`)
    expect(facts.jsonLdTypes).toEqual([
      '(invalid JSON-LD)',
      'Article',
      'BreadcrumbList',
      'CreativeWork',
      'Person',
    ])
    expect(facts.next).toEqual({
      buildId: 'gnUTLG1YVW7ISemjGLiYv',
      page: '/articles/[slug]',
      gsp: true,
    })
    expect(facts.nextAssets).toEqual([
      '/_next/static/css/gnUTLG1YVW7ISemjGLiYv.css',
      '/_next/static/gnUTLG1YVW7ISemjGLiYv/_buildManifest.js',
    ])
  })

  it('takes the text of #arc-page-content only, without scripts, styles or noscript', () => {
    const facts = extractPage(
      html({
        body:
          '<main><div><h1>Title</h1></div><style>.x{}</style><script>var t = "<p>no</p>"</script>' +
          '<noscript>enable js</noscript><p>Para <em>one</em>.</p></main>',
      })
    )
    expect(normalizeText(facts.content.text)).toBe('Title Para one .')
    expect(facts.content.found).toBe(true)
  })

  it('ends the content at its own closing tag, across nested divs', () => {
    const facts = extractPage(
      '<div id="arc-page-content"><div><div>inner</div></div>tail</div><div>outside</div>'
    )
    expect(normalizeText(facts.content.text)).toBe('inner tail')
  })

  it('collects content links and ignores an <svg><title> for the page title', () => {
    const facts = extractPage(
      '<html><head><title>Page</title></head><body><div id="arc-page-content">' +
        '<svg><title>icon</title></svg><a href="/articles/x">x</a><img src="/images/og/x.svg"/>' +
        '<video src="/v.mp4" poster="/p.jpg"></video></div></body></html>'
    )
    expect(facts.title).toBe('Page')
    expect(facts.content.links).toEqual([
      'a:/articles/x',
      'img:/images/og/x.svg',
      'video:/v.mp4',
      'video:/p.jpg',
    ])
  })

  it('reports a page with no #arc-page-content', () => {
    const facts = extractPage('<html><head><title>Bare</title></head><body><p>x</p></body></html>')
    expect(facts.content).toEqual({ found: false, text: '', links: [] })
    expect(facts.next.buildId).toBeNull()
  })
})

describe('summarizePage', () => {
  it('hashes two builds of the same content alike', () => {
    const one = summarizePage(html({ buildId: 'aaaaaaaaaaaaaaaaaaaaa' }), [A, ...ORIGINS]).page
    const two = summarizePage(
      html({
        buildId: 'bbbbbbbbbbbbbbbbbbbbb',
        body: '<main>\n  <h1>Record</h1>\n  <p>Body&nbsp;text.</p>\n</main>',
      }),
      [B, ...ORIGINS]
    ).page
    expect(two.textHash).toBe(one.textHash)
    expect(two.linksHash).toBe(one.linksHash)
    expect(two.buildId).not.toBe(one.buildId)
  })

  it('treats links to either origin as the same link', () => {
    const one = summarizePage(html({ body: `<a href="${A}/about">a</a>` }), [A, ...ORIGINS]).page
    const two = summarizePage(html({ body: '<a href="/about">a</a>' }), [B, ...ORIGINS]).page
    expect(two.linksHash).toBe(one.linksHash)
  })

  it('changes the text hash when a word changes', () => {
    const one = summarizePage(html(), ORIGINS).page
    const two = summarizePage(
      html({ body: '<main><h1>Record</h1><p>Body texts.</p></main>' }),
      ORIGINS
    ).page
    expect(two.textHash).not.toBe(one.textHash)
    expect(two.textLength).toBe(one.textLength + 1)
  })
})

describe('nextDataPath', () => {
  it('maps a route to its /_next/data JSON', () => {
    expect(nextDataPath('id', '/')).toBe('/_next/data/id/index.json')
    expect(nextDataPath('id', '/articles/x')).toBe('/_next/data/id/articles/x.json')
    expect(nextDataPath('id', '/about/?q=1')).toBe('/_next/data/id/about.json')
  })
})

describe('parseSitemap', () => {
  it('reads urlsets with video entries and XML entities', () => {
    const xml =
      '<?xml version="1.0"?><urlset><url><loc>https://alexwelcing.com/</loc></url>' +
      '<url><loc>https://alexwelcing.com/a?x=1&amp;y=2</loc><lastmod>2025-01-02</lastmod></url>' +
      '<url><loc>https://alexwelcing.com/videos/v</loc><video:video>' +
      '<video:thumbnail_loc>https://alexwelcing.com/t.jpg</video:thumbnail_loc>' +
      '<video:title><![CDATA[Tom & Jerry]]></video:title>' +
      '<video:content_loc>https://alexwelcing.com/v.mp4</video:content_loc></video:video></url></urlset>'
    expect(parseSitemap(xml)).toEqual({
      urls: [
        { loc: 'https://alexwelcing.com/' },
        { loc: 'https://alexwelcing.com/a?x=1&y=2', lastmod: '2025-01-02' },
        {
          loc: 'https://alexwelcing.com/videos/v',
          video: {
            title: 'Tom & Jerry',
            thumbnail: 'https://alexwelcing.com/t.jpg',
            content: 'https://alexwelcing.com/v.mp4',
          },
        },
      ],
      sitemaps: [],
    })
  })

  it('reads sitemap indexes', () => {
    const xml =
      '<sitemapindex><sitemap><loc>https://alexwelcing.com/sitemap-0.xml</loc></sitemap></sitemapindex>'
    expect(parseSitemap(xml)).toEqual({
      urls: [],
      sitemaps: ['https://alexwelcing.com/sitemap-0.xml'],
    })
  })
})

describe('compareSitemaps', () => {
  const loc = (p: string) => `${A}${p}`

  it('is empty for equal sitemaps', () => {
    const entries = [{ loc: loc('/') }, { loc: loc('/about'), lastmod: '2025-01-01' }]
    expect(compareSitemaps('/sitemap.xml', entries, [...entries].reverse())).toEqual([])
  })

  it('fails on a URL B drops and warns on one B adds or a changed lastmod', () => {
    const diffs = compareSitemaps(
      '/sitemap.xml',
      [{ loc: loc('/') }, { loc: loc('/gone') }, { loc: loc('/m'), lastmod: '2025-01-01' }],
      [{ loc: loc('/') }, { loc: loc('/new') }, { loc: loc('/m'), lastmod: '2025-02-01' }]
    )
    expect(diffs.map((d) => [d.path, d.field, d.severity])).toEqual([
      ['/gone', 'loc', 'regression'],
      ['/m', 'lastmod', 'warning'],
      ['/new', 'loc', 'warning'],
    ])
  })

  it('fails when B advertises another host or changes a video field', () => {
    const diffs = compareSitemaps(
      '/video-sitemap.xml',
      [{ loc: loc('/videos/v'), video: { title: 'T', content: loc('/v.mp4') } }],
      [{ loc: `${B}/videos/v`, video: { title: 'T', content: `${B}/v.mp4` } }]
    )
    expect(diffs.map((d) => [d.field, d.severity])).toEqual([
      ['loc host', 'regression'],
      ['video:content', 'regression'],
    ])
  })

  it('fails when B has no readable sitemap', () => {
    expect(compareSitemaps('/sitemap.xml', [{ loc: loc('/') }], null)[0]).toMatchObject({
      field: 'sitemap',
      severity: 'regression',
    })
  })
})

describe('compareSnapshots', () => {
  it('finds nothing in identical answers', () => {
    expect(
      compareSnapshots(target('/arc/archive.json'), snap(), snap({ url: `${B}/x` }), STAGING)
    ).toEqual([])
  })

  it('fails when B loses a page A serves, and warns when only B serves one', () => {
    const lost = compareSnapshots(target('/a'), snap(), snap({ status: 404 }), NO_ROBOTS)
    expect(lost).toEqual([{ field: 'status', a: '200', b: '404', severity: 'regression' }])
    const gained = compareSnapshots(target('/a'), snap({ status: 404 }), snap(), NO_ROBOTS)
    expect(gained[0]).toMatchObject({ field: 'status', severity: 'warning' })
  })

  it('always fails on a 5xx from B and on a B request that did not complete', () => {
    expect(
      verdictOf(
        compareSnapshots(target('/a'), snap({ status: 404 }), snap({ status: 502 }), NO_ROBOTS)
      )
    ).toBe('regression')
    const failed = compareSnapshots(
      target('/a'),
      snap(),
      snap({ status: null, error: 'timeout' }),
      NO_ROBOTS
    )
    expect(failed[0]).toMatchObject({ b: 'error: timeout', severity: 'regression' })
    const aFailed = compareSnapshots(target('/a'), snap({ status: null }), snap(), NO_ROBOTS)
    expect(aFailed[0].severity).toBe('warning')
  })

  it('accepts the documented redirect-code differences and nothing else', () => {
    const redirect = (status: number, location = '/about') =>
      snap({ status, location, kind: 'none', bodyHash: undefined, contentType: 'text/plain' })
    const slash = compareSnapshots(
      target('/about/', { group: 'probe' }),
      redirect(308),
      redirect(307),
      NO_ROBOTS
    )
    expect(slash).toMatchObject([{ field: 'status', severity: 'expected' }])
    const permanent = compareSnapshots(
      target('/explore'),
      redirect(308, '/'),
      redirect(301, '/'),
      NO_ROBOTS
    )
    expect(permanent).toMatchObject([{ field: 'status', severity: 'expected' }])
    const weakened = compareSnapshots(
      target('/explore'),
      redirect(308, '/'),
      redirect(307, '/'),
      NO_ROBOTS
    )
    expect(weakened).toMatchObject([{ field: 'status', severity: 'warning' }])
    const moved = compareSnapshots(
      target('/explore'),
      redirect(308, '/'),
      redirect(308, '/home'),
      NO_ROBOTS
    )
    expect(moved).toMatchObject([{ field: 'location', a: '/', b: '/home', severity: 'regression' }])
    const unredirected = compareSnapshots(target('/explore'), redirect(308, '/'), snap(), NO_ROBOTS)
    expect(unredirected).toMatchObject([
      { field: 'status', a: '308 -> /', b: '200', severity: 'regression' },
    ])
  })

  it('separates MIME aliases and parameters from real content-type changes', () => {
    const icon = (contentType: string) => snap({ contentType, kind: 'binary' })
    expect(
      compareSnapshots(
        target('/favicon.ico'),
        icon('image/vnd.microsoft.icon'),
        icon('image/x-icon'),
        NO_ROBOTS
      )
    ).toMatchObject([{ field: 'content-type', severity: 'warning', note: 'equivalent MIME types' }])
    expect(
      compareSnapshots(
        target('/a.json'),
        snap(),
        snap({ contentType: 'application/json' }),
        NO_ROBOTS
      )
    ).toMatchObject([{ field: 'content-type', severity: 'warning' }])
    expect(
      compareSnapshots(target('/a.json'), snap(), snap({ contentType: 'text/plain' }), NO_ROBOTS)
    ).toMatchObject([{ field: 'content-type', severity: 'regression' }])
  })

  it('compares Cache-Control as a directive set and only warns', () => {
    expect(normalizeCacheControl('public,max-age=31536000,immutable')).toBe(
      normalizeCacheControl('immutable, max-age = 31536000, public')
    )
    const diffs = compareSnapshots(
      target('/a'),
      snap({ cacheControl: 'public, max-age=31536000, immutable' }),
      snap(),
      NO_ROBOTS
    )
    expect(diffs).toMatchObject([{ field: 'cache-control', severity: 'warning' }])
  })

  it('fails on every page field that differs, with a text excerpt', () => {
    const a = pageSnap(A, html())
    const b = pageSnap(
      B,
      html({
        title: 'Other',
        body: '<main><h1>Record</h1><p>Body test.</p><a href="/x">x</a></main>',
      })
        .replace('index, follow', 'noindex, follow')
        .replace('social-preview.png', 'og-default.png')
    )
    const diffs = compareSnapshots(target('/articles/record'), a, b, NO_ROBOTS)
    expect(diffs.map((d) => [d.field, d.severity])).toEqual([
      ['title', 'regression'],
      ['ogImage', 'regression'],
      ['robots', 'regression'],
      ['text', 'regression'],
      ['links', 'regression'],
    ])
    expect(diffs.find((d) => d.field === 'text')?.note).toContain('first difference at char 14')
    expect(diffs.find((d) => d.field === 'links')?.note).toContain('only B: a:/x')
  })

  it('fails when B has no #arc-page-content', () => {
    const b = pageSnap(B, html().replace('id="arc-page-content"', 'id="other"'))
    expect(compareSnapshots(target('/a'), pageSnap(A, html()), b, NO_ROBOTS)).toMatchObject([
      { field: '#arc-page-content', a: 'present', b: 'missing', severity: 'regression' },
    ])
  })

  it('checks the X-Robots-Tag gate on HTML and PDF only', () => {
    const page = pageSnap(A, html())
    const missing = compareSnapshots(target('/a'), page, { ...page, url: B }, STAGING)
    expect(missing).toMatchObject([{ field: 'x-robots-tag (B)', severity: 'regression' }])
    const staged = compareSnapshots(
      target('/a'),
      page,
      { ...page, xRobotsTag: 'noindex, nofollow' },
      STAGING
    )
    expect(staged).toEqual([])
    const leaked = compareSnapshots(
      target('/a'),
      { ...page, xRobotsTag: 'noindex' },
      { ...page, xRobotsTag: 'noindex' },
      STAGING
    )
    expect(leaked).toMatchObject([{ field: 'x-robots-tag (A)', severity: 'regression' }])
    const pdf = snap({ contentType: 'application/pdf', kind: 'binary' })
    expect(compareSnapshots(target('/r.pdf'), pdf, pdf, STAGING)).toMatchObject([
      { field: 'x-robots-tag (B)' },
    ])
    expect(compareSnapshots(target('/a.json'), snap(), snap(), STAGING)).toEqual([])
  })

  it('compares MP4 range answers by status, Content-Range and bytes', () => {
    const range = (status: number, contentRange: string | null, head: string) =>
      snap({
        status,
        contentType: 'video/mp4',
        kind: 'range',
        bodyHash: undefined,
        range: {
          contentRange,
          total: contentRange ? Number(contentRange.split('/')[1]) : null,
          head,
        },
      })
    const t = target('/v.mp4', { group: 'asset', range: true, mustServe: true })
    expect(
      compareSnapshots(
        t,
        range(206, 'bytes 0-1/100', '0000'),
        range(206, 'bytes 0-1/100', '0000'),
        NO_ROBOTS
      )
    ).toEqual([])
    expect(
      compareSnapshots(t, range(206, 'bytes 0-1/100', '0000'), range(200, null, ''), NO_ROBOTS)
    ).toMatchObject([{ field: 'status', a: '206', b: '200', severity: 'regression' }])
    expect(
      compareSnapshots(
        t,
        range(206, 'bytes 0-1/100', '0000'),
        range(206, 'bytes 0-1/99', '0001'),
        NO_ROBOTS
      )
    ).toMatchObject([
      { field: 'content-range', severity: 'regression' },
      { field: 'range bytes', severity: 'regression' },
    ])
  })

  it('fails when B does not serve a must-serve file even if A does not either', () => {
    const gone = snap({ status: 404, contentType: 'text/html', kind: 'html' })
    const diffs = compareSnapshots(
      target('/resumes/r.pdf', { group: 'asset', mustServe: true }),
      gone,
      gone,
      NO_ROBOTS
    )
    expect(diffs.map((d) => [d.field, d.severity])).toEqual([
      ['must-serve', 'regression'],
      ['must-serve', 'warning'],
    ])
  })

  it('compares only status, type and caching for cache probes', () => {
    const t = target('/_next/static/<first css on />', {
      group: 'cache',
      a: '/_next/static/css/a.css',
      b: '/_next/static/css/b.css',
    })
    const css = (bodyHash: string) => snap({ contentType: 'text/css', kind: 'text', bodyHash })
    expect(compareSnapshots(t, css('one'), css('two'), NO_ROBOTS)).toEqual([])
  })

  it('leaves sitemap bodies to the entry-level sitemap diff', () => {
    const xml = (loc: string) =>
      snap({
        contentType: 'application/xml',
        kind: 'xml',
        bodyHash: loc,
        _sitemap: { urls: [{ loc }], sitemaps: [] },
      })
    expect(compareSnapshots(target('/sitemap.xml'), xml('/a'), xml('/b'), NO_ROBOTS)).toEqual([])
  })

  it('warns when neither origin serves a path A itself names, but not for probes or assets', () => {
    const gone = snap({ status: 404, contentType: 'text/html', kind: 'html' })
    const search = compareSnapshots(
      target('/search/chunks.0123.json', { group: 'search' }),
      gone,
      gone,
      NO_ROBOTS
    )
    expect(search).toMatchObject([{ field: 'status', a: '404', b: '404', severity: 'warning' }])
    expect(search[0].note).toContain('search-manifest.json')
    for (const group of ['sitemap', 'static', 'archive', 'record', 'next-data'] as const) {
      expect(verdictOf(compareSnapshots(target('/p', { group }), gone, gone, NO_ROBOTS))).toBe(
        'warning'
      )
    }
    for (const group of ['probe', 'asset', 'cache'] as const) {
      expect(compareSnapshots(target('/p', { group }), gone, gone, NO_ROBOTS)).toEqual([])
    }
  })

  it('checks that each sitemap lists exactly the pages it lets be indexed', () => {
    const indexable = pageSnap(A, html())
    const noindex = pageSnap(B, html().replace('index, follow', 'noindex, follow'))
    const check = (listed: Target['listed'], a: Snapshot, b: Snapshot) =>
      compareSnapshots(target('/articles/record', { listed }), a, b, NO_ROBOTS).filter((d) =>
        d.field.startsWith('indexable')
      )

    expect(check({ a: true, b: true }, indexable, indexable)).toEqual([])
    expect(check({ a: false, b: false }, noindex, noindex)).toEqual([])
    // B lists a noindex page, or leaves an indexable one out: a regression.
    expect(check({ a: true, b: true }, indexable, noindex)).toMatchObject([
      { field: 'indexable (B)', b: 'listed, noindex, follow', severity: 'regression' },
    ])
    expect(check({ a: true, b: false }, indexable, indexable)).toMatchObject([
      { field: 'indexable (B)', a: 'listed, index, follow', b: 'unlisted, index, follow' },
    ])
    // The same mismatch on A is production's own defect: a warning.
    expect(check({ a: false, b: false }, indexable, noindex)).toMatchObject([
      { field: 'indexable (A)', severity: 'warning' },
    ])
    // An origin whose sitemap did not load is not judged.
    expect(check({ a: true }, indexable, noindex)).toEqual([])
    // Nor is a page that did not answer 200.
    expect(check({ a: true, b: true }, indexable, { ...noindex, status: 404 })).toEqual([])
  })

  it('fails on a different asset body, with both sizes', () => {
    const diffs = compareSnapshots(
      target('/a.json'),
      snap({ bodyBytes: 10 }),
      snap({ bodyHash: 'bbbb', bodyBytes: 12 }),
      NO_ROBOTS
    )
    expect(diffs).toEqual([
      { field: 'body', a: 'aaaa', b: 'bbbb', severity: 'regression', note: '10 vs 12 bytes' },
    ])
  })
})

describe('firstDifference', () => {
  it('points at the first differing character with context', () => {
    expect(firstDifference('the quick fox', 'the quack fox', 4)).toBe(
      'first difference at char 6: A "...e quick ..." | B "...e quack ..."'
    )
  })
})

describe('verdicts, summary and exit code', () => {
  it('takes the worst severity', () => {
    expect(verdictOf([])).toBe('identical')
    expect(verdictOf([{ severity: 'expected' }, { severity: 'warning' }])).toBe('warning')
    expect(verdictOf([{ severity: 'warning' }, { severity: 'regression' }])).toBe('regression')
  })

  it('exits 1 on regressions, and on warnings only when strict', () => {
    const base = summarize([], {})
    expect(exitCode(base)).toBe(0)
    expect(exitCode({ ...base, warnings: 1 })).toBe(0)
    expect(exitCode({ ...base, warnings: 1 }, true)).toBe(1)
    expect(exitCode({ ...base, sitemapRegressions: 1 })).toBe(1)
    expect(exitCode({ ...base, regressions: 2 })).toBe(1)
  })
})

describe('parseMustServe', () => {
  it('reads paths, skipping comments and blank lines', () => {
    expect(parseMustServe('# header\n\n/robots.txt\n  /a b.pdf  # trailing\n')).toEqual([
      '/robots.txt',
      '/a b.pdf',
    ])
    expect(() => parseMustServe('robots.txt')).toThrow(/site-relative/)
  })

  it('parses the committed list, which names the films and the archive', () => {
    const list = parseMustServe(
      fs.readFileSync(path.join(process.cwd(), 'scripts', 'verify', 'must-serve.txt'), 'utf8')
    )
    expect(list.filter((p) => p.endsWith('.mp4'))).toHaveLength(3)
    expect(list).toEqual(
      expect.arrayContaining([
        '/robots.txt',
        '/sitemap.xml',
        '/video-sitemap.xml',
        '/favicon.ico',
        '/arc/archive.json',
      ])
    )
    expect(new Set(list).size).toBe(list.length)
  })

  it('lists only files that exist in public/', () => {
    // The sitemaps are build outputs (scripts/steps/pre/70-sitemaps.ts); the checkout may be sparse
    // (no public/images), so only tracked-or-present files are asserted.
    const root = process.cwd()
    const list = parseMustServe(
      fs.readFileSync(path.join(process.cwd(), 'scripts', 'verify', 'must-serve.txt'), 'utf8')
    )
    const missing = list.filter((p) => {
      if (/^\/(sitemap|video-sitemap)\.xml$/.test(p)) return false
      if (p.startsWith('/images/') && !fs.existsSync(path.join(root, 'public', 'images')))
        return false
      return !fs.existsSync(path.join(root, 'public', p))
    })
    expect(missing).toEqual([])
  })
})

describe('sample and TargetSet', () => {
  it('spreads a sample evenly from the first item', () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    expect(sample(items, 0)).toBe(items)
    expect(sample(items, 20)).toBe(items)
    expect(sample(items, 3)).toEqual([0, 3, 6])
  })

  it('keeps the first group for a path and accumulates flags', () => {
    const set = new TargetSet()
    set.add('/a', 'sitemap')
    set.add('/a', 'asset', { mustServe: true })
    set.add('/v.mp4', 'asset', { range: true })
    expect(set.list()).toEqual([
      { key: '/a', group: 'sitemap', a: '/a', b: '/a', mustServe: true },
      { key: '/v.mp4', group: 'asset', a: '/v.mp4', b: '/v.mp4', range: true },
    ])
    expect(set.size).toBe(2)
  })
})

describe('report rendering', () => {
  const report = (
    results: ParityReport['results'],
    sitemaps: ParityReport['sitemaps'] = {}
  ): ParityReport => ({
    schema: 'parity-report/1',
    startedAt: '2026-10-25T00:00:00.000Z',
    finishedAt: '2026-10-25T00:01:00.000Z',
    a: { origin: A, buildIds: [] },
    b: { origin: B, buildIds: [] },
    options: {},
    summary: summarize(results, sitemaps),
    notes: ['a note'],
    sitemaps,
    results,
  })
  const result = (key: string, diffs: ParityReport['results'][number]['diffs']) => ({
    key,
    group: 'sitemap' as const,
    verdict: verdictOf(diffs),
    diffs,
    a: snap({ _text: 'secret working text' }),
    b: snap(),
  })

  it('prints regressions first, with notes, and says so when nothing differs', () => {
    const r = report(
      [
        result('/b', [{ field: 'cache-control', a: 'x', b: 'y', severity: 'warning' }]),
        result('/a', [
          { field: 'text', a: '1', b: '2', severity: 'regression', note: '10 vs 11 chars' },
        ]),
        result('/c', []),
      ],
      {
        '/sitemap.xml': {
          a: 2,
          b: 1,
          diffs: [
            {
              sitemap: '/sitemap.xml',
              path: '/gone',
              field: 'loc',
              a: 'listed',
              b: 'missing',
              severity: 'regression',
            },
          ],
        },
      }
    )
    const table = renderTable(r)
    const lines = table.split('\n')
    const firstRow = lines.findIndex((l) => l.startsWith('regression'))
    expect(lines[firstRow]).toMatch(/^regression\s+\/a\s+text/)
    expect(lines[firstRow + 1]).toContain('10 vs 11 chars')
    expect(lines[firstRow + 2]).toMatch(/^regression\s+\/gone\s+\/sitemap\.xml loc/)
    expect(table.indexOf('warning')).toBeGreaterThan(firstRow)
    expect(table).toContain(
      '3 URLs: 1 identical, 0 expected-only, 1 with warnings, 1 with regressions'
    )
    expect(table).toContain('note: a note')
    expect(renderTable(report([result('/c', [])]))).toContain('no differences')
  })

  it('renders Markdown with escaped pipes and a verdict', () => {
    const md = renderMarkdown(
      report([result('/a|b', [{ field: 'title', a: 'x | y', b: 'z', severity: 'regression' }])])
    )
    expect(md).toContain('### Parity crawl: FAIL')
    expect(md).toContain('| regression | `/a\\|b` | title | x \\| y | z |  |')
    expect(renderMarkdown(report([]))).toContain('### Parity crawl: PASS')
  })

  it('caps the rows it prints', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      result(`/p${i}`, [{ field: 'body', a: `x${i}`, b: 'y', severity: 'regression' }])
    )
    expect(renderTable(report(many), 2)).toContain(
      '... 3 more distinct differences in the JSON report'
    )
  })

  it('groups rows that differ only by path, in both tables', () => {
    const cache = {
      field: 'cache-control',
      a: 'max-age=0',
      b: 's-maxage=1',
      severity: 'warning',
    } as const
    const r = report([
      ...Array.from({ length: 300 }, (_, i) =>
        result(`/articles/a-much-longer-article-slug-for-clipping-${String(i).padStart(3, '0')}`, [
          cache,
        ])
      ),
      result('/a', [{ field: 'text', a: '1', b: '2', severity: 'regression', note: 'n' }]),
      result('/b', [{ field: 'text', a: '3', b: '4', severity: 'regression', note: 'n' }]),
    ])
    const grouped = groupRows(reportRows(r))
    expect(grouped.map((row) => [row.path, row.paths.length])).toEqual([
      ['/a', 1],
      ['/b', 1],
      ['/articles/a-much-longer-article-slug-for-clipping-000', 300],
    ])

    const table = renderTable(r)
    const rows = table.split('\n').filter((l) => /^(regression|warning)\s/.test(l))
    expect(rows).toHaveLength(3)
    // The count survives clipping a long first path.
    expect(rows[2]).toMatch(/^warning\s+\/articles\/a-much-longer-article-slug-f\.\.\. \(\+299\)/)
    expect(table).toContain('3 distinct differences (302 rows;')
    expect(renderMarkdown(r)).toContain(
      '| warning | `/articles/a-much-longer-article-slug-for-clipping-000` (+299) | cache-control |'
    )
  })

  it('serializes without the working fields', () => {
    const json = reportJson(report([result('/a', [])]))
    expect(json).not.toContain('secret working text')
    expect(JSON.parse(json).results[0].a).not.toHaveProperty('_text')
  })
})
