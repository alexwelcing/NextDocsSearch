// GET /api/game/get-leaderboard on Vercel. The ledger lives in D1 behind the Cloudflare Worker,
// which serves this path with lib/server/scores.ts and env.DB. Vercel has no D1 binding, so until
// the DNS cutover this answers what production has answered since Supabase went dark: 503
// 'Leaderboard not configured' (GameTab shows the ledger offline). Deleted in P4.

import type { NextApiRequest, NextApiResponse } from 'next'
import { LEADERBOARD_UNAVAILABLE, METHOD_NOT_ALLOWED } from '@/lib/server/scores'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json(METHOD_NOT_ALLOWED)
  res.status(503).json(LEADERBOARD_UNAVAILABLE)
}
