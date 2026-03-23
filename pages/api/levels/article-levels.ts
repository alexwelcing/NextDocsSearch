/**
 * API Endpoint for Article-Based Level Generation
 * Returns JSON data for the three themed levels
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { 
  generateCartographerLevel, 
  generateMyceliumLevel, 
  generateTemporalPrisonLevel 
} from '@/lib/rooms/article-levels';
import { GeneratedLevel } from '@/lib/rooms/types';

export interface ArticleLevelsResponse {
  levels: {
    cartographer: GeneratedLevel;
    mycelium: GeneratedLevel;
    temporalPrison: GeneratedLevel;
  };
  generatedAt: string;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArticleLevelsResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Generate all three levels
    const cartographer = generateCartographerLevel();
    const mycelium = generateMyceliumLevel();
    const temporalPrison = generateTemporalPrisonLevel();

    const response: ArticleLevelsResponse = {
      levels: {
        cartographer,
        mycelium,
        temporalPrison
      },
      generatedAt: new Date().toISOString()
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error generating levels:', error);
    res.status(500).json({ error: 'Failed to generate levels' });
  }
}
