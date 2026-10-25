// POST /api/game/submit-score on Vercel. Filings go to D1 behind the Cloudflare Worker, which
// serves this path with lib/server/scores.ts, env.DB and env.SCORE_LIMITER. Vercel has no D1
// binding, so until the DNS cutover this answers what production has answered since Supabase went
// dark: 503 'Leaderboard not configured' (Sphere Hunter offers a retry). Deleted in P4.

import type { NextApiRequest, NextApiResponse } from 'next'
import { METHOD_NOT_ALLOWED, SUBMIT_UNAVAILABLE } from '@/lib/server/scores'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json(METHOD_NOT_ALLOWED)
  res.status(503).json(SUBMIT_UNAVAILABLE)
}
