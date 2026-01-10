import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from '@/styles/EnhancedNav.module.css';

type ArticleData = {
  filename: string;
  title: string;
  date: string;
  author: string[];
};

interface EnhancedNavProps {
  isGamePlaying?: boolean;
  limit?: number;
}

const EnhancedNav: React.FC<EnhancedNavProps> = ({ isGamePlaying = false, limit = 3 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [articles, setArticles] = useState<ArticleData[]>([]);

  useEffect(() => {
    fetch('/api/articles')
      .then((res) => res.json())
      .then((data) => setArticles(data))
      .catch((err) => console.error('Failed to fetch articles:', err));
  }, []);

  const displayArticles = limit ? articles.slice(0, limit) : articles;

  const navItems = [
    { href: '/', label: 'Home' },
    { href: '/chat', label: 'Explore' },
    { href: '/about', label: 'About' },
    { href: '/character-studio', label: 'Character Studio' },
    { href: '/story-studio', label: 'Story Studio' },
  ];

  if (isGamePlaying) {
    return null;
  }

  return (
    <div className={styles.container}>
      {!isExpanded ? (
        <button
          className={styles.compactButton}
          onClick={() => setIsExpanded(true)}
          aria-label="Open navigation"
        >
          <span className={styles.buttonText}>NAVIGATE</span>
          <span className={styles.arrow}>→</span>
        </button>
      ) : (
        <div className={styles.expandedPanel}>
          <div className={styles.header}>
            <h3 className={styles.title}>Navigation</h3>
            <button
              className={styles.closeButton}
              onClick={() => setIsExpanded(false)}
              aria-label="Close navigation"
            >
              ×
            </button>
          </div>

          <div className={styles.content}>
            {/* Main Navigation */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Menu</h4>
              <nav className={styles.navList}>
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={styles.navLink}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Recent Articles */}
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>Recent Work</h4>
                <Link href="/articles" className={styles.viewAll}>
                  View All →
                </Link>
              </div>
              <div className={styles.articleList}>
                {displayArticles.map((article) => (
                  <Link
                    key={article.filename}
                    href={`/articles/${article.filename.replace('.mdx', '')}`}
                    className={styles.articleLink}
                  >
                    <span className={styles.articleTitle}>{article.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedNav;
