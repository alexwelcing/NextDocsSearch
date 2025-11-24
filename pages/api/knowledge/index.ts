/**
 * API: R3F Knowledge Index
 *
 * Endpoints for accessing the R3F knowledge taxonomy and generated articles
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import {
  R3F_KNOWLEDGE_INDEX,
  R3F_CATEGORIES,
  getTopicsByCategory,
  getTopicsByDifficulty,
  getHighSEOTopics,
  searchTopics,
  type R3FTopic,
} from '../../../lib/knowledge/r3f-taxonomy';

export type KnowledgeIndexResponse = {
  topics: R3FTopic[];
  total: number;
  categories: typeof R3F_CATEGORIES;
  query?: {
    category?: string;
    difficulty?: string;
    search?: string;
    minSEO?: number;
  };
};

export type ErrorResponse = {
  error: string;
  message: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KnowledgeIndexResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only GET requests are allowed',
    });
  }

  try {
    const {
      category,
      difficulty,
      search,
      minSEO,
      limit,
    } = req.query;

    let topics = R3F_KNOWLEDGE_INDEX;
    const query: KnowledgeIndexResponse['query'] = {};

    // Filter by search query
    if (search && typeof search === 'string') {
      topics = searchTopics(search);
      query.search = search;
    }

    // Filter by category
    if (category && typeof category === 'string') {
      topics = topics.filter(t => t.category === category);
      query.category = category;
    }

    // Filter by difficulty
    if (difficulty && typeof difficulty === 'string') {
      topics = topics.filter(t => t.difficulty === difficulty);
      query.difficulty = difficulty;
    }

    // Filter by minimum SEO score
    if (minSEO && typeof minSEO === 'string') {
      const minScore = parseInt(minSEO, 10);
      topics = topics.filter(t => t.seoValue >= minScore);
      query.minSEO = minScore;
    }

    // Apply limit if specified
    if (limit && typeof limit === 'string') {
      const limitNum = parseInt(limit, 10);
      topics = topics.slice(0, limitNum);
    }

    res.status(200).json({
      topics,
      total: topics.length,
      categories: R3F_CATEGORIES,
      query: Object.keys(query).length > 0 ? query : undefined,
    });
  } catch (error) {
    console.error('Knowledge index API error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve knowledge index',
    });
  }
}
