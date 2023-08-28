import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export default function handler(req, res) {
  const articleFolderPath = path.join(process.cwd(), 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);

  const articlesData = filenames.map((filename) => {
    const filePath = path.join(articleFolderPath, filename);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(fileContents);

    return {
      filename,
      title: data.title,
      date: data.date,
      author: data.author,
    };
  });

  // Sort articles by recency
  articlesData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.status(200).json(articlesData);
}
