import { NextApiRequest, NextApiResponse } from 'next';
import recommendationIndex from '@/lib/generated/recommendation-index.json';

interface ScoredRecommendation {
  slug: string;
  score: number;
}

interface ArticleRecommendations {
  similar: ScoredRecommendation[];
  horizon: ScoredRecommendation[];
  polarity: ScoredRecommendation[];
  mechanics: ScoredRecommendation[];
  trending: ScoredRecommendation[];
}

type RecommendationIndex = Record<string, ArticleRecommendations>;

/**
 * Serves precomputed article recommendations from the build-time index.
 *
 * GET /api/articles/recommendations?slug=my-article
 *   → returns per-category ranked recommendations for that article
 *
 * GET /api/articles/recommendations
 *   → returns global fallback recommendations (no article context)
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArticleRecommendations | { error: string }>
) {
  try {
    const index = recommendationIndex as unknown as RecommendationIndex;
    const slug = typeof req.query.slug === 'string' ? req.query.slug : null;
    const key = slug && index[slug] ? slug : '__global__';
    const recommendations = index[key];

    if (!recommendations) {
      res.status(404).json({ error: 'No recommendations found' });
      return;
    }

    // Cache for 10 minutes — data only changes on redeploy
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    res.status(200).json(recommendations);
  } catch (error) {
    console.error('Error serving recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
}
