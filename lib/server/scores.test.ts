import { readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import getLeaderboardRoute from '../../pages/api/game/get-leaderboard'
import submitScoreRoute from '../../pages/api/game/submit-score'
import {
  LEADERBOARD_SIZE,
  SCORE_LIMIT_PERIOD_S,
  getLeaderboard,
  limiterKey,
  parseSubmission,
  sanitizeName,
  submitScore,
  type D1Like,
  type D1StatementLike,
  type RateLimiterLike,
} from './scores'

const MIGRATION = readFileSync(
  new URL('../../worker/migrations/0001_scores.sql', import.meta.url),
  'utf8'
)

// Production's bodies while no ledger is configured (curl, 2026-10-24). Vercel must keep them.
const PROD_GET_503 = '{"success":false,"leaderboard":[],"error":"Leaderboard not configured"}'
const PROD_POST_503 = '{"success":false,"error":"Leaderboard not configured"}'
const PROD_405 = '{"error":"Method not allowed"}'

/** D1 accepts null, numbers, strings and booleans (stored as 1/0). Undefined and objects throw. */
function d1Value(value: unknown): SQLInputValue {
  if (value === null || typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  throw new TypeError(`D1_TYPE_ERROR: Type '${typeof value}' not supported`)
}

/** D1 over node:sqlite: the real migration and SQL, with D1's bind rules and result shapes. */
function fakeD1() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(MIGRATION)
  const queries: string[] = []
  const statement = (sql: string, params: SQLInputValue[]): D1StatementLike => ({
    bind: (...values) => statement(sql, values.map(d1Value)),
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
  const db: D1Like = {
    prepare: (sql) => {
      queries.push(sql)
      return statement(sql, [])
    },
  }
  const seed = (rows: Array<[name: string, score: number, createdAt: string]>) => {
    const insert = sqlite.prepare(
      'insert into sphere_hunter_scores (player_name, score, created_at) values (?, ?, ?)'
    )
    for (const row of rows) insert.run(...row)
  }
  return { db, sqlite, queries, seed }
}

/** The Rate Limiting binding's contract: per key, the first `allow` calls in a window succeed. */
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

const API = 'https://alexwelcing.com/api/game'
const getRequest = (method = 'GET') => new Request(`${API}/get-leaderboard`, { method })
const postRequest = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${API}/submit-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
/** A filing streamed with no Content-Length, as a chunked HTTP/1.1 or an HTTP/2 upload arrives. */
const streamRequest = (source: UnderlyingDefaultSource<Uint8Array>) =>
  new Request(`${API}/submit-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
    body: new ReadableStream(source),
    duplex: 'half',
  } as RequestInit)

interface ScoreRow {
  player_name?: string
  name?: string
  score: number
}

/** GameTab.tsx's read of the envelope, line for line. */
async function gameTabRows(response: Response): Promise<ScoreRow[] | 'offline'> {
  if (!response.ok) return 'offline'
  const d = (await response.json()) as { leaderboard?: ScoreRow[]; scores?: ScoreRow[] }
  return (d.leaderboard ?? d.scores ?? []).slice(0, 5)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('sanitizeName', () => {
  it('strips control and zero-width characters and collapses whitespace', () => {
    expect(sanitizeName('  ACE\u0000\u200B  \t NINE\uFEFF\u0085 ')).toBe('ACE NINE')
    expect(sanitizeName('\u0007\u200D')).toBe('')
  })

  it('strips bidi embeddings, overrides and isolates, so a name cannot reorder the ledger', () => {
    expect(sanitizeName('\u202Eevil\u202C \u2066ACE\u2069\u202A\u202B\u202D\u2067\u2068')).toBe(
      'evil ACE'
    )
  })
})

describe('limiterKey', () => {
  it.each([
    ['203.0.113.7', '203.0.113.7'],
    ['2001:db8:85a3:12:aaaa:bbbb:cccc:dddd', '2001:db8:85a3:12::/64'],
    ['2001:0DB8:85A3:0012:0:0:0:1', '2001:db8:85a3:12::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['2001:db8:1:2::', '2001:db8:1:2::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['unknown', 'unknown'],
    ['1::2::3', '1::2::3'],
    ['2001:db8:zz::1', '2001:db8:zz::1'],
    ['1:2:3:4:5:6:7:8:9', '1:2:3:4:5:6:7:8:9'],
  ])('keys %s as %s', (ip, key) => {
    expect(limiterKey(ip)).toBe(key)
  })
})

describe('parseSubmission', () => {
  it('accepts what Sphere Hunter files and defaults the optional stats to 0', () => {
    expect(parseSubmission({ player_name: 'ACE9', score: 0, combo_max: 1 })).toEqual({
      ok: true,
      submission: {
        player_name: 'ACE9',
        score: 0,
        combo_max: 1,
        accuracy: 0,
        total_clicks: 0,
        successful_clicks: 0,
      },
    })
    const nulls = parseSubmission({ player_name: 'A', score: 5, combo_max: null, accuracy: null })
    expect(nulls.ok && nulls.submission).toMatchObject({ combo_max: 0, accuracy: 0 })
  })

  it.each([
    [{}, 'Missing required fields: player_name and score'],
    [null, 'Missing required fields: player_name and score'],
    [[], 'Missing required fields: player_name and score'],
    [{ score: 10 }, 'Missing required fields: player_name and score'],
    [{ player_name: '', score: 10 }, 'Missing required fields: player_name and score'],
    [{ player_name: 42, score: 10 }, 'Missing required fields: player_name and score'],
    [{ player_name: 'ACE' }, 'Missing required fields: player_name and score'],
    [{ player_name: 'ACE', score: '10' }, 'Missing required fields: player_name and score'],
    [
      { player_name: '\u200B \u0000', score: 10 },
      'Player name must be between 1 and 20 characters',
    ],
    [{ player_name: 'X'.repeat(21), score: 10 }, 'Player name must be between 1 and 20 characters'],
    [{ player_name: '\u202E\u2067', score: 10 }, 'Player name must be between 1 and 20 characters'],
    [{ player_name: 'ACE', score: -1 }, 'Invalid score range'],
    [{ player_name: 'ACE', score: 100_001 }, 'Invalid score range'],
    [{ player_name: 'ACE', score: 12.5 }, 'Invalid score range'],
    [{ player_name: 'ACE', score: 10, combo_max: 'x' }, 'Invalid stats'],
    [{ player_name: 'ACE', score: 10, combo_max: 1.5 }, 'Invalid stats'],
    [{ player_name: 'ACE', score: 10, total_clicks: -1 }, 'Invalid stats'],
    [{ player_name: 'ACE', score: 10, successful_clicks: {} }, 'Invalid stats'],
    [{ player_name: 'ACE', score: 10, accuracy: 101 }, 'Invalid stats'],
  ])('rejects %j', (body, error) => {
    expect(parseSubmission(body)).toEqual({ ok: false, error })
  })

  it('keeps the bounds inclusive and measures the sanitized name', () => {
    expect(parseSubmission({ player_name: 'X'.repeat(20), score: 100_000 }).ok).toBe(true)
    expect(parseSubmission({ player_name: `  ${'X'.repeat(20)}\u200B `, score: 0 }).ok).toBe(true)
    expect(parseSubmission({ player_name: 'ACE', score: 1, accuracy: 87.5 }).ok).toBe(true)
  })
})

describe('getLeaderboard', () => {
  it('returns the top five by score desc, then earliest filed, as GameTab reads it', async () => {
    const { db, seed } = fakeD1()
    seed([
      ['LOW', 10, '2026-10-01T00:00:00.000Z'],
      ['LATE', 500, '2026-10-03T00:00:00.000Z'],
      ['EARLY', 500, '2026-10-02T00:00:00.000Z'],
      ['TOP', 900, '2026-10-04T00:00:00.000Z'],
      ['MID', 300, '2026-10-01T00:00:00.000Z'],
      ['TIE-A', 200, '2026-10-05T00:00:00.000Z'],
      ['TIE-B', 200, '2026-10-05T00:00:00.000Z'],
    ])
    const response = await getLeaderboard(getRequest(), db)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    const body = await response.clone().json()
    expect(body.success).toBe(true)
    expect(body.leaderboard).toEqual([
      { player_name: 'TOP', score: 900, combo_max: 0, created_at: '2026-10-04T00:00:00.000Z' },
      { player_name: 'EARLY', score: 500, combo_max: 0, created_at: '2026-10-02T00:00:00.000Z' },
      { player_name: 'LATE', score: 500, combo_max: 0, created_at: '2026-10-03T00:00:00.000Z' },
      { player_name: 'MID', score: 300, combo_max: 0, created_at: '2026-10-01T00:00:00.000Z' },
      // An exact tie goes to whoever filed first (the lower id).
      { player_name: 'TIE-A', score: 200, combo_max: 0, created_at: '2026-10-05T00:00:00.000Z' },
    ])
    expect(await gameTabRows(response)).toHaveLength(LEADERBOARD_SIZE)
  })

  it('reads the scores_top index in order instead of sorting the table', async () => {
    const { db, sqlite, queries } = fakeD1()
    await getLeaderboard(getRequest(), db)
    const plan = sqlite.prepare(`explain query plan ${queries[0]}`).all(LEADERBOARD_SIZE)
    const details = plan.map((row) => String(row.detail)).join('\n')
    expect(details).toContain('scores_top')
    expect(details).not.toMatch(/TEMP B-TREE/i)
  })

  it('answers an empty ledger with an empty list', async () => {
    const response = await getLeaderboard(getRequest(), fakeD1().db)
    expect(await response.json()).toEqual({ success: true, leaderboard: [] })
  })

  it('answers the exact production 503 with no binding (GameTab: offline)', async () => {
    for (const db of [undefined, null]) {
      const response = await getLeaderboard(getRequest(), db)
      expect(response.status).toBe(503)
      expect(await response.clone().text()).toBe(PROD_GET_503)
      expect(await gameTabRows(response)).toBe('offline')
    }
  })

  it('refuses other methods with 405', async () => {
    const response = await getLeaderboard(getRequest('POST'), fakeD1().db)
    expect(response.status).toBe(405)
    expect(await response.text()).toBe(PROD_405)
  })

  it('turns a D1 failure into a 500 envelope without leaking the error', async () => {
    const db: D1Like = {
      prepare: () => {
        throw new Error('D1_ERROR: no such table: sphere_hunter_scores')
      },
    }
    const response = await getLeaderboard(getRequest(), db)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      leaderboard: [],
      error: 'Failed to fetch leaderboard',
    })
  })
})

describe('submitScore', () => {
  it('files a score and returns the stored row, which then tops the ledger', async () => {
    const { db } = fakeD1()
    const { limiter, keys } = fakeLimiter()
    const response = await submitScore(
      postRequest({ player_name: '  ACE\u200B9 ', score: 4200, combo_max: 7 }),
      db,
      limiter
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const { success, entry } = await response.json()
    expect(success).toBe(true)
    expect(entry).toEqual({
      id: 1,
      player_name: 'ACE9',
      score: 4200,
      combo_max: 7,
      accuracy: 0,
      total_clicks: 0,
      successful_clicks: 0,
      created_at: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/),
    })
    expect(keys).toEqual(['203.0.113.7:scores'])

    const board = await (await getLeaderboard(getRequest(), db)).json()
    expect(board.leaderboard).toEqual([
      { player_name: 'ACE9', score: 4200, combo_max: 7, created_at: entry.created_at },
    ])
  })

  it('rejects invalid filings with 400 before they spend any quota or reach D1', async () => {
    const { db, queries } = fakeD1()
    const { limiter, keys } = fakeLimiter()
    for (const body of [
      { player_name: 'ACE', score: -1 },
      { player_name: 'X'.repeat(21), score: 10 },
      { score: 10 },
    ]) {
      const response = await submitScore(postRequest(body), db, limiter)
      expect(response.status).toBe(400)
      expect(Object.keys(await response.json())).toEqual(['error'])
    }
    const malformed = await submitScore(postRequest('{"player_name":'), db, limiter)
    expect(malformed.status).toBe(400)
    expect(await malformed.json()).toEqual({ error: 'Invalid JSON' })
    expect(keys).toEqual([])
    expect(queries).toEqual([])
  })

  it('refuses an oversized body with 413', async () => {
    const { db } = fakeD1()
    const padding = 'x'.repeat(5000)
    const response = await submitScore(
      postRequest({ player_name: 'ACE', score: 1, padding }),
      db,
      fakeLimiter().limiter
    )
    expect(response.status).toBe(413)
  })

  it('refuses a declared Content-Length past the cap without reading the body', async () => {
    const request = postRequest({ player_name: 'ACE', score: 1 }, { 'Content-Length': '999999' })
    expect(request.headers.get('content-length')).toBe('999999')
    const response = await submitScore(request, fakeD1().db, fakeLimiter().limiter)
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'Payload too large' })
    expect(request.bodyUsed).toBe(false)
  })

  it('stops reading a streamed body at the cap instead of buffering it whole', async () => {
    const { db, queries } = fakeD1()
    const { limiter, keys } = fakeLimiter()
    let pulled = 0
    let cancelled = false
    const request = streamRequest({
      // 64 KiB in 1 KiB chunks. Reading it whole would pull all 64 before the length check.
      pull: (controller) => {
        if (++pulled > 64) return controller.close()
        controller.enqueue(new Uint8Array(1024).fill(0x20))
      },
      cancel: () => {
        cancelled = true
      },
    })
    expect(request.headers.has('content-length')).toBe(false)

    const response = await submitScore(request, db, limiter)
    expect(response.status).toBe(413)
    expect(await response.json()).toEqual({ error: 'Payload too large' })
    // The fifth chunk crosses 4 KiB. The stream may queue one ahead, but no further.
    expect(pulled).toBeLessThanOrEqual(6)
    expect(cancelled).toBe(true)
    expect(keys).toEqual([])
    expect(queries).toEqual([])
  })

  it('reassembles a streamed filing, with characters split across chunks', async () => {
    const { db } = fakeD1()
    const name = '\u00C5CE\u2605\u{1F680}'
    const bytes = new TextEncoder().encode(JSON.stringify({ player_name: name, score: 9 }))
    let at = 0
    // One byte per chunk, so every multi-byte character is cut mid-sequence.
    const request = streamRequest({
      pull: (controller) => {
        if (at < bytes.length) controller.enqueue(bytes.slice(at, ++at))
        else controller.close()
      },
    })
    const response = await submitScore(request, db, fakeLimiter().limiter)
    expect(response.status).toBe(200)
    expect((await response.json()).entry).toMatchObject({ player_name: name, score: 9 })
  })

  it.each([
    ['text/plain', '{"player_name":"ACE","score":1}'],
    ['text/plain;charset=UTF-8', '{"player_name":"ACE","score":1}'],
    ['application/x-www-form-urlencoded', 'player_name=ACE&score=1'],
    ['multipart/form-data; boundary=x', '--x\r\n'],
    ['application/jsonx', '{"player_name":"ACE","score":1}'],
  ])(
    'refuses a %s body with 415, as a cross-site page could send it without a preflight',
    async (type, body) => {
      const { db, queries } = fakeD1()
      const { limiter, keys } = fakeLimiter()
      const response = await submitScore(postRequest(body, { 'Content-Type': type }), db, limiter)
      expect(response.status).toBe(415)
      expect(await response.json()).toEqual({ error: 'Content-Type must be application/json' })
      expect(keys).toEqual([])
      expect(queries).toEqual([])
    }
  )

  it('refuses a body with no Content-Type with 415', async () => {
    const request = new Request(`${API}/submit-score`, {
      method: 'POST',
      body: new TextEncoder().encode('{"player_name":"ACE","score":1}'),
    })
    expect(request.headers.get('content-type')).toBeNull()
    const response = await submitScore(request, fakeD1().db, fakeLimiter().limiter)
    expect(response.status).toBe(415)
  })

  it.each(['application/json; charset=utf-8', 'Application/JSON'])(
    'accepts Content-Type %s',
    async (type) => {
      const request = postRequest({ player_name: 'ACE', score: 1 }, { 'Content-Type': type })
      const response = await submitScore(request, fakeD1().db, fakeLimiter().limiter)
      expect(response.status).toBe(200)
    }
  )

  it('answers a limiter denial with 429 and Retry-After, and writes nothing', async () => {
    const { db, sqlite } = fakeD1()
    const { limiter } = fakeLimiter(5)
    const file = () => submitScore(postRequest({ player_name: 'ACE', score: 1 }), db, limiter)
    for (let i = 0; i < 5; i++) expect((await file()).status).toBe(200)

    const denied = await file()
    expect(denied.status).toBe(429)
    expect(denied.headers.get('retry-after')).toBe(String(SCORE_LIMIT_PERIOD_S))
    expect(await denied.json()).toEqual({ error: 'Rate limit exceeded. Try again later.' })
    expect(sqlite.prepare('select count(*) as n from sphere_hunter_scores').get()).toEqual({ n: 5 })
  })

  it('keys the limiter on CF-Connecting-IP, then the first X-Forwarded-For hop', async () => {
    const { db } = fakeD1()
    const { limiter, keys } = fakeLimiter()
    const body = { player_name: 'ACE', score: 1 }
    await submitScore(postRequest(body, { 'X-Forwarded-For': '198.51.100.1' }), db, limiter)
    const json = { 'Content-Type': 'application/json' }
    const forwarded = new Request(`${API}/submit-score`, {
      method: 'POST',
      headers: { ...json, 'X-Forwarded-For': '198.51.100.2, 10.0.0.1' },
      body: JSON.stringify(body),
    })
    await submitScore(forwarded, db, limiter)
    await submitScore(
      new Request(`${API}/submit-score`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify(body),
      }),
      db,
      limiter
    )
    expect(keys).toEqual(['203.0.113.7:scores', '198.51.100.2:scores', 'unknown:scores'])
  })

  it('gives a whole IPv6 /64 one bucket, so rotating addresses inside it buys nothing', async () => {
    const { db } = fakeD1()
    const { limiter, keys } = fakeLimiter(5)
    const statuses: number[] = []
    for (let i = 1; i <= 6; i++) {
      const ip = { 'CF-Connecting-IP': `2001:db8:1:2::${i.toString(16)}` }
      const response = await submitScore(
        postRequest({ player_name: 'ACE', score: 1 }, ip),
        db,
        limiter
      )
      statuses.push(response.status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
    expect(new Set(keys)).toEqual(new Set(['2001:db8:1:2::/64:scores']))
  })

  it('answers the exact production 503 without a ledger or without its limiter', async () => {
    const { db } = fakeD1()
    const { limiter } = fakeLimiter()
    for (const [d, l] of [
      [null, limiter],
      [db, null],
      [undefined, undefined],
    ] as const) {
      const response = await submitScore(postRequest({ player_name: 'ACE', score: 1 }), d, l)
      expect(response.status).toBe(503)
      expect(await response.text()).toBe(PROD_POST_503)
    }
  })

  it('refuses other methods with 405', async () => {
    const response = await submitScore(getRequest(), fakeD1().db, fakeLimiter().limiter)
    expect(response.status).toBe(405)
    expect(await response.text()).toBe(PROD_405)
  })

  it('turns a failed insert into a 500 envelope', async () => {
    const { db, sqlite } = fakeD1()
    sqlite.exec('drop table sphere_hunter_scores')
    const response = await submitScore(
      postRequest({ player_name: 'ACE', score: 1 }),
      db,
      fakeLimiter().limiter
    )
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Failed to save score' })
  })

  it('turns a limiter fault into a 500 envelope', async () => {
    const limiter: RateLimiterLike = { limit: () => Promise.reject(new Error('binding down')) }
    const response = await submitScore(
      postRequest({ player_name: 'ACE', score: 1 }),
      fakeD1().db,
      limiter
    )
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ success: false, error: 'Internal server error' })
  })
})

describe('0001_scores.sql', () => {
  it('enforces the name and score bounds even when the handler is bypassed', () => {
    const { sqlite } = fakeD1()
    const insert = sqlite.prepare(
      'insert into sphere_hunter_scores (player_name, score) values (?, ?)'
    )
    expect(() => insert.run('', 1)).toThrow(/CHECK constraint/)
    expect(() => insert.run('X'.repeat(21), 1)).toThrow(/CHECK constraint/)
    expect(() => insert.run('ACE', -1)).toThrow(/CHECK constraint/)
    expect(() => insert.run('ACE', 100_001)).toThrow(/CHECK constraint/)
    expect(() => insert.run('ACE', null)).toThrow(/NOT NULL/)
    expect(insert.run('X'.repeat(20), 100_000).changes).toBe(1)
  })
})

describe('Vercel routes (no D1 binding until the cutover)', () => {
  function callRoute(
    route: (req: NextApiRequest, res: NextApiResponse) => unknown,
    method: string
  ) {
    const status = vi.fn()
    const json = vi.fn()
    const res = { status, json }
    status.mockReturnValue(res)
    route({ method } as NextApiRequest, res as unknown as NextApiResponse)
    return { status: status.mock.calls[0][0], body: JSON.stringify(json.mock.calls[0][0]) }
  }

  it('GET get-leaderboard answers the production 503, as the unbound Worker does', () => {
    expect(callRoute(getLeaderboardRoute, 'GET')).toEqual({ status: 503, body: PROD_GET_503 })
    expect(callRoute(getLeaderboardRoute, 'POST')).toEqual({ status: 405, body: PROD_405 })
  })

  it('POST submit-score answers the production 503, as the unbound Worker does', () => {
    expect(callRoute(submitScoreRoute, 'POST')).toEqual({ status: 503, body: PROD_POST_503 })
    expect(callRoute(submitScoreRoute, 'GET')).toEqual({ status: 405, body: PROD_405 })
  })
})
