// The Sphere Hunter ledger on the Worker: lib/server/scores.ts over D1 and SCORE_LIMITER. Same
// paths and envelopes as the Vercel routes, so GameTab and SphereHunter need no change.
import { getLeaderboard, submitScore } from '../../lib/server/scores'
import type { WorkerEnv } from '../env'

export function leaderboard(request: Request, env: WorkerEnv): Promise<Response> {
  return getLeaderboard(request, env.DB)
}

export function score(request: Request, env: WorkerEnv): Promise<Response> {
  return submitScore(request, env.DB, env.SCORE_LIMITER)
}
