/**
 * API: Start ComfyUI Service
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
    
    if (service.isRunning()) {
      return res.status(400).json({ error: 'ComfyUI is already running' });
    }

    // Start asynchronously - don't wait for full startup
    service.start().catch((error) => {
      console.error('Failed to start ComfyUI:', error);
    });

    res.status(200).json({ 
      message: 'ComfyUI startup initiated',
      status: 'starting'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to start ComfyUI',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
