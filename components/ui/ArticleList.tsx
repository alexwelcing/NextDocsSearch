import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '@/styles/ArticleList.module.css'; // Importing custom styles

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
    <div className={styles.articleList}>
      <h2 className={styles.articleTitle}>Latest Articles</h2>
      <ul className={styles.articleUl}>
        {articles.map((article, index) => (
          <li key={index} className={styles.articleLi}>
            <Link href={`/articles/${article.filename.replace('.mdx', '')}`}>
                <span className="material-icons-outlined align-middle mr-2">article</span>
                {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ArticleList;
