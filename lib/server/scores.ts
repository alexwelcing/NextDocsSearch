// Sphere Hunter's public ledger, platform-neutral: a Fetch API Request in and a Response out, over
// any D1Database-shaped db and Rate Limiting binding. The Cloudflare Worker serves both paths with
// getLeaderboard(request, env.DB) and submitScore(request, env.DB, env.SCORE_LIMITER). The
// transitional Vercel routes (pages/api/game) have neither binding and answer the 503 envelopes
// below. Schema: worker/migrations/0001_scores.sql.
//
// There is no edge caching. Cloudflare does not cache a Worker's own response because of its
// Cache-Control header (s-maxage included), and browsers ignore s-maxage. A top-5 read touches
// five indexed rows, which fits easily in D1's free reads. If the ledger ever runs hot, cache the
// GET with the Cache API (caches.default, custom domains only). Then delete that entry on a
// successful submit, so the player's new score still shows at once.

/** The slice of D1's D1PreparedStatement used here. Structural, so no Worker types leak in. */
export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
}

/** The slice of D1Database used here: env.DB on the Worker. */
export interface D1Like {
  prepare(query: string): D1StatementLike
}

/** The Workers Rate Limiting binding: env.SCORE_LIMITER on the Worker. */
export interface RateLimiterLike {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/** One leaderboard row: only what the ledger shows. */
export interface LeaderboardEntry {
  player_name: string
  score: number
  combo_max: number
  created_at: string
}

/** A filed score as stored (INSERT ... RETURNING *). */
export interface ScoreEntry extends LeaderboardEntry {
  id: number
  accuracy: number
  total_clicks: number
  successful_clicks: number
}

export type ScoreSubmission = Omit<ScoreEntry, 'id' | 'created_at'>

export const LEADERBOARD_SIZE = 5
/** The SCORE_LIMITER window (5 filings per 60 s per IP). The binding never says when it resets. */
export const SCORE_LIMIT_PERIOD_S = 60

const NAME_MAX = 20
const SCORE_MAX = 100_000
const COUNT_MAX = 1_000_000
const ACCURACY_MAX = 100
/** A real filing is under 100 bytes. Anything far past that is not worth reading. */
const BODY_MAX_BYTES = 4096

const NOT_CONFIGURED = 'Leaderboard not configured'

// Production's exact bodies (checked with curl on 2026-10-24) while no ledger is configured.
export const METHOD_NOT_ALLOWED = { error: 'Method not allowed' } as const
export const LEADERBOARD_UNAVAILABLE = {
  success: false,
  leaderboard: [],
  error: NOT_CONFIGURED,
} as const
export const SUBMIT_UNAVAILABLE = { success: false, error: NOT_CONFIGURED } as const

const TOP_SCORES_SQL = `select player_name, score, combo_max, created_at
from sphere_hunter_scores
order by score desc, created_at asc, id asc
limit ?`

const INSERT_SQL = `insert into sphere_hunter_scores
  (player_name, score, combo_max, accuracy, total_clicks, successful_clicks)
values (?, ?, ?, ?, ?, ?)
returning *`

export function sanitizeName(name: string): string {
  // Strip control characters, zero-width chars, bidi embeddings/overrides/isolates (which would let
  // a ledger name reorder the text around it), and normalize whitespace
  return name
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** An optional stat: absent or null is 0. A value out of bounds or of the wrong kind is null. */
function stat(value: unknown, max: number, integer: boolean): number | null {
  if (value === undefined || value === null) return 0
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (integer && !Number.isInteger(value)) return null
  return value >= 0 && value <= max ? value : null
}

/** submit-score's validation, plus type checks so that D1 never sees a value it can't bind. */
export function parseSubmission(
  body: unknown
): { ok: true; submission: ScoreSubmission } | { ok: false; error: string } {
  const fields = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const { player_name, score } = fields
  if (typeof player_name !== 'string' || !player_name || typeof score !== 'number') {
    return { ok: false, error: 'Missing required fields: player_name and score' }
  }
  const name = sanitizeName(player_name)
  if (name.length < 1 || name.length > NAME_MAX) {
    return { ok: false, error: `Player name must be between 1 and ${NAME_MAX} characters` }
  }
  if (!Number.isInteger(score) || score < 0 || score > SCORE_MAX) {
    return { ok: false, error: 'Invalid score range' }
  }
  const combo_max = stat(fields.combo_max, COUNT_MAX, true)
  const accuracy = stat(fields.accuracy, ACCURACY_MAX, false)
  const total_clicks = stat(fields.total_clicks, COUNT_MAX, true)
  const successful_clicks = stat(fields.successful_clicks, COUNT_MAX, true)
  if (
    combo_max === null ||
    accuracy === null ||
    total_clicks === null ||
    successful_clicks === null
  ) {
    return { ok: false, error: 'Invalid stats' }
  }
  return {
    ok: true,
    submission: { player_name: name, score, combo_max, accuracy, total_clicks, successful_clicks },
  }
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // A ledger read must show the score the player just filed.
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

/** Cloudflare always sets CF-Connecting-IP. X-Forwarded-For is only a fallback for other hosts. */
export function clientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/**
 * The limiter bucket for a client address. An IPv6 client holds at least a /64 and can rotate
 * through it at will, so IPv6 is keyed on that prefix; IPv4 (or IPv4-mapped IPv6) is keyed whole.
 * Anything that doesn't parse is keyed as given.
 */
export function limiterKey(ip: string): string {
  const address = ip.split('%')[0] // an IPv6 zone id names the interface, not the client
  if (!address.includes(':')) return address
  if (address.includes('.')) return address.slice(address.lastIndexOf(':') + 1) // ::ffff:a.b.c.d
  let groups = address.split(':')
  const gap = address.split('::')
  if (gap.length === 2) {
    const [head, tail] = gap.map((half) => (half ? half.split(':') : []))
    const zeros = Array<string>(Math.max(0, 8 - head.length - tail.length)).fill('0')
    groups = [...head, ...zeros, ...tail]
  }
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return address
  const prefix = groups.slice(0, 4).map((g) => parseInt(g, 16).toString(16))
  return `${prefix.join(':')}::/64`
}

/**
 * Only a JSON filing is read. A cross-site page can send text/plain (a no-cors fetch, or a
 * <form enctype="text/plain"> shaped into JSON) without a CORS preflight, but not
 * application/json, and the Worker answers no preflight. So this keeps filings same-origin.
 */
function isJson(headers: Headers): boolean {
  const type = headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  return type === 'application/json'
}

/**
 * The body as text, or null past BODY_MAX_BYTES. It reads at most that much (plus one chunk),
 * whether or not Content-Length is sent, so a huge chunked body is never buffered whole.
 */
async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get('content-length')) > BODY_MAX_BYTES) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return text + decoder.decode()
    size += value.byteLength
    if (size > BODY_MAX_BYTES) {
      // Not awaited: the answer doesn't depend on how the rest of the upload is torn down.
      reader.cancel().catch(() => {})
      return null
    }
    text += decoder.decode(value, { stream: true })
  }
}

async function readJson(
  request: Request
): Promise<{ ok: true; body: unknown } | { ok: false; status: number; error: string }> {
  const text = await readBody(request)
  if (text === null) return { ok: false, status: 413, error: 'Payload too large' }
  try {
    return { ok: true, body: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON' }
  }
}

/** GET /api/game/get-leaderboard: the top five, by score desc and then earliest filed. */
export async function getLeaderboard(request: Request, db?: D1Like | null): Promise<Response> {
  if (request.method !== 'GET') return json(405, METHOD_NOT_ALLOWED)
  if (!db) return json(503, LEADERBOARD_UNAVAILABLE)
  try {
    const { results } = await db
      .prepare(TOP_SCORES_SQL)
      .bind(LEADERBOARD_SIZE)
      .all<LeaderboardEntry>()
    return json(200, { success: true, leaderboard: results })
  } catch (error) {
    console.error('scores: leaderboard read failed', error)
    return json(500, { success: false, leaderboard: [], error: 'Failed to fetch leaderboard' })
  }
}

/** POST /api/game/submit-score: validate, rate-limit per client, insert, return the stored row. */
export async function submitScore(
  request: Request,
  db?: D1Like | null,
  limiter?: RateLimiterLike | null
): Promise<Response> {
  if (request.method !== 'POST') return json(405, METHOD_NOT_ALLOWED)
  // Without the limiter, an unthrottled write path would be open, so treat it as unconfigured.
  if (!db || !limiter) return json(503, SUBMIT_UNAVAILABLE)
  if (!isJson(request.headers)) {
    return json(415, { error: 'Content-Type must be application/json' })
  }
  try {
    const read = await readJson(request)
    if (!read.ok) return json(read.status, { error: read.error })
    const parsed = parseSubmission(read.body)
    if (!parsed.ok) return json(400, { error: parsed.error })

    // Only well-formed filings spend the caller's quota, so a typo never locks a player out.
    const key = `${limiterKey(clientIp(request.headers))}:scores`
    const { success } = await limiter.limit({ key })
    if (!success) {
      return json(
        429,
        { error: 'Rate limit exceeded. Try again later.' },
        { 'Retry-After': String(SCORE_LIMIT_PERIOD_S) }
      )
    }

    const s = parsed.submission
    let entry: ScoreEntry | null
    try {
      entry = await db
        .prepare(INSERT_SQL)
        .bind(s.player_name, s.score, s.combo_max, s.accuracy, s.total_clicks, s.successful_clicks)
        .first<ScoreEntry>()
    } catch (error) {
      console.error('scores: insert failed', error)
      entry = null
    }
    if (!entry) return json(500, { success: false, error: 'Failed to save score' })
    return json(200, { success: true, entry })
  } catch (error) {
    console.error('scores: submit failed', error)
    return json(500, { success: false, error: 'Internal server error' })
  }
}
