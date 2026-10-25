// Ship on the Node target: a thin adapter over the shared handler (lib/ship/handleShip.ts). The
// Cloudflare Worker serves the same handler with Workers AI; until DNS cutover this route answers
// on Vercel with the Hugging Face provider (when HF_TOKEN is set) or the extractive archive answer.
import type { NextApiRequest, NextApiResponse } from 'next'
import { handleShip } from '@/lib/ship/handleShip'
import { nodeShipDeps, sendWebResponse, toWebRequest } from '@/lib/ship/node'

// The handler reads and validates the raw body itself, identically on both targets.
export const config = { api: { bodyParser: false } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let request: Request
  try {
    request = await toWebRequest(req)
  } catch {
    res.status(400).json({ error: 'Unreadable request body' })
    return
  }
  await sendWebResponse(await handleShip(request, nodeShipDeps()), res)
}
