/**
 * API: Get Queue Status
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getACCFilmClient } from '../../../lib/film-bridge/acc-integration';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const acc = getACCFilmClient();
    const status = await acc.getFilmQueueStatus();

    res.status(200).json({
      pending: status.pending,
      inProgress: status.inProgress,
      completed: 0,  // TODO: Track completed
      failed: 0,     // TODO: Track failed
      byCategory: status.byCategory,
    });
  } catch (error) {
    // Return empty status if ACC not available
    res.status(200).json({
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      byCategory: {},
    });
  }
}
