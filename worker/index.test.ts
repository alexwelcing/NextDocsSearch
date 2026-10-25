// The Worker router end to end over fake bindings: static assets from a Map, Workers AI replaying a
// recorded SSE stream, D1 over node:sqlite with the real migration, and counting rate limiters.
// The statically imported search manifest is swapped for the fixture index's, so Ship ranks a real
// (small) BM25 index served through the fake env.ASSETS.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiBindingLike } from '../lib/ai/providers/workersAi'
import { byteStream, sseFixture } from '../lib/ai/testing'
import { envelopeJson } from '../scripts/generate-archive-index'
import { resetSearchIndexCache } from '../lib/retrieval/load'
import { FIXTURE_ARCHIVE, fixtureIndex } from '../lib/retrieval/testing'
import type { SearchManifest } from '../lib/retrieval/types'
import type { D1Like, D1StatementLike, RateLimiterLike } from '../lib/server/scores'
import type { ShipEvent } from '../lib/ship/ndjson'
import type { AssetsLike, WorkerEnv } from './env'
import worker, { ROUTES, handle } from './index'
import { HSTS, MEDIA_CACHE, RANGED_PREFIXES } from './policy'
import { parseRange, sliceStream } from './routes/media'
import { EMBED_INSTRUCTION, denseVectorSet, shipDeps } from './routes/ship'

vi.mock('../lib/generated/search-manifest.json', async () => {
  const { fixtureIndex: build } = await import('../lib/retrieval/testing')
  return { default: (await build()).manifest }
})

const GEMMA = '@cf/google/gemma-4-26b-a4b-it'
const FILM_PATH = '/images/article-videos/film.mp4'
const FILM = Uint8Array.from({ length: 1000 }, (_, i) => i % 251)
const STAGING = 'https://next.alexwelcing.com'
const CANONICAL = 'https://alexwelcing.com'

const MIGRATION = readFileSync(new URL('./migrations/0001_scores.sql', import.meta.url), 'utf8')

/** D1 over node:sqlite, with D1's bind rules (as lib/server/scores.test.ts). */
function fakeD1(): D1Like {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(MIGRATION)
  const statement = (sql: string, params: SQLInputValue[]): D1StatementLike => ({
    bind: (...values) => statement(sql, values as SQLInputValue[]),
    first: async <T>() => {
      const row = sqlite.prepare(sql).get(...params)
      return row ? ({ ...row } as T) : null
    },
    all: async <T>() => ({
      results: sqlite
        .prepare(sql)
        .all(...params)
        .map((row) => ({ ...row } as T)),
    }),
  })
  return { prepare: (sql) => statement(sql, []) }
}

function fakeLimiter(allow = Infinity) {
  const keys: string[] = []
  const limiter: RateLimiterLike = {
    limit: async ({ key }) => {
      keys.push(key)
      return { success: keys.filter((k) => k === key).length <= allow }
    },
  }
  return { limiter, keys }
}

async function fakeEnv(
  options: { shipAllow?: number; scoreAllow?: number; overrides?: Partial<WorkerEnv> } = {}
) {
  const { assets } = await fixtureIndex()
  const files = new Map<string, BodyInit>(assets.map((asset) => [asset.path, asset.bytes]))
  files.set('/arc/archive-full.json', envelopeJson(FIXTURE_ARCHIVE))
  files.set('/arc/archive.json', envelopeJson(FIXTURE_ARCHIVE.map(({ slug }) => ({ slug }))))
  files.set('/about.html', '<html>about</html>')
  const fetched: string[] = []
  const ASSETS: AssetsLike = {
    // Like the assets service: Range is ignored, a HEAD has no body.
    fetch: async (request) => {
      const { pathname } = new URL(request.url)
      fetched.push(pathname)
      if (pathname === FILM_PATH) {
        return new Response(request.method === 'HEAD' ? null : FILM, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(FILM.length),
            ETag: '"film"',
          },
        })
      }
      const body = files.get(pathname)
      return body === undefined
        ? new Response('404 page', { status: 404 })
        : new Response(body, { headers: { ETag: '"fixture"' } })
    },
  }
  const runs: { model: string; inputs: Record<string, unknown> }[] = []
  const AI: AiBindingLike = {
    run: async (model, inputs) => {
      runs.push({ model, inputs })
      if ('queries' in inputs) return { shape: [1, 4], data: [[0.5, 0.5, 0.5, 0.5]] }
      return byteStream(sseFixture('workers-ai-gemma-4'), 37)
    },
  }
  const ship = fakeLimiter(options.shipAllow)
  const score = fakeLimiter(options.scoreAllow)
  const env: WorkerEnv = {
    ASSETS,
    AI,
    DB: fakeD1(),
    SHIP_LIMITER: ship.limiter,
    SCORE_LIMITER: score.limiter,
    SITE_URL: CANONICAL,
    EMBED_MODEL: '@cf/qwen/qwen3-embedding-0.6b',
    SHIP_CHAT_MODELS: '',
    AI_GATEWAY_ID: '',
    ...options.overrides,
  }
  return { env, fetched, runs, shipKeys: ship.keys, scoreKeys: score.keys }
}

const request = (path: string, init: RequestInit = {}, origin = STAGING) =>
  new Request(`${origin}${path}`, {
    ...init,
    headers: { 'CF-Connecting-IP': '203.0.113.7', ...(init.headers as Record<string, string>) },
  })

const shipPost = (body: unknown, origin = STAGING) =>
  request(
    '/api/vector-search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    origin
  )

const scorePost = (body: unknown) =>
  request('/api/game/submit-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

async function events(response: Response): Promise<ShipEvent[]> {
  expect(response.status).toBe(200)
  expect(response.headers.get('content-type')).toContain('application/x-ndjson')
  return (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as ShipEvent)
}

afterEach(() => {
  resetSearchIndexCache()
})

describe('worker router', () => {
  it('routes exactly the three API families', () => {
    expect(Object.keys(ROUTES).sort()).toEqual([
      '/api/arc/archive',
      '/api/game/get-leaderboard',
      '/api/game/submit-score',
      '/api/vector-search',
    ])
  })

  it('hands every non-API path to the static assets untouched', async () => {
    const { env, fetched } = await fakeEnv()
    const response = await worker.fetch(request('/about.html'), env as never)
    expect(await response.text()).toBe('<html>about</html>')
    expect(fetched).toEqual(['/about.html'])
    // _headers applies to asset responses; the router adds nothing of its own to them.
    expect(response.headers.get('x-robots-tag')).toBeNull()
  })

  it('answers an unknown API path with a JSON 404, never the 404 page', async () => {
    const { env, fetched } = await fakeEnv()
    for (const path of ['/api', '/api/', '/api/nope', '/api/vector-search/extra']) {
      const response = await handle(request(path), env)
      expect(response.status).toBe(404)
      expect(response.headers.get('content-type')).toContain('application/json')
      expect(await response.json()).toEqual({ error: 'Not found' })
    }
    expect(fetched).toEqual([])
  })

  it('sends noindex on every host but the canonical one, and HSTS everywhere', async () => {
    const { env } = await fakeEnv()
    for (const origin of [STAGING, 'https://alexwelcing-site.example.workers.dev']) {
      const response = await handle(request('/api/nope', {}, origin), env)
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
      expect(response.headers.get('strict-transport-security')).toBe(HSTS)
    }
    const canonical = await handle(request('/api/nope', {}, CANONICAL), env)
    expect(canonical.headers.get('x-robots-tag')).toBeNull()
    expect(canonical.headers.get('strict-transport-security')).toBe(HSTS)
  })

  it('turns a throwing route into a JSON 500', async () => {
    const { env } = await fakeEnv()
    env.ASSETS = {
      fetch: async () => {
        throw new Error('binding down')
      },
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const response = await handle(request('/api/arc/archive'), env)
    spy.mockRestore()
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Internal server error' })
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })
})

describe('GET /api/arc/archive', () => {
  it('serves the slim index by default and the full one for ?view=full', async () => {
    const { env, fetched } = await fakeEnv()
    const slim = await handle(request('/api/arc/archive'), env)
    expect(slim.status).toBe(200)
    expect(slim.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(slim.headers.get('cache-control')).toBe(
      'public, max-age=300, stale-while-revalidate=86400'
    )
    expect(slim.headers.get('etag')).toBe('"fixture"')
    expect((await slim.json()).records[0]).toEqual({ slug: FIXTURE_ARCHIVE[0].slug })

    const full = await handle(request('/api/arc/archive?view=full'), env)
    const body = (await full.json()) as { records: { searchText: string }[]; total: number }
    expect(body.total).toBe(FIXTURE_ARCHIVE.length)
    expect(body.records[0].searchText).toBe(FIXTURE_ARCHIVE[0].searchText)
    expect(fetched).toEqual(['/arc/archive.json', '/arc/archive-full.json'])
  })

  it('refuses writes and reports a missing index as 503', async () => {
    const { env } = await fakeEnv()
    const post = await handle(request('/api/arc/archive', { method: 'POST' }), env)
    expect(post.status).toBe(405)
    env.ASSETS = { fetch: async () => new Response('404 page', { status: 404 }) }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const missing = await handle(request('/api/arc/archive'), env)
    spy.mockRestore()
    expect(missing.status).toBe(503)
  })
})

describe('the D1 leaderboard', () => {
  it('starts empty, round-trips a filing, and ranks it', async () => {
    const { env, scoreKeys } = await fakeEnv()
    const empty = await handle(request('/api/game/get-leaderboard'), env)
    expect(empty.status).toBe(200)
    expect(await empty.json()).toEqual({ success: true, leaderboard: [] })

    const filed = await handle(
      scorePost({ player_name: 'ORBITER', score: 4200, combo_max: 7 }),
      env
    )
    expect(filed.status).toBe(200)
    const { success, entry } = (await filed.json()) as {
      success: boolean
      entry: { id: number; player_name: string; score: number }
    }
    expect(success).toBe(true)
    expect(entry).toMatchObject({ id: 1, player_name: 'ORBITER', score: 4200, combo_max: 7 })
    expect(scoreKeys).toEqual(['203.0.113.7:scores'])

    const board = await handle(request('/api/game/get-leaderboard'), env)
    const { leaderboard } = (await board.json()) as { leaderboard: { player_name: string }[] }
    expect(leaderboard).toEqual([
      expect.objectContaining({ player_name: 'ORBITER', score: 4200, combo_max: 7 }),
    ])
  })

  it('returns 429 with Retry-After once SCORE_LIMITER says no', async () => {
    const { env } = await fakeEnv({ scoreAllow: 5 })
    for (let i = 0; i < 5; i++) {
      expect((await handle(scorePost({ player_name: 'P', score: i }), env)).status).toBe(200)
    }
    const sixth = await handle(scorePost({ player_name: 'P', score: 6 }), env)
    expect(sixth.status).toBe(429)
    expect(sixth.headers.get('retry-after')).toBe('60')
  })

  it('keeps the method contract of each path', async () => {
    const { env } = await fakeEnv()
    expect(
      (await handle(request('/api/game/get-leaderboard', { method: 'POST' }), env)).status
    ).toBe(405)
    expect((await handle(request('/api/game/submit-score'), env)).status).toBe(405)
  })
})

describe('POST /api/vector-search', () => {
  it('streams instant results, answer deltas and a Workers AI final answer', async () => {
    const { env, runs, shipKeys } = await fakeEnv()
    const list = await events(await handle(shipPost({ prompt: 'photon polarization BB84' }), env))

    const [first, ...rest] = list
    expect(first).toMatchObject({ type: 'instant-results', retrieval: 'lexical' })
    if (first.type !== 'instant-results') throw new Error('unreachable')
    expect(first.items[0]).toMatchObject({ slug: 'quantum-key-distribution' })

    const deltas = rest.filter((event) => event.type === 'answer-delta')
    expect(deltas.length).toBeGreaterThan(0)
    const final = rest[rest.length - 1]
    expect(final).toMatchObject({ type: 'final-answer', provider: `workers-ai:${GEMMA}` })
    if (final.type !== 'final-answer') throw new Error('unreachable')
    expect(final.answer.length).toBeGreaterThan(0)
    expect(final.answer).not.toContain('The user wants a profile answer.')

    // One chat call on the primary with thinking off; no embedding (the index has no vectors).
    expect(runs.map((run) => run.model)).toEqual([GEMMA])
    expect(runs[0].inputs).toMatchObject({
      stream: true,
      max_completion_tokens: expect.any(Number),
      chat_template_kwargs: { enable_thinking: false },
    })
    expect(shipKeys).toEqual(['203.0.113.7:ship'])
  })

  it('answers extractively, without the model, once SHIP_LIMITER says no', async () => {
    const { env, runs } = await fakeEnv({ shipAllow: 0 })
    const list = await events(await handle(shipPost({ prompt: 'photon polarization BB84' }), env))
    expect(list[list.length - 1]).toMatchObject({
      type: 'final-answer',
      provider: 'local-archive',
    })
    expect(runs).toEqual([])
  })

  it('serves /help as plain text', async () => {
    const { env, runs } = await fakeEnv()
    const response = await handle(shipPost({ prompt: '/help' }), env)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect((await response.text()).length).toBeGreaterThan(0)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(runs).toEqual([])
  })

  it('loads the index and the records once per isolate, through env.ASSETS', async () => {
    const { env, fetched } = await fakeEnv()
    await events(await handle(shipPost({ prompt: 'photon polarization' }), env))
    await events(await handle(shipPost({ prompt: 'agent credentials' }), env))
    const counts = fetched.reduce<Record<string, number>>((all, path) => {
      all[path] = (all[path] ?? 0) + 1
      return all
    }, {})
    expect(counts['/arc/archive-full.json']).toBe(1)
    expect(Object.keys(counts).filter((path) => path.startsWith('/search/'))).toHaveLength(2)
    for (const [path, count] of Object.entries(counts)) {
      if (path.startsWith('/search/')) expect(count).toBe(1)
    }
  })

  it('rejects a non-POST like the Vercel route', async () => {
    const { env } = await fakeEnv()
    const response = await handle(request('/api/vector-search'), env)
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })
})

describe('shipDeps', () => {
  const withVectors = async (): Promise<SearchManifest> => {
    const { manifest } = await fixtureIndex()
    return {
      ...manifest,
      vectors: [
        {
          model: 'Qwen/Qwen3-Embedding-0.6B',
          runtime: '@cf/qwen/qwen3-embedding-0.6b',
          dims: 4,
          quant: 'int8-row',
          chunkerVersion: manifest.chunkerVersion,
          rows: manifest.chunks,
          present: manifest.chunks,
          hashes: manifest.hashes,
          asset: '/search/vec.fixture.bin',
          mrl: true,
        },
      ],
    }
  }

  it('leaves dense retrieval off while no vector set matches EMBED_MODEL', async () => {
    const { env } = await fakeEnv()
    const { manifest } = await fixtureIndex()
    expect(shipDeps(env, manifest).embedQuery).toBeUndefined()
    const other = { ...env, EMBED_MODEL: '@cf/baai/bge-small-en-v1.5' }
    expect(shipDeps(other, await withVectors()).embedQuery).toBeUndefined()
    expect(denseVectorSet(await withVectors(), undefined)).toBeUndefined()
  })

  it('embeds queries with EMBED_MODEL and the set instruction once a matching set ships', async () => {
    const { env, runs } = await fakeEnv()
    const deps = shipDeps(env, await withVectors())
    expect(deps.embedModel).toBe('Qwen/Qwen3-Embedding-0.6B')
    const vector = await deps.embedQuery!('who is alex', new AbortController().signal)
    expect(Array.from(vector)).toEqual([0.5, 0.5, 0.5, 0.5])
    expect(runs).toEqual([
      {
        model: '@cf/qwen/qwen3-embedding-0.6b',
        inputs: { queries: ['who is alex'], instruction: EMBED_INSTRUCTION },
      },
    ])
  })

  it('uses SHIP_CHAT_MODELS as the ladder when it is set', async () => {
    const { env, runs } = await fakeEnv({
      overrides: { SHIP_CHAT_MODELS: '@cf/meta/llama-4-scout-17b-16e-instruct' },
    })
    await events(await handle(shipPost({ prompt: 'photon polarization' }), env))
    expect(runs.map((run) => run.model)).toEqual(['@cf/meta/llama-4-scout-17b-16e-instruct'])
  })
})

describe('films with byte ranges', () => {
  const film = (headers: Record<string, string> = {}, method = 'GET') =>
    request(FILM_PATH, { method, headers })
  const bytes = async (response: Response) => new Uint8Array(await response.arrayBuffer())

  it("answers bytes=0-1 (Safari's probe) with 206 and exactly two bytes", async () => {
    const { env } = await fakeEnv()
    const response = await handle(film({ Range: 'bytes=0-1' }), env)
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 0-1/1000')
    expect(response.headers.get('content-length')).toBe('2')
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('content-type')).toBe('video/mp4')
    expect(response.headers.get('cache-control')).toBe(MEDIA_CACHE)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(response.headers.get('strict-transport-security')).toBe(HSTS)
    expect(Array.from(await bytes(response))).toEqual([0, 1])
  })

  it('serves open-ended, suffix and clamped ranges from the right offsets', async () => {
    const { env } = await fakeEnv()
    const cases: [string, number, number][] = [
      ['bytes=990-', 990, 999],
      ['bytes=-5', 995, 999],
      ['bytes=500-5000', 500, 999],
      ['bytes=-5000', 0, 999],
    ]
    for (const [range, start, end] of cases) {
      const response = await handle(film({ Range: range }), env)
      expect(response.status).toBe(206)
      expect(response.headers.get('content-range')).toBe(`bytes ${start}-${end}/1000`)
      expect(Array.from(await bytes(response))).toEqual(Array.from(FILM.subarray(start, end + 1)))
    }
  })

  it('answers a range past the end with 416 and the size', async () => {
    const { env } = await fakeEnv()
    const response = await handle(film({ Range: 'bytes=1000-' }), env)
    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */1000')
    expect(await response.text()).toBe('')
  })

  it('sends the whole file, advertising ranges, for no range or one it may ignore', async () => {
    const { env } = await fakeEnv()
    for (const headers of [
      {},
      { Range: 'bytes=0-1,5-6' },
      { Range: 'items=0-1' },
      { Range: 'bytes=9-3' },
      { Range: 'bytes=0-1', 'If-Range': '"another-version"' },
    ]) {
      const response = await handle(film(headers), env)
      expect(response.status).toBe(200)
      expect(response.headers.get('accept-ranges')).toBe('bytes')
      expect(response.headers.get('cache-control')).toBe(MEDIA_CACHE)
      expect((await bytes(response)).length).toBe(1000)
    }
    const current = await handle(film({ Range: 'bytes=0-1', 'If-Range': '"film"' }), env)
    expect(current.status).toBe(206)
  })

  it('answers a ranged HEAD with the 206 headers and no body', async () => {
    const { env } = await fakeEnv()
    const response = await handle(film({ Range: 'bytes=0-99' }, 'HEAD'), env)
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 0-99/1000')
    expect(response.headers.get('content-length')).toBe('100')
    expect(response.body).toBeNull()
  })

  it('passes a 206 or a 404 from the assets service through', async () => {
    const { env } = await fakeEnv()
    env.ASSETS = {
      fetch: async () =>
        new Response('ab', { status: 206, headers: { 'Content-Range': 'bytes 0-1/1000' } }),
    }
    const partial = await handle(film({ Range: 'bytes=0-1' }), env)
    expect(partial.status).toBe(206)
    expect(partial.headers.get('content-range')).toBe('bytes 0-1/1000')
    expect(partial.headers.get('cache-control')).toBe(MEDIA_CACHE)
    env.ASSETS = { fetch: async () => new Response('404 page', { status: 404 }) }
    const missing = await handle(request('/videos/articles/nope.mp4'), env)
    expect(missing.status).toBe(404)
    expect(await missing.text()).toBe('404 page')
  })

  it('is routed for exactly the prefixes wrangler.jsonc sends to the Worker', () => {
    const config = JSON.parse(
      readFileSync(fileURLToPath(new URL('../wrangler.jsonc', import.meta.url)), 'utf8')
        .split('\n')
        .filter((line) => !/^\s*\/\//.test(line))
        .join('\n')
    ) as { assets: { run_worker_first: string[] } }
    expect(config.assets.run_worker_first).toEqual([
      '/api/*',
      ...RANGED_PREFIXES.map((prefix) => `${prefix}*`),
    ])
  })

  it('parses ranges per RFC 9110', () => {
    expect(parseRange(null, 10)).toBeNull()
    expect(parseRange('bytes=0-0', 10)).toEqual({ start: 0, end: 0 })
    expect(parseRange('bytes=3-', 10)).toEqual({ start: 3, end: 9 })
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 })
    expect(parseRange('bytes=-0', 10)).toBe('unsatisfiable')
    expect(parseRange('bytes=10-12', 10)).toBe('unsatisfiable')
    expect(parseRange('bytes=0-1', 0)).toBe('unsatisfiable')
    expect(parseRange('bytes=-', 10)).toBeNull()
    expect(parseRange('bytes=5-4', 10)).toBeNull()
  })

  it('slices across chunk boundaries and stops reading at the end of the range', async () => {
    let pulls = 0
    const source = new ReadableStream<Uint8Array>({
      pull(controller) {
        const offset = pulls * 7
        pulls += 1
        if (offset >= FILM.length) controller.close()
        else controller.enqueue(FILM.slice(offset, offset + 7))
      },
    })
    const sliced = new Response(source.pipeThrough(sliceStream({ start: 13, end: 40 })))
    expect(Array.from(new Uint8Array(await sliced.arrayBuffer()))).toEqual(
      Array.from(FILM.subarray(13, 41))
    )
    expect(pulls).toBeLessThan(10)
  })
})
