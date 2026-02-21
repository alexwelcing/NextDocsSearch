import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '@/styles/CircleNav.module.css';

type ArticleData = {
  filename: string;
  title: string;
  date: string;
  author: string[];
};

interface CircleNavProps {
  isGamePlaying?: boolean;
}

const RECENT_ARTICLE_COUNT = 3;

const CircleNav: React.FC<CircleNavProps> = ({ isGamePlaying = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [articles, setArticles] = useState<ArticleData[]>([]);

  useEffect(() => {
    fetch('/api/articles')
      .then(response => response.json())
      .then(data => setArticles(data));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const recentArticles = articles.slice(0, RECENT_ARTICLE_COUNT);

  return (
    <div
      className={styles.container}
      style={isGamePlaying ? { transform: 'scale(0.5)', opacity: 0.5 } : {}}
    >
      {isOpen ? (
        <div className={styles.menu}>
          <button onClick={() => setIsOpen(false)} className={styles.closeBtn} aria-label="Close navigation menu">
            ×
          </button>
          <Link className={styles.menuLink} href="/">
            Home
          </Link>
          <Link className={styles.menuLink} href="/chat">
            Explore
          </Link>
          <Link className={styles.menuLink} href="/about">
            About
          </Link>
          <div className={styles.articleSection}>
            <span className={styles.sectionLabel}>Recent Articles</span>
            {recentArticles.map((article) => (
              <Link
                key={article.filename}
                className={styles.menuLink}
                href={`/articles/${article.filename.replace('.mdx', '')}`}
              >
                {article.title}
              </Link>
            ))}
            <Link className={styles.viewAllLink} href="/articles">
              View all articles →
            </Link>
          </div>
        </div>
      ) : (
        <button className={styles.circle} onClick={() => setIsOpen(true)} aria-label="Open navigation menu">
          <span className="material-icons-outlined">explore</span>
        </button>
      )}
    </div>
  );
}

export default CircleNav;
