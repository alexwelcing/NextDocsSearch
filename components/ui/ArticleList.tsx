import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

type ArticleData = {
  filename: string;
  title: string;
  date: string;
  author: string[];
};

const ArticleList: React.FC = () => {
  const [articles, setArticles] = useState<ArticleData[]>([]);

  useEffect(() => {
    fetch('/api/articles')
      .then((res) => res.json())
      .then((data) => setArticles(data));
  }, []);


  return (
    <div className="article-list">
      <h2>Latest Articles</h2>
      <ul>
        {articles.map((article, index) => (
          <li key={index}>
            <Link href={`/articles/${article.filename.replace('.mdx', '')}`}>
              <a>
                {article.title} - {article.date} by {article.author.join(", ")}
              </a>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ArticleList;
