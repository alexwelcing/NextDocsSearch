import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

interface ArticleData {
  filename: string;
  title: string;
  date: string;
  author: string[];
}

export default function handler(req: NextApiRequest, res: NextApiResponse<ArticleData[]>) {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);

  const articlesData: ArticleData[] = filenames.map((filename) => {
    const filePath = path.join(articleFolderPath, filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(fileContents);

    return {
      filename,
      title: data.title as string,
      date: data.date as string,
      author: data.author as string[]
    };
  });

  // Sort articles by recency
  articlesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.status(200).json(articlesData);
}
