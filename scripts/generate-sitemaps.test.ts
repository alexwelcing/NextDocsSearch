import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  STATIC_ROUTES,
  knownLastmod,
  planSitemaps,
  robotsMeta,
  urlsetXml,
  verifyPrerendered,
  videoSitemapXml,
} from './generate-sitemaps'

const SITE = 'https://alexwelcing.com'
const TODAY = '2026-10-24'
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

let root: string

async function put(file: string, contents: unknown) {
  const target = path.join(root, file)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, typeof contents === 'string' ? contents : JSON.stringify(contents))
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
  await put('public/arc/media.json', { films: ['essay'], plates: {} })
  await put('public/arc/records/essay.json', { hero: null, blocks: [{ t: 'p', x: words(400) }] })
  await put('public/arc/records/short.json', { hero: null, blocks: [{ t: 'p', x: words(120) }] })
  await put('public/arc/records/tech-stub.json', {
    hero: null,
    blocks: [{ t: 'p', x: words(900) }],
  })
}

/** Prerendered HTML as next build leaves it, with the given robots meta per route. */
async function prerender(pages: Record<string, string>) {
  for (const [route, robots] of Object.entries(pages)) {
    const name = route === '/' ? 'index' : route.slice(1)
    await put(
      `.next/server/pages/${name}.html`,
      `<head><meta name="robots" content="${robots}"/></head>`
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
      { slug: 'tech-stub', reason: 'tech-* stub family' },
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
})

describe('robotsMeta', () => {
  it('reads the robots meta whatever the attribute order', () => {
    expect(
      robotsMeta('<meta charSet="utf-8"/><meta name="robots" content="noindex,follow"/>')
    ).toBe('noindex,follow')
    expect(robotsMeta('<meta content="index, follow" name="robots">')).toBe('index, follow')
    expect(robotsMeta('<meta name="description" content="robots"/>')).toBeNull()
  })
})
