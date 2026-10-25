// The Worker's bindings (wrangler.jsonc), as the structural slices the shared lib/ code accepts, so
// the routes and their vitest fakes never depend on the generated worker-configuration.d.ts.
// worker/index.ts hands the generated `Env` to a WorkerEnv parameter, so `pnpm cf:typecheck` fails
// when wrangler.jsonc and this interface drift apart.
import type { AiBindingLike } from '../lib/ai/providers/workersAi'
import type { D1Like, RateLimiterLike } from '../lib/server/scores'

/** env.ASSETS: the static export in out/ (Workers Static Assets). */
export interface AssetsLike {
  fetch(request: Request): Promise<Response>
}

export interface WorkerEnv {
  ASSETS: AssetsLike
  AI: AiBindingLike
  /** D1 'alexwelcing-game' (worker/migrations). */
  DB: D1Like
  /** 10 chats per 60 s per client: over it, Ship answers extractively instead of with the model. */
  SHIP_LIMITER: RateLimiterLike
  /** 5 filings per 60 s per client (lib/server/scores.ts). */
  SCORE_LIMITER: RateLimiterLike
  /** The canonical origin; any other host is a staging or preview host and gets noindex. */
  SITE_URL?: string
  /** Workers AI query embedder; dense retrieval runs only for a vector set built with it. */
  EMBED_MODEL?: string
  /** Comma-separated chat ladder; empty means DEFAULT_WORKERS_AI_MODELS. */
  SHIP_CHAT_MODELS?: string
  /** AI Gateway id in front of the AI binding; empty means none. */
  AI_GATEWAY_ID?: string
}
