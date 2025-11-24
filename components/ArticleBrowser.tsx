/**
 * ArticleBrowser Component
 * 
 * Advanced article browsing with pagination, search, filtering, and grid view
 * Replaces the simple prev/next carousel for better scalability with 168+ articles
 */

import React, { useState, useMemo, useCallback } from 'react';

export interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
  category?: string;
  keywords?: string[];
}

interface ArticleBrowserProps {
  articles: ArticleData[];
  onArticleSelect?: (article: ArticleData, index: number) => void;
  itemsPerPage?: number;
}

type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc';
type ViewMode = 'grid' | 'list';

export default function ArticleBrowser({
  articles,
  onArticleSelect,
  itemsPerPage = 12,
}: ArticleBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  // Extract unique authors and years for filtering
  const { authors, years } = useMemo(() => {
    const authorSet = new Set<string>();
    const yearSet = new Set<string>();
    
    articles.forEach(article => {
      article.author?.forEach(a => authorSet.add(a));
      if (article.date) {
        const year = new Date(article.date).getFullYear().toString();
        yearSet.add(year);
      }
    });

    return {
      authors: Array.from(authorSet).sort(),
      years: Array.from(yearSet).sort().reverse(),
    };
  }, [articles]);

  // Filter and sort articles
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.author?.some(a => a.toLowerCase().includes(query)) ||
        article.keywords?.some(k => k.toLowerCase().includes(query))
      );
    }

    // Apply author filter
    if (selectedAuthor) {
      filtered = filtered.filter(article =>
        article.author?.includes(selectedAuthor)
      );
    }

    // Apply year filter
    if (selectedYear) {
      filtered = filtered.filter(article => {
        if (!article.date) return false;
        const year = new Date(article.date).getFullYear().toString();
        return year === selectedYear;
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        default:
          return 0;
      }
    });

    return filtered;
  }, [articles, searchQuery, selectedAuthor, selectedYear, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentArticles = filteredArticles.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    handleFilterChange();
  }, [handleFilterChange]);

  const handleAuthorChange = useCallback((value: string) => {
    setSelectedAuthor(value);
    handleFilterChange();
  }, [handleFilterChange]);

  const handleYearChange = useCallback((value: string) => {
    setSelectedYear(value);
    handleFilterChange();
  }, [handleFilterChange]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedAuthor('');
    setSelectedYear('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = searchQuery || selectedAuthor || selectedYear;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
    }}>
      {/* Search and Filter Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid rgba(68, 136, 255, 0.2)',
      }}>
        {/* Search Input */}
        <input
          type="text"
          placeholder="🔍 Search articles by title, author, or keyword..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '2px solid rgba(68, 136, 255, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#ffffff',
            fontSize: '14px',
            fontFamily: 'monospace',
            outline: 'none',
            width: '100%',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#4488ff';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(68, 136, 255, 0.3)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(68, 136, 255, 0.3)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />

        {/* Filters Row */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* Author Filter */}
          <select
            value={selectedAuthor}
            onChange={(e) => handleAuthorChange(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
              minWidth: '150px',
            }}
          >
            <option value="">All Authors</option>
            {authors.map(author => (
              <option key={author} value={author}>{author}</option>
            ))}
          </select>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
              minWidth: '120px',
            }}
          >
            <option value="">All Years</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
              minWidth: '150px',
            }}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="title-asc">Title A-Z</option>
            <option value="title-desc">Title Z-A</option>
          </select>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'rgba(68, 136, 255, 0.3)' : 'transparent',
                border: '2px solid rgba(68, 136, 255, 0.3)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: viewMode === 'grid' ? '#4488ff' : '#888',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
              title="Grid View"
            >
              ⊞
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'rgba(68, 136, 255, 0.3)' : 'transparent',
                border: '2px solid rgba(68, 136, 255, 0.3)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: viewMode === 'list' ? '#4488ff' : '#888',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
              title="List View"
            >
              ☰
            </button>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                background: 'rgba(255, 68, 68, 0.2)',
                border: '2px solid rgba(255, 68, 68, 0.5)',
                borderRadius: '6px',
                padding: '6px 12px',
                color: '#ff4444',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Results Summary */}
        <div style={{
          color: '#888',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}>
          Showing {currentArticles.length} of {filteredArticles.length} articles
          {hasActiveFilters && ` (filtered from ${articles.length} total)`}
        </div>
      </div>

      {/* Article Grid/List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '4px',
      }}>
        {currentArticles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#666',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '16px' }}>No articles found</div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  marginTop: '16px',
                  background: 'rgba(68, 136, 255, 0.2)',
                  border: '2px solid rgba(68, 136, 255, 0.5)',
                  borderRadius: '8px',
                  padding: '10px 24px',
                  color: '#4488ff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: viewMode === 'grid' ? 'grid' : 'flex',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : undefined,
            flexDirection: viewMode === 'list' ? 'column' : undefined,
            gap: '16px',
          }}>
            {currentArticles.map((article, idx) => {
              const globalIndex = startIndex + idx;
              return (
                <ArticleCard
                  key={`${article.filename || article.title}-${globalIndex}`}
                  article={article}
                  viewMode={viewMode}
                  onClick={() => onArticleSelect?.(article, globalIndex)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          border: '1px solid rgba(68, 136, 255, 0.2)',
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              background: currentPage === 1 ? 'rgba(68, 136, 255, 0.1)' : 'rgba(68, 136, 255, 0.2)',
              border: '2px solid rgba(68, 136, 255, 0.5)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: currentPage === 1 ? '#444' : '#4488ff',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}
          >
            ← PREV
          </button>

          <div style={{
            color: '#888',
            fontSize: '14px',
            fontFamily: 'monospace',
            padding: '0 16px',
          }}>
            Page {currentPage} of {totalPages}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              background: currentPage === totalPages ? 'rgba(68, 136, 255, 0.1)' : 'rgba(68, 136, 255, 0.2)',
              border: '2px solid rgba(68, 136, 255, 0.5)',
              borderRadius: '8px',
              padding: '8px 16px',
              color: currentPage === totalPages ? '#444' : '#4488ff',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}

// Article Card Component
interface ArticleCardProps {
  article: ArticleData;
  viewMode: ViewMode;
  onClick: () => void;
}

function ArticleCard({ article, viewMode, onClick }: ArticleCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const cardStyle = {
    background: isHovered ? 'rgba(68, 136, 255, 0.15)' : 'rgba(0, 0, 0, 0.3)',
    border: `2px solid ${isHovered ? '#4488ff' : 'rgba(68, 136, 255, 0.3)'}`,
    borderRadius: '12px',
    padding: viewMode === 'grid' ? '20px' : '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: viewMode === 'grid' ? 'column' as const : 'row' as const,
    gap: viewMode === 'grid' ? '12px' : '16px',
    alignItems: viewMode === 'list' ? 'center' : 'flex-start',
    boxShadow: isHovered ? '0 4px 20px rgba(68, 136, 255, 0.3)' : 'none',
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ flex: 1 }}>
        <h3 style={{
          color: '#00ff88',
          fontSize: viewMode === 'grid' ? '16px' : '18px',
          marginBottom: '8px',
          fontFamily: 'monospace',
          textShadow: isHovered ? '0 0 10px rgba(0, 255, 136, 0.3)' : 'none',
        }}>
          {article.title}
        </h3>
        
        <div style={{
          display: 'flex',
          gap: '12px',
          fontSize: '12px',
          color: '#888',
          marginBottom: viewMode === 'grid' ? '8px' : '0',
          flexWrap: 'wrap',
        }}>
          <span>📅 {article.date}</span>
          {article.author && article.author.length > 0 && (
            <span>✍️ {article.author.join(', ')}</span>
          )}
        </div>
      </div>

      {viewMode === 'list' && (
        <div style={{
          color: '#4488ff',
          fontSize: '20px',
          opacity: isHovered ? 1 : 0.5,
          transition: 'opacity 0.2s ease',
        }}>
          →
        </div>
      )}
    </div>
  );
}
