/**
 * Cached article metadata loader
 * 
 * Builds an in-memory cache of all article metadata during static generation
 * to avoid reading the same files thousands of times.
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { discoverArticleImages } from '../article-images';

export interface ArticleSummary {
  slug: string;
  title: string;
  description?: string;
  date: string;
  ogImage?: string;
  heroImage: string | null;
}

// Global cache that persists during the build process
let articleCache: ArticleSummary[] | null = null;

/**
 * Load all article metadata into cache
 * This should be called once during build, then reused
 */
export function loadArticleCache(): ArticleSummary[] {
  if (articleCache) {
    return articleCache;
  }

  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);
  
  articleCache = filenames
    .filter(filename => filename.endsWith('.mdx'))
    .map(filename => {
      const filePath = path.join(articleFolderPath, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContents);
      const slug = filename.replace('.mdx', '');
      const images = discoverArticleImages(slug);
      
      return {
        slug,
        title: data.title || slug,
        description: data.description,
        date: data.date instanceof Date ? data.date.toISOString() : (data.date || ''),
        ogImage: data.ogImage || images.ogImage || undefined,
        heroImage: images.heroImage,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return articleCache;
}

/**
 * Get all articles (uses cache)
 */
export function getAllArticles(): ArticleSummary[] {
  return loadArticleCache();
}

/**
 * Get related articles for a given slug
 * Much faster than re-reading all files
 */
export function getRelatedArticles(
  currentSlug: string, 
  limit = 3
): Array<{ slug: string; title: string; description: string; ogImage?: string; heroImage: string | null }> {
  const allArticles = loadArticleCache();
  
  return allArticles
    .filter(article => article.slug !== currentSlug)
    .slice(0, limit)
    .map(article => ({
      slug: article.slug,
      title: article.title,
      description: article.description || `Read more about ${article.title}`,
      ogImage: article.ogImage,
      heroImage: article.heroImage,
    }));
}

/**
 * Get single article metadata
 */
export function getArticleMeta(slug: string): ArticleSummary | undefined {
  const allArticles = loadArticleCache();
  return allArticles.find(a => a.slug === slug);
}

/**
 * Clear cache (useful for testing)
 */
export function clearArticleCache(): void {
  articleCache = null;
}
