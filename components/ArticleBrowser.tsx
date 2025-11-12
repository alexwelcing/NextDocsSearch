import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
}

interface ArticleBrowserProps {
  articles: ArticleData[];
  onSelectArticle?: (article: ArticleData) => void;
}

export default function ArticleBrowser({ articles, onSelectArticle }: ArticleBrowserProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [articleContent, setArticleContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);

  const itemsPerPage = 7;
  const visibleArticles = articles.slice(scrollOffset, scrollOffset + itemsPerPage);

  useEffect(() => {
    // Load article content when selected
    if (selectedIndex !== null && articles[selectedIndex]?.filename) {
      setLoadingContent(true);
      const filename = articles[selectedIndex].filename;

      fetch(`/docs/articles/${filename}`)
        .then(res => res.text())
        .then(content => {
          // Remove frontmatter
          const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
          setArticleContent(contentWithoutFrontmatter);
          setLoadingContent(false);
        })
        .catch(err => {
          console.error('Failed to load article:', err);
          setArticleContent('Failed to load article content.');
          setLoadingContent(false);
        });
    }
  }, [selectedIndex, articles]);

  const handleScroll = (direction: 'up' | 'down') => {
    if (direction === 'up' && scrollOffset > 0) {
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (direction === 'down' && scrollOffset + itemsPerPage < articles.length) {
      setScrollOffset(prev => Math.min(articles.length - itemsPerPage, prev + 1));
    }
  };

  const handleSelectArticle = (index: number) => {
    const absoluteIndex = scrollOffset + index;
    setSelectedIndex(absoluteIndex);
    onSelectArticle?.(articles[absoluteIndex]);
  };

  const handleBack = () => {
    setSelectedIndex(null);
    setArticleContent('');
  };

  // If article is selected, show article content
  if (selectedIndex !== null) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #0a0a1a 0%, #0f0f1f 100%)',
        border: '3px solid #4488ff',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Segoe UI", Arial, sans-serif',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: '#000011',
          borderBottom: '2px solid #4488ff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={handleBack}
            style={{
              background: 'transparent',
              border: '1px solid #4488ff',
              color: '#4488ff',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          >
            ← BACK TO LIST
          </button>
          <div style={{ color: '#4488ff', fontSize: '12px', fontFamily: 'monospace' }}>
            ARTICLE {selectedIndex + 1} / {articles.length}
          </div>
        </div>

        {/* Article content */}
        <div style={{
          flex: 1,
          padding: '30px',
          overflowY: 'auto',
          color: '#e0e0e0',
          fontSize: '14px',
          lineHeight: '1.8',
        }}>
          {loadingContent ? (
            <div style={{ color: '#4488ff', textAlign: 'center', marginTop: '40px' }}>
              Loading article...
            </div>
          ) : (
            <div className="markdown-content">
              <h1 style={{ color: '#4488ff', marginBottom: '10px', fontSize: '28px' }}>
                {articles[selectedIndex].title}
              </h1>
              <div style={{
                color: '#888',
                fontSize: '12px',
                marginBottom: '30px',
                fontFamily: 'monospace',
              }}>
                📅 {articles[selectedIndex].date} • ✍️ {articles[selectedIndex].author.join(', ')}
              </div>
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 style={{ color: '#4488ff', marginTop: '30px', marginBottom: '16px' }} {...props} />,
                  h2: ({ node, ...props }) => <h2 style={{ color: '#66aaff', marginTop: '24px', marginBottom: '12px' }} {...props} />,
                  h3: ({ node, ...props }) => <h3 style={{ color: '#88ccff', marginTop: '20px', marginBottom: '10px' }} {...props} />,
                  p: ({ node, ...props }) => <p style={{ marginBottom: '16px' }} {...props} />,
                  code: ({ node, className, children, ...props }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code style={{
                        background: 'rgba(68, 136, 255, 0.2)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        color: '#88ccff',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                      }} {...props}>{children}</code>
                    ) : (
                      <code style={{
                        display: 'block',
                        background: 'rgba(68, 136, 255, 0.1)',
                        padding: '16px',
                        borderRadius: '6px',
                        borderLeft: '3px solid #4488ff',
                        color: '#88ccff',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        overflowX: 'auto',
                        marginBottom: '16px',
                      }} {...props}>{children}</code>
                    );
                  },
                  a: ({ node, ...props }) => <a style={{ color: '#4488ff', textDecoration: 'underline' }} {...props} />,
                  ul: ({ node, ...props }) => <ul style={{ marginLeft: '20px', marginBottom: '16px' }} {...props} />,
                  ol: ({ node, ...props }) => <ol style={{ marginLeft: '20px', marginBottom: '16px' }} {...props} />,
                  li: ({ node, ...props }) => <li style={{ marginBottom: '8px' }} {...props} />,
                }}
              >
                {articleContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Otherwise show article list
  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #0f0f1f 100%)',
      border: '3px solid #4488ff',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: '#000011',
        borderBottom: '2px solid #4488ff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#4488ff',
            boxShadow: '0 0 10px #4488ff',
          }} />
          <span style={{ color: '#4488ff', fontSize: '14px', fontWeight: 'bold', letterSpacing: '2px' }}>
            ARTICLE DATABASE
          </span>
        </div>
        <div style={{
          color: '#6688aa',
          fontSize: '12px',
        }}>
          {articles.length} ENTRIES
        </div>
      </div>

      {/* Scroll up button */}
      <button
        onClick={() => handleScroll('up')}
        disabled={scrollOffset === 0}
        style={{
          padding: '8px',
          background: scrollOffset === 0 ? '#111122' : '#1a1a3a',
          border: 'none',
          borderBottom: '1px solid #4488ff',
          color: scrollOffset === 0 ? '#444' : '#4488ff',
          cursor: scrollOffset === 0 ? 'not-allowed' : 'pointer',
          fontSize: '14px',
        }}
      >
        ▲ SCROLL UP
      </button>

      {/* Article list */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {visibleArticles.map((article, index) => {
          const absoluteIndex = scrollOffset + index;
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={absoluteIndex}
              onClick={() => handleSelectArticle(index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(68, 136, 255, 0.3)',
                background: isHovered ? 'rgba(68, 136, 255, 0.1)' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Title with scrolling effect on hover */}
              <div style={{
                fontSize: '14px',
                color: '#4488ff',
                fontWeight: 'bold',
                marginBottom: '6px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                animation: isHovered && article.title.length > 50 ? 'scroll-text 8s linear infinite' : 'none',
              }}>
                {article.title}
              </div>

              {/* Date and author */}
              <div style={{
                fontSize: '11px',
                color: '#6688aa',
                display: 'flex',
                gap: '16px',
              }}>
                <span>📅 {article.date}</span>
                <span>✍️ {article.author.join(', ')}</span>
              </div>

              {/* Entry number */}
              <div style={{
                position: 'absolute',
                right: '20px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#334455',
                fontSize: '20px',
                fontWeight: 'bold',
              }}>
                #{absoluteIndex + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll down button */}
      <button
        onClick={() => handleScroll('down')}
        disabled={scrollOffset + itemsPerPage >= articles.length}
        style={{
          padding: '8px',
          background: scrollOffset + itemsPerPage >= articles.length ? '#111122' : '#1a1a3a',
          border: 'none',
          borderTop: '1px solid #4488ff',
          color: scrollOffset + itemsPerPage >= articles.length ? '#444' : '#4488ff',
          cursor: scrollOffset + itemsPerPage >= articles.length ? 'not-allowed' : 'pointer',
          fontSize: '14px',
        }}
      >
        ▼ SCROLL DOWN
      </button>

      {/* Position indicator */}
      <div style={{
        padding: '8px 20px',
        background: '#000011',
        borderTop: '2px solid #4488ff',
        color: '#6688aa',
        fontSize: '11px',
        textAlign: 'center',
      }}>
        VIEWING {scrollOffset + 1} - {Math.min(scrollOffset + itemsPerPage, articles.length)} OF {articles.length}
      </div>

      <style>{`
        @keyframes scroll-text {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        /* Custom scrollbar */
        div::-webkit-scrollbar {
          width: 8px;
        }

        div::-webkit-scrollbar-track {
          background: #000011;
        }

        div::-webkit-scrollbar-thumb {
          background: #4488ff;
          border-radius: 4px;
        }

        div::-webkit-scrollbar-thumb:hover {
          background: #6688ff;
        }

        .markdown-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 20px 0;
        }

        .markdown-content blockquote {
          border-left: 4px solid #4488ff;
          padding-left: 20px;
          margin: 20px 0;
          color: #aaa;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
