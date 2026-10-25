import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STATIC_ROUTES,
  knownLastmod,
  metaContent,
  planSitemaps,
  robotsMeta,
  urlsetXml,
  verifyPrerendered,
  videoSitemapXml,
} from './generate-sitemaps'

const SITE = 'https://alexwelcing.com'
const TODAY = '2026-10-24'
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

/** The 24 bytes of a PNG header that carry its size. */
function png(width: number, height: number): Buffer {
  const header = Buffer.alloc(24)
  header.writeUInt32BE(0x89504e47, 0)
  header.writeUInt32BE(0x0d0a1a0a, 4)
  header.writeUInt32BE(13, 8)
  header.write('IHDR', 12, 'ascii')
  header.writeUInt32BE(width, 16)
  header.writeUInt32BE(height, 20)
  return header
}

let root: string

async function put(file: string, contents: unknown) {
  const target = path.join(root, file)
  await mkdir(path.dirname(target), { recursive: true })
  const raw = typeof contents === 'string' || contents instanceof Uint8Array
  await writeFile(target, raw ? contents : JSON.stringify(contents))
}

/** A tiny generated tree: one full essay with a film, one short record, one tech stub. */
async function fixture() {
  await put('lib/generated/article-manifest.json', [
    {
      slug: 'essay',
      title: 'An "Essay" & more',
      description: 'A <real> one.',
      published: '2025-01-02',
    },
    { slug: 'short', title: 'Short', date: '2067-12-31' },
    { slug: 'tech-stub', title: 'Stub', updated: '2099-01-01' },
  ])
  await put('lib/generated/image-manifest.json', { essay: { ogImage: '/images/og/essay.jpg' } })
  await put('public/images/og/essay.jpg', png(1200, 630))
  await put('public/social-preview.png', png(1280, 640))
  await put('public/arc/media.json', { films: ['essay'], plates: {} })
  await put('public/arc/records/essay.json', { hero: null, blocks: [{ t: 'p', x: words(400) }] })
  await put('public/arc/records/short.json', { hero: null, blocks: [{ t: 'p', x: words(120) }] })
  await put('public/arc/records/tech-stub.json', {
    hero: null,
    blocks: [{ t: 'p', x: words(900) }],
  })
}

/** Prerendered HTML as next build leaves it, with the given robots meta and og:image per route. */
async function prerender(pages: Record<string, string>, ogImages: Record<string, string> = {}) {
  for (const [route, robots] of Object.entries(pages)) {
    const name = route === '/' ? 'index' : route.slice(1)
    const og = ogImages[route] ? `<meta property="og:image" content="${ogImages[route]}"/>` : ''
    await put(
      `.next/server/pages/${name}.html`,
      `<head><meta name="robots" content="${robots}"/>${og}</head>`
    )
  }
}

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'sitemaps-test-'))
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('knownLastmod', () => {
  it('uses updated, then published, and never the story date or a future date', () => {
    expect(knownLastmod({ slug: 'a', updated: '2026-01-02', published: '2025-01-01' }, TODAY)).toBe(
      '2026-01-02'
    )
    expect(knownLastmod({ slug: 'a', published: '2025-01-01' }, TODAY)).toBe('2025-01-01')
    expect(knownLastmod({ slug: 'a', published: '2067-12-31' }, TODAY)).toBeUndefined()
    expect(knownLastmod({ slug: 'a', date: '2024-12-23' } as never, TODAY)).toBeUndefined()
    expect(knownLastmod({ slug: 'a', published: 'soon' }, TODAY)).toBeUndefined()
  })
})

describe('sitemap XML', () => {
  it('escapes entries and writes lastmod only when known', () => {
    const xml = urlsetXml(SITE, [{ path: '/' }, { path: '/articles/a&b', lastmod: '2025-01-02' }])
    expect(xml).toContain('<url><loc>https://alexwelcing.com/</loc></url>')
    expect(xml).toContain(
      '<url><loc>https://alexwelcing.com/articles/a&amp;b</loc><lastmod>2025-01-02</lastmod></url>'
    )
    expect(xml.match(/<lastmod>/g)).toHaveLength(1)
  })

  it('points every video entry at this domain', () => {
    const xml = videoSitemapXml(SITE, [
      {
        slug: 'film',
        title: 'A <film>',
        description: 'd'.repeat(3000),
        thumbnail: '/images/og/film.jpg',
      },
    ])
    expect(xml).toContain('<loc>https://alexwelcing.com/videos/film</loc>')
    expect(xml).toContain(
      '<video:content_loc>https://alexwelcing.com/images/article-videos/film.mp4<'
    )
    expect(xml).toContain('<video:thumbnail_loc>https://alexwelcing.com/images/og/film.jpg<')
    expect(xml).toContain('<video:title>A &lt;film&gt;</video:title>')
    expect(xml).toContain(`<video:description>${'d'.repeat(2048)}</video:description>`)
    expect(xml).not.toMatch(/supabase/)
  })
})

describe('planSitemaps', () => {
  it('lists static routes, indexable articles and films, and leaves thin articles out', async () => {
    await fixture()
    const plan = planSitemaps(root, TODAY)

    expect(plan.urls).toEqual([
      ...STATIC_ROUTES.map((route) => ({ path: route })),
      { path: '/articles/essay', lastmod: '2025-01-02' },
      { path: '/videos/essay' },
    ])
    expect(plan.noindex).toEqual([
      { slug: 'short', reason: '120 words < 300' },
      { slug: 'tech-stub', reason: 'tech-* stub family, 900 words' },
    ])
    expect(plan.films).toEqual([
      {
        slug: 'essay',
        title: 'An "Essay" & more',
        description: 'A <real> one.',
        thumbnail: '/images/og/essay.jpg',
      },
    ])
    expect(plan.urls.map((url) => url.path)).not.toContain('/explore')
  })

  it('gives a film whose social card is gone the site preview, never a 404', async () => {
    await fixture()
    await rm(path.join(root, 'public/images/og/essay.jpg'))
    expect(planSitemaps(root, TODAY).films[0].thumbnail).toBe('/social-preview.png')
  })
})

describe('verifyPrerendered', () => {
  const indexed = Object.fromEntries(
    [...STATIC_ROUTES, '/articles/essay', '/videos/essay'].map((route) => [route, 'index, follow'])
  )

  it('passes when the noindex pages are exactly the articles left out', async () => {
    await fixture()
    await prerender({
      ...indexed,
      '/articles/short': 'noindex,follow',
      '/articles/tech-stub': 'noindex,follow',
    })
    expect(() => verifyPrerendered(root, planSitemaps(root, TODAY))).not.toThrow()
  })

  it('fails on a thin page without noindex, a listed page with it, or a missing page', async () => {
    await fixture()
    await prerender({
      ...indexed,
      '/about': 'noindex',
      '/articles/short': 'index, follow',
    })
    expect(() => verifyPrerendered(root, planSitemaps(root, TODAY))).toThrow(
      /\/about has robots "noindex" but is listed in the sitemap[\s\S]*\/articles\/short has robots "index, follow" but is left out of the sitemap[\s\S]*\/articles\/tech-stub was not prerendered/
    )
  })

  it('fails on an own-domain og:image that is not under public/', async () => {
    await fixture()
    await prerender(
      {
        ...indexed,
        '/articles/short': 'noindex,follow',
        '/articles/tech-stub': 'noindex,follow',
      },
      {
        '/': `${SITE}/social-preview.png`,
        '/articles/essay': `${SITE}/images/og/essay.jpg`,
        '/videos/essay': `${SITE}/images/articles/gone.jpg`,
        '/about': 'https://cdn.example.com/elsewhere.jpg',
      }
    )
    let problems: string[] = []
    try {
      verifyPrerendered(root, planSitemaps(root, TODAY), SITE)
    } catch (err) {
      problems = (err as Error).message.split('\n').slice(1)
    }
    // The other host's image is not checked; the existing own-domain images pass.
    expect(problems).toEqual([
      '  /videos/essay has og:image public/images/articles/gone.jpg, which does not exist',
    ])
  })

  it('accepts getStaticProps pages a deployment adapter took, when the manifest lists them', async () => {
    await fixture()
    // As on Vercel: onBuildComplete has moved the getStaticProps HTML out of .next, leaving the
    // automatically static pages and the prerender manifest.
    const automatic = ['/about', '/current-work', '/pitch']
    await prerender(Object.fromEntries(automatic.map((route) => [route, 'index, follow'])))
    const plan = planSitemaps(root, TODAY)
    const ssg = [
      ...plan.urls.map((url) => url.path),
      '/articles/short',
      '/articles/tech-stub',
    ].filter((route) => !automatic.includes(route))
    await put('.next/prerender-manifest.json', {
      routes: Object.fromEntries(ssg.map((route) => [route, {}])),
    })
    expect(() => verifyPrerendered(root, plan)).not.toThrow()

    await put('.next/prerender-manifest.json', {
      routes: Object.fromEntries(ssg.filter((r) => r !== '/videos/essay').map((r) => [r, {}])),
    })
    expect(() => verifyPrerendered(root, plan)).toThrow(/\/videos\/essay was not prerendered/)
  })
})

describe('robotsMeta', () => {
  it('reads the robots meta whatever the attribute order', () => {
    expect(
      robotsMeta('<meta charSet="utf-8"/><meta name="robots" content="noindex,follow"/>')
    ).toBe('noindex,follow')
    expect(robotsMeta('<meta content="index, follow" name="robots">')).toBe('index, follow')
    expect(robotsMeta('<meta name="description" content="robots"/>')).toBeNull()
  })

  it('reads property metas too, by exact key', () => {
    const html =
      '<meta property="og:image:width" content="1200"/>' +
      '<meta content="https://x.test/a.jpg" property="og:image"/>'
    expect(metaContent(html, 'og:image')).toBe('https://x.test/a.jpg')
    expect(metaContent(html, 'og:image:width')).toBe('1200')
    expect(metaContent(html, 'og:video')).toBeNull()
  })
})
