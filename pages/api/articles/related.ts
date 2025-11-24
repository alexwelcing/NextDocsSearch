import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

interface ArticleData {
  filename: string;
  title: string;
  date: string;
  author: string[];
  category?: string;
  keywords?: string[];
}

interface RelatedArticleResponse {
  article: ArticleData;
  score: number;
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<RelatedArticleResponse[] | { error: string }>
) {
  const { filename, limit = '5' } = req.query;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'filename parameter is required' });
  }

  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  
  // Read the target article
  const targetFilePath = path.join(articleFolderPath, filename);
  
  if (!fs.existsSync(targetFilePath)) {
    return res.status(404).json({ error: 'Article not found' });
  }

  const targetFileContents = fs.readFileSync(targetFilePath, 'utf8');
  const { data: targetData } = matter(targetFileContents);
  
  const targetArticle = {
    filename,
    title: targetData.title as string,
    date: targetData.date as string,
    author: targetData.author as string[],
    category: targetData.category as string | undefined,
    keywords: targetData.keywords as string[] | undefined,
  };

  // Read all other articles
  const filenames = fs.readdirSync(articleFolderPath).filter(f => f !== filename);
  
  const scoredArticles: RelatedArticleResponse[] = filenames.map((fname) => {
    const filePath = path.join(articleFolderPath, fname);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(fileContents);

    const article: ArticleData = {
      filename: fname,
      title: data.title as string,
      date: data.date as string,
      author: data.author as string[],
      category: data.category as string | undefined,
      keywords: data.keywords as string[] | undefined,
    };

    // Calculate relevance score
    let score = 0;

    // Same author(s)
    const sharedAuthors = article.author?.filter(a =>
      targetArticle.author?.includes(a)
    ).length || 0;
    score += sharedAuthors * 3;

    // Shared keywords
    const sharedKeywords = article.keywords?.filter(k =>
      targetArticle.keywords?.includes(k)
    ).length || 0;
    score += sharedKeywords * 2;

    // Same category
    if (article.category && article.category === targetArticle.category) {
      score += 2;
    }

    // Similar date (same year/month)
    if (article.date && targetArticle.date) {
      const articleDate = new Date(article.date);
      const targetDate = new Date(targetArticle.date);
      
      if (articleDate.getFullYear() === targetDate.getFullYear()) {
        score += 1;
        
        if (articleDate.getMonth() === targetDate.getMonth()) {
          score += 1;
        }
      }
    }

    // Title similarity (basic word matching)
    const targetWords = targetArticle.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const articleWords = article.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const sharedWords = targetWords.filter(w => articleWords.includes(w)).length;
    score += sharedWords;

    return { article, score };
  });

  // Sort by score and limit results
  const limitNum = parseInt(limit as string, 10);
  const relatedArticles = scoredArticles
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limitNum);

  res.status(200).json(relatedArticles);
}
