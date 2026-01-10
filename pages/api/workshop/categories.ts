/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WORKSHOP API - CATEGORIES ENDPOINT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Returns the mind map category structure with resource counts.
 *
 * GET /api/workshop/categories
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import type { WorkshopAPIResponse, CategoryTreeResponse } from '@/types/workshop';
import { WORKSHOP_MIND_MAP } from '@/lib/workshop/mindmap-data';
import { SEED_RESOURCE_COUNTS } from '@/lib/workshop/seed-data';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<WorkshopAPIResponse<CategoryTreeResponse>>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${req.method} Not Allowed`,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

    return res.status(200).json({
      success: true,
      data: {
        mindMap: WORKSHOP_MIND_MAP,
        resourceCounts: SEED_RESOURCE_COUNTS,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Categories API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
