// The Cloudflare Worker 'alexwelcing-site' (wrangler.jsonc): a plain fetch router in front of the
// static export in out/. Static assets answer every other path without running this code (only
// assets.run_worker_first reaches it); out/_headers and out/_redirects cover those, and never
// apply to the responses below, so the router sets their headers itself.
//
//   POST /api/vector-search      Ship (lib/ship/handleShip.ts) on Workers AI
//   GET  /api/game/get-leaderboard, POST /api/game/submit-score   D1 ledger (lib/server/scores.ts)
//   GET  /api/arc/archive        alias of /arc/archive.json (?view=full: archive-full.json)
//   anything else under /api     JSON 404
//   the film directories         static files with byte ranges (routes/media.ts)
import type { WorkerEnv } from './env'
import { HSTS, NOINDEX, RANGED_PREFIXES } from './policy'
import { archive } from './routes/archive'
import { media } from './routes/media'
import { leaderboard, score } from './routes/scores'
import { ship } from './routes/ship'

type Route = (request: Request, env: WorkerEnv) => Promise<Response>

export const ROUTES: Record<string, Route> = {
  '/api/vector-search': ship,
  '/api/game/get-leaderboard': leaderboard,
  '/api/game/submit-score': score,
  '/api/arc/archive': archive,
}

const CANONICAL_HOST = 'alexwelcing.com'

function canonicalHost(env: WorkerEnv): string {
  try {
    return env.SITE_URL ? new URL(env.SITE_URL).hostname : CANONICAL_HOST
  } catch {
    return CANONICAL_HOST
  }
}

/**
 * What middleware.ts did on Vercel and the _headers host rules do for assets: every host but the
 * canonical one (workers.dev, preview URLs, next.alexwelcing.com) is kept out of the index.
 */
function finish(response: Response, hostname: string, env: WorkerEnv): Response {
  // Responses from bindings can have immutable headers; rewrapping keeps a streamed body streaming.
  const out = new Response(response.body, response)
  out.headers.set('Strict-Transport-Security', HSTS)
  if (hostname !== canonicalHost(env)) out.headers.set('X-Robots-Tag', NOINDEX)
  return out
}

const notFound = () =>
  Response.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })

async function api(request: Request, env: WorkerEnv, pathname: string): Promise<Response> {
  const route = ROUTES[pathname]
  try {
    return route ? await route(request, env) : notFound()
  } catch (error) {
    // Every route answers its own failures; this is the last line, never a bare 500 page.
    console.error(`worker: ${pathname} failed`, error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

async function ranged(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    return await media(request, env)
  } catch (error) {
    // Ranges are an improvement over the plain file, never a reason to fail it.
    console.error('worker: ranged media failed, serving the file whole', error)
    return env.ASSETS.fetch(request)
  }
}

export async function handle(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url)
  const { pathname, hostname } = url
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    return finish(await api(request, env, pathname), hostname, env)
  }
  if (RANGED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return finish(await ranged(request, env), hostname, env)
  }
  // Nothing else is routed to the Worker; should it be, the static export answers.
  return env.ASSETS.fetch(request)
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    // The generated Env (worker-configuration.d.ts) must satisfy the structural WorkerEnv.
    return handle(request, env)
  },
} satisfies ExportedHandler<Env>
