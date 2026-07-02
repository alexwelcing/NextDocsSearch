/**
 * API: Get ComfyUI Service Status
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getComfyService } from '../../../lib/film-bridge/service/comfy-service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const service = getComfyService();
    const health = service.getHealth();

    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get status',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
