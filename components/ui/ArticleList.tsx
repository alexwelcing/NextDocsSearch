import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '@/styles/ArticleList.module.css'; // Importing custom styles

type ArticleData = {
  filename: string;
  title: string;
  date: string;
  author: string[];
};

interface ArticleListProps {
  limit?: number;
  showTitle?: boolean;
  className?: string;
}

const ArticleList: React.FC<ArticleListProps> = ({ limit, showTitle = true, className }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);

  useEffect(() => {
    fetch('/api/articles')
      .then((res) => res.json())
      .then((data) => {
        // Sort by date if available, otherwise assume API returns sorted
        // For now just taking the data
        setArticles(data);
      });
  }, []);

  const displayArticles = limit ? articles.slice(0, limit) : articles;

  return (
    <div className={`${styles.articleList} ${className || ''}`}>
      {showTitle && <h2 className={styles.articleTitle}>Latest Articles</h2>}
      <ul className={styles.articleUl}>
        {displayArticles.map((article, index) => (
          <li key={index} className={styles.articleLi}>
            <Link href={`/articles/${article.filename.replace('.mdx', '')}`} className={styles.articleLink}>
                <span>{article.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ArticleList;
