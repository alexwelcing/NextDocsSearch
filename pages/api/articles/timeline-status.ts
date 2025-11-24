/**
 * API ENDPOINT: Timeline Status
 * 
 * GET /api/articles/timeline-status
 * 
 * Returns current timeline convergence status and statistics
 */

import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import {
  type TimelineState,
  calculateConvergence,
  getNextConvergencePoint,
  generateConvergenceNarrative,
  CONVERGENCE_POINTS,
} from '@/lib/knowledge/timeline-convergence';

const STATE_FILE = path.join(process.cwd(), '.timeline-state.json');

/**
 * Load current timeline state
 */
function loadTimelineState(): TimelineState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load timeline state:', error);
  }

  // Default state
  return {
    currentConvergence: 0,
    lastArticlePublished: {},
    nextConvergencePoint: null,
    totalArticlesPublished: 0,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const state = loadTimelineState();
    const convergence = calculateConvergence(state);
    const nextPoint = getNextConvergencePoint();
    const narrative = generateConvergenceNarrative(convergence, nextPoint);

    // Calculate statistics
    const totalPoints = CONVERGENCE_POINTS.length;
    const passedPoints = CONVERGENCE_POINTS.filter(
      (point) => new Date(point.date) < new Date()
    ).length;

    return res.status(200).json({
      convergence: {
        current: convergence,
        percentage: `${convergence.toFixed(1)}%`,
        status:
          convergence < 30
            ? 'distant'
            : convergence < 60
              ? 'approaching'
              : convergence < 90
                ? 'imminent'
                : 'complete',
      },
      narrative,
      nextConvergencePoint: nextPoint
        ? {
            technology: nextPoint.technology,
            date: nextPoint.date,
            presentEvent: nextPoint.presentEvent,
            futureEvent: nextPoint.futureEvent,
            significance: nextPoint.significance,
          }
        : null,
      statistics: {
        totalArticlesPublished: state.totalArticlesPublished,
        lastPublished: state.lastArticlePublished,
        convergencePointsPassed: passedPoints,
        convergencePointsTotal: totalPoints,
        convergencePointsRemaining: totalPoints - passedPoints,
      },
      timeline: {
        present: {
          status: 'active',
          lastArticle: state.lastArticlePublished.present || null,
        },
        future: {
          status: 'active',
          lastArticle: state.lastArticlePublished.future || null,
        },
      },
    });
  } catch (error) {
    console.error('Timeline status error:', error);
    return res.status(500).json({
      error: 'Failed to fetch timeline status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
