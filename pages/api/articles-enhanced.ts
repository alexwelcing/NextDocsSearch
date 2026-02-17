import { NextApiRequest, NextApiResponse } from 'next';
import articleManifest from '@/lib/generated/article-manifest.json';

// Time Horizon buckets
type TimeHorizon = 'NQ' | 'NY' | 'N5' | 'N20' | 'N50' | 'N100';

// Outcome Polarity scale
type OutcomePolarity = 'C3' | 'C2' | 'C1' | 'N0' | 'P1' | 'P2' | 'P3';

// Article Type - distinguishes fiction/speculative from research/analysis
export type ArticleType = 'fiction' | 'research';

// System Mechanics
type SystemMechanic =
  | 'labor-substitution'
  | 'discovery-compression'
  | 'control-governance'
  | 'epistemic-drift'
  | 'scarcity-inversion'
  | 'security-adversarial'
  | 'biological-convergence'
  | 'market-restructuring'
  | 'agency-multiplication'
  | 'alignment-incentives';

export interface EnhancedArticleData {
  slug: string;
  filename: string;
  title: string;
  date: string;
  author: string[];
  description?: string;
  keywords?: string[];
  ogImage?: string;
  heroImage?: string;
  thumbnail?: string;
  readingTime: number;
  wordCount: number;
  horizon?: TimeHorizon;
  polarity?: OutcomePolarity;
  mechanics?: SystemMechanic[];
  domains?: string[];
  articleType: ArticleType;
}

/**
 * Serves pre-built article metadata from a static JSON manifest.
 * The manifest is generated at build time by scripts/generate-article-manifest.ts,
 * avoiding runtime fs calls that fail on Vercel serverless functions.
 */
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<EnhancedArticleData[] | { error: string }>
) {
  try {
    const articlesData = articleManifest as EnhancedArticleData[];

    // Cache for 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(articlesData);
  } catch (error) {
    console.error('Error serving article manifest:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
}
