import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface ArticleData {
  filename: string;
  title: string;
  date: string;
  author: string[];
  category?: string;
  keywords?: string[];
  length?: number;
}

export interface ArticlesResponse {
  articles: ArticleData[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export default function handler(
  req: NextApiRequest, 
  res: NextApiResponse<ArticlesResponse | ArticleData[]>
) {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);

  // Parse query parameters
  const {
    page,
    perPage,
    search,
    author,
    year,
    sortBy = 'date',
    sortOrder = 'desc',
  } = req.query;

  let articlesData: ArticleData[] = filenames.map((filename) => {
    const filePath = path.join(articleFolderPath, filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(fileContents);

    return {
      filename,
      title: data.title as string,
      date: data.date as string,
      author: data.author as string[],
      category: data.category as string | undefined,
      keywords: data.keywords as string[] | undefined,
      length: content.length,
    };
  });

  // Apply search filter
  if (search && typeof search === 'string') {
    const searchLower = search.toLowerCase();
    articlesData = articlesData.filter(article =>
      article.title.toLowerCase().includes(searchLower) ||
      article.author?.some(a => a.toLowerCase().includes(searchLower)) ||
      article.keywords?.some(k => k.toLowerCase().includes(searchLower))
    );
  }

  // Apply author filter
  if (author && typeof author === 'string') {
    articlesData = articlesData.filter(article =>
      article.author?.includes(author)
    );
  }

  // Apply year filter
  if (year && typeof year === 'string') {
    articlesData = articlesData.filter(article => {
      if (!article.date) return false;
      const articleYear = new Date(article.date).getFullYear().toString();
      return articleYear === year;
    });
  }

  // Apply sorting
  articlesData.sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'author':
        comparison = (a.author?.[0] || '').localeCompare(b.author?.[0] || '');
        break;
      default:
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });

  // If pagination parameters are provided, return paginated response
  if (page && perPage) {
    const pageNum = parseInt(page as string, 10);
    const perPageNum = parseInt(perPage as string, 10);
    const startIndex = (pageNum - 1) * perPageNum;
    const endIndex = startIndex + perPageNum;
    const paginatedArticles = articlesData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(articlesData.length / perPageNum);

    res.status(200).json({
      articles: paginatedArticles,
      total: articlesData.length,
      page: pageNum,
      perPage: perPageNum,
      totalPages,
    });
  } else {
    // Return all articles (backward compatible)
    res.status(200).json(articlesData);
  }
}
