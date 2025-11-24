/**
 * RelatedArticles Component
 * 
 * Shows related articles based on shared topics, keywords, authors, or categories
 */

import React, { useMemo } from 'react';
import type { ArticleData } from './ArticleBrowser';

interface RelatedArticlesProps {
  currentArticle: ArticleData;
  allArticles: ArticleData[];
  maxResults?: number;
  onArticleSelect?: (article: ArticleData, index: number) => void;
}

export default function RelatedArticles({
  currentArticle,
  allArticles,
  maxResults = 5,
  onArticleSelect,
}: RelatedArticlesProps) {
  // Calculate related articles based on multiple criteria
  const relatedArticles = useMemo(() => {
    if (!currentArticle) return [];

    // Score each article based on similarity
    const scored = allArticles
      .map((article, index) => {
        // Don't include the current article
        // Use both filename and title for comparison to handle cases where filename might be undefined
        const isSameArticle = (
          (article.filename && currentArticle.filename && article.filename === currentArticle.filename) ||
          (!article.filename && !currentArticle.filename && article.title === currentArticle.title)
        );
        
        if (isSameArticle) {
          return { article, index, score: -1 };
        }

        let score = 0;

        // Same author(s)
        const sharedAuthors = article.author?.filter(a =>
          currentArticle.author?.includes(a)
        ).length || 0;
        score += sharedAuthors * 3;

        // Shared keywords
        const sharedKeywords = article.keywords?.filter(k =>
          currentArticle.keywords?.includes(k)
        ).length || 0;
        score += sharedKeywords * 2;

        // Same category
        if (article.category && article.category === currentArticle.category) {
          score += 2;
        }

        // Similar date (within same month/year)
        if (article.date && currentArticle.date) {
          const articleDate = new Date(article.date);
          const currentDate = new Date(currentArticle.date);
          
          if (articleDate.getFullYear() === currentDate.getFullYear()) {
            score += 1;
            
            if (articleDate.getMonth() === currentDate.getMonth()) {
              score += 1;
            }
          }
        }

        // Title similarity (basic word matching)
        const currentWords = currentArticle.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const articleWords = article.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const sharedWords = currentWords.filter(w => articleWords.includes(w)).length;
        score += sharedWords;

        return { article, index, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return scored;
  }, [currentArticle, allArticles, maxResults]);

  if (relatedArticles.length === 0) {
    return (
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        border: '2px solid rgba(68, 136, 255, 0.3)',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        color: '#666',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔗</div>
        <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>
          No related articles found
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.3)',
      border: '2px solid rgba(68, 136, 255, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '4px',
      }}>
        <span style={{ fontSize: '20px' }}>🔗</span>
        <h3 style={{
          color: '#4488ff',
          fontSize: '16px',
          fontFamily: 'monospace',
          margin: 0,
        }}>
          Related Articles
        </h3>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {relatedArticles.map(({ article, index, score }) => (
          <RelatedArticleCard
            key={`${article.filename || article.title}-${index}`}
            article={article}
            relevanceScore={score}
            onClick={() => onArticleSelect?.(article, index)}
          />
        ))}
      </div>
    </div>
  );
}

// Related Article Card Component
interface RelatedArticleCardProps {
  article: ArticleData;
  relevanceScore: number;
  onClick: () => void;
}

function RelatedArticleCard({ article, relevanceScore, onClick }: RelatedArticleCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  // Determine relevance level
  const relevanceLevel = relevanceScore >= 8 ? 'high' : relevanceScore >= 4 ? 'medium' : 'low';
  const relevanceColors = {
    high: '#00ff88',
    medium: '#FFD700',
    low: '#888',
  };
  const relevanceLabels = {
    high: 'Highly Related',
    medium: 'Related',
    low: 'Possibly Related',
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        background: isHovered ? 'rgba(68, 136, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
        border: `2px solid ${isHovered ? '#4488ff' : 'rgba(68, 136, 255, 0.2)'}`,
        borderRadius: '8px',
        padding: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        textAlign: 'left',
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          <h4 style={{
            color: isHovered ? '#00ff88' : '#ffffff',
            fontSize: '14px',
            fontFamily: 'monospace',
            margin: 0,
            flex: 1,
            transition: 'color 0.2s ease',
          }}>
            {article.title}
          </h4>

          {/* Relevance Badge */}
          <div style={{
            background: `${relevanceColors[relevanceLevel]}22`,
            border: `1px solid ${relevanceColors[relevanceLevel]}`,
            borderRadius: '4px',
            padding: '2px 6px',
            color: relevanceColors[relevanceLevel],
            fontSize: '10px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
          }}>
            {relevanceLabels[relevanceLevel]}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          fontSize: '11px',
          color: '#888',
          fontFamily: 'monospace',
        }}>
          <span>📅 {article.date}</span>
          {article.author && article.author.length > 0 && (
            <span>✍️ {article.author[0]}</span>
          )}
        </div>
      </div>
    </button>
  );
}
