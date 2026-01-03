/**
 * API ENDPOINT: Generate Timeline Article
 *
 * POST /api/articles/generate
 *
 * Generates a new article using AI based on timeline convergence state
 */

import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import {
  generateArticle,
  articleToMDX,
  generateFilename,
  estimateGenerationCost,
  validateArticle,
  type GeneratedArticle,
} from '@/lib/knowledge/ai-article-generator';
import { type TimelineState, calculateConvergence } from '@/lib/knowledge/timeline-convergence';

const ARTICLES_DIR = path.join(process.cwd(), 'pages', 'docs', 'articles');
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

/**
 * Save timeline state
 */
function saveTimelineState(state: TimelineState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Failed to save timeline state:', error);
    throw error;
  }
}

/**
 * Save article to file system
 */
function saveArticle(article: GeneratedArticle): string {
  const filename = generateFilename(article);
  const filepath = path.join(ARTICLES_DIR, filename);
  const mdx = articleToMDX(article);

  try {
    // Ensure directory exists
    if (!fs.existsSync(ARTICLES_DIR)) {
      fs.mkdirSync(ARTICLES_DIR, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filepath, mdx, 'utf-8');
    return filename;
  } catch (error) {
    console.error('Failed to save article:', error);
    throw error;
  }
}

/**
 * Update timeline state after article generation
 */
function updateState(state: TimelineState, article: GeneratedArticle): TimelineState {
  return {
    ...state,
    currentConvergence: calculateConvergence(state),
    lastArticlePublished: {
      ...state.lastArticlePublished,
      [article.timeline]: new Date().toISOString(),
    },
    totalArticlesPublished: state.totalArticlesPublished + 1,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  const validApiKey = process.env.ARTICLE_GENERATION_API_KEY;

  if (!validApiKey) {
    return res.status(500).json({ error: 'Server configuration error: Missing API key' });
  }

  if (apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  try {
    // Load current state
    const state = loadTimelineState();

    // Check if we should generate (optional rate limiting)
    const { dryRun = false } = req.body;

    if (dryRun) {
      // Return cost estimate without generating
      const cost = estimateGenerationCost();
      return res.status(200).json({
        dryRun: true,
        state,
        estimatedCost: cost,
      });
    }

    console.log('Generating article with state:', state);

    // Generate article
    const article = await generateArticle(state);

    // Validate article
    const validation = validateArticle(article);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Generated article failed validation',
        errors: validation.errors,
      });
    }

    // Save article
    const filename = saveArticle(article);

    // Update state
    const newState = updateState(state, article);
    saveTimelineState(newState);

    console.log(`Article generated: ${filename}`);

    // Return success
    return res.status(200).json({
      success: true,
      article: {
        filename,
        title: article.title,
        timeline: article.timeline,
        convergence: article.convergence,
        slug: article.slug,
      },
      state: newState,
    });
  } catch (error) {
    console.error('Article generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate article',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
