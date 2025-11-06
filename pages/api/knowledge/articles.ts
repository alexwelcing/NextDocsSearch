/**
 * API: R3F Knowledge Articles
 *
 * Lists and serves generated R3F knowledge base articles
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'pages', 'docs', 'r3f-knowledge');

export type ArticleMetadata = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  category: string;
  tags: string[];
  keywords: string[];
  seo_score: number;
  narrative_type: string;
  setting: string;
  difficulty: string;
};

export type ArticleListResponse = {
  articles: ArticleMetadata[];
  total: number;
  hasKnowledgeBase: boolean;
};

export type ArticleDetailResponse = {
  article: ArticleMetadata;
  content: string;
};

export type ErrorResponse = {
  error: string;
  message: string;
};

/**
 * Get list of all generated articles
 */
function getArticleList(): ArticleMetadata[] {
  // Check if knowledge base directory exists
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    return [];
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR);
  const articles: ArticleMetadata[] = [];

  for (const file of files) {
    // Skip non-MDX files and stats file
    if (!file.endsWith('.mdx') || file.startsWith('_')) {
      continue;
    }

    const filePath = path.join(KNOWLEDGE_DIR, file);
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(fileContents);

    articles.push({
      slug: file.replace('.mdx', ''),
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date || '',
      author: data.author || 'Unknown',
      category: data.category || '',
      tags: data.tags || [],
      keywords: data.keywords || [],
      seo_score: data.seo_score || 0,
      narrative_type: data.narrative_type || '',
      setting: data.setting || '',
      difficulty: data.difficulty || '',
    });
  }

  // Sort by date (newest first)
  articles.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return articles;
}

/**
 * Get single article by slug
 */
function getArticleBySlug(slug: string): { article: ArticleMetadata; content: string } | null {
  const filePath = path.join(KNOWLEDGE_DIR, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileContents = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContents);

  return {
    article: {
      slug,
      title: data.title || 'Untitled',
      description: data.description || '',
      date: data.date || '',
      author: data.author || 'Unknown',
      category: data.category || '',
      tags: data.tags || [],
      keywords: data.keywords || [],
      seo_score: data.seo_score || 0,
      narrative_type: data.narrative_type || '',
      setting: data.setting || '',
      difficulty: data.difficulty || '',
    },
    content,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArticleListResponse | ArticleDetailResponse | ErrorResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only GET requests are allowed',
    });
  }

  try {
    const { slug } = req.query;

    // If slug is provided, return single article
    if (slug && typeof slug === 'string') {
      const result = getArticleBySlug(slug);

      if (!result) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Article with slug "${slug}" not found`,
        });
      }

      return res.status(200).json(result);
    }

    // Otherwise, return list of all articles
    const articles = getArticleList();

    res.status(200).json({
      articles,
      total: articles.length,
      hasKnowledgeBase: articles.length > 0,
    });
  } catch (error) {
    console.error('Knowledge articles API error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve articles',
    });
  }
}
