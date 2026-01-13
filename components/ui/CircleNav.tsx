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

const CircleNav: React.FC<CircleNavProps> = ({ isGamePlaying = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [articles, setArticles] = useState<ArticleData[]>([]);

  useEffect(() => {
    fetch('/api/articles')
      .then(response => response.json())
      .then(data => setArticles(data));
  }, []);

  return (
    <div
      className={styles.container}
      style={isGamePlaying ? { transform: 'scale(0.5)', opacity: 0.5 } : {}}
    >
      {isOpen ? (
        <div className={styles.menu}>
          <button onClick={() => setIsOpen(false)} className={styles.closeBtn}>
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
          <Link className={styles.menuLink} href="/character-studio">
            Character Studio
          </Link>
          <Link className={styles.menuLink} href="/story-studio">
            Story Studio
          </Link>
          <button
            className={styles.menuLink}
            onClick={() => setShelfOpen(!shelfOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
          >
            Articles {shelfOpen ? '▲' : '▼'}
          </button>
          {shelfOpen && articles.map((article) => (
            <Link
              key={article.filename}
              className={styles.menuLink}
              href={`/articles/${article.filename.replace('.mdx', '')}`}
            >
              <div style={{ maxWidth: '80%' }}>
                {article.title.length > 30 ? article.title.slice(0, 30) + '..' : article.title}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={isOpen ? styles.menu : styles.circle} onClick={() => setIsOpen(!isOpen)}>
          {!isOpen && <span className="material-icons-outlined">explore</span>}
        </div>
      )}
    </div>
  )
}

export default CircleNav;
