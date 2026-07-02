/**
 * API: Stop ComfyUI Service
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getComfyService } from '../../../lib/film-bridge/service/comfy-service';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const service = getComfyService();
    
    if (!service.isRunning()) {
      return res.status(400).json({ error: 'ComfyUI is not running' });
    }

    await service.stop();

    res.status(200).json({ 
      message: 'ComfyUI stopped',
      status: 'stopped'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to stop ComfyUI',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
