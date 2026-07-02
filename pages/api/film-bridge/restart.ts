/**
 * API: Restart ComfyUI Service
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
    
    // Restart asynchronously
    service.restart().catch((error) => {
      console.error('Failed to restart ComfyUI:', error);
    });

    res.status(200).json({ 
      message: 'ComfyUI restart initiated',
      status: 'restarting'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to restart ComfyUI',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}
