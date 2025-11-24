/**
 * API ENDPOINT: Auto-Publish Articles
 * 
 * GET /api/articles/auto-publish
 * 
 * Vercel Cron Job endpoint - runs every hour to generate and publish
 * one article based on timeline convergence
 */

import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify this is a Vercel Cron request
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Auto-publish cron job triggered at:', new Date().toISOString());

    // Call the generate endpoint internally
    const apiKey = process.env.ARTICLE_GENERATION_API_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/articles/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ dryRun: false }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Article generation failed:', error);
      return res.status(500).json({
        error: 'Failed to generate article',
        details: error,
      });
    }

    const result = await response.json();
    console.log('Article published successfully:', result.article);

    return res.status(200).json({
      success: true,
      message: 'Article published successfully',
      article: result.article,
      convergence: result.state.currentConvergence,
      totalArticles: result.state.totalArticlesPublished,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Auto-publish error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
