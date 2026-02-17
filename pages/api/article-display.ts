import { NextApiRequest, NextApiResponse } from 'next';
import manifest from '@/lib/generated/article-manifest.json';

/**
 * Purpose-built API for the 3D Article Display Panel.
 * Returns a curated list of articles with only the fields the panel needs.
 * Data comes from the pre-built article manifest (generated at build time).
 */

interface ArticleDisplay {
  slug: string;
  title: string;
  date: string;
  description: string;
  articleType: string;
  readingTime: number;
  image: string | null;
  horizon: string | null;
  polarity: string | null;
}

export type { ArticleDisplay };

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<{ count: number; articles: ArticleDisplay[] } | { error: string }>
) {
  try {
    // Resolve the manifest — handle both direct array and default-wrapped module
    const source: unknown[] = Array.isArray(manifest)
      ? manifest
      : Array.isArray((manifest as Record<string, unknown>).default)
        ? (manifest as Record<string, unknown>).default as unknown[]
        : [];

    // Transform each article into the display shape
    const articles: ArticleDisplay[] = source.map((raw: unknown) => {
      const a = raw as Record<string, unknown>;
      return {
        slug: String(a.slug || ''),
        title: String(a.title || ''),
        date: String(a.date || ''),
        description: String(a.description || ''),
        articleType: String(a.articleType || 'unknown'),
        readingTime: Number(a.readingTime) || 0,
        image: String(a.heroImage || a.ogImage || a.thumbnail || '') || null,
        horizon: a.horizon ? String(a.horizon) : null,
        polarity: a.polarity ? String(a.polarity) : null,
      };
    }).filter(a => a.slug && a.title); // Only include articles with valid slug + title

    // No caching — avoid stale data issues
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ count: articles.length, articles });
  } catch (error) {
    console.error('[article-display] Error:', error);
    res.status(500).json({ error: String(error) });
  }
}
