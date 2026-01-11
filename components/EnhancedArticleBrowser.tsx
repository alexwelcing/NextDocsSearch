/**
 * Enhanced ArticleBrowser Component
 * 
 * Advanced article browsing adapted for EnhancedArticleData with horizon/polarity/mechanics
 * Integrates with the main branch's article classification system
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

interface ArticleBrowserProps {
  articles: EnhancedArticleData[];
  onArticleSelect?: (article: EnhancedArticleData, index: number) => void;
  itemsPerPage?: number;
}

type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc' | 'horizon' | 'polarity';
type ViewMode = 'grid' | 'list';

const polarityLabels: Record<string, string> = {
  C3: '🔴 Calamity',
  C2: '🟠 Severe Crisis',
  C1: '🟡 Warning',
  N0: '⚪ Neutral',
  P1: '🟢 Positive',
  P2: '🔵 Transformative',
  P3: '🟣 Utopian',
};

const horizonLabels: Record<string, string> = {
  NQ: 'This Quarter',
  NY: 'This Year',
  N5: '5 Years',
  N20: '20 Years',
  N50: '50 Years',
  N100: '100+ Years',
};

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
  const [selectedHorizon, setSelectedHorizon] = useState<string>('');
  const [selectedPolarity, setSelectedPolarity] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');

  // Extract unique values for filtering
  const { authors, horizons, polarities, types } = useMemo(() => {
    const authorSet = new Set<string>();
    const horizonSet = new Set<string>();
    const polaritySet = new Set<string>();
    const typeSet = new Set<string>();
    
    articles.forEach(article => {
      article.author?.forEach(a => authorSet.add(a));
      if (article.horizon) horizonSet.add(article.horizon);
      if (article.polarity) polaritySet.add(article.polarity);
      if (article.articleType) typeSet.add(article.articleType);
    });

    return {
      authors: Array.from(authorSet).sort(),
      horizons: Array.from(horizonSet).sort(),
      polarities: Array.from(polaritySet).sort(),
      types: Array.from(typeSet).sort(),
    };
  }, [articles]);

  // Filter and sort articles
  const filteredAndSortedArticles = useMemo(() => {
    let filtered = [...articles];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.author?.some(a => a.toLowerCase().includes(query)) ||
        article.keywords?.some(k => k.toLowerCase().includes(query)) ||
        article.domains?.some(d => d.toLowerCase().includes(query))
      );
    }

    // Author filter
    if (selectedAuthor) {
      filtered = filtered.filter(article =>
        article.author?.includes(selectedAuthor)
      );
    }

    // Horizon filter
    if (selectedHorizon) {
      filtered = filtered.filter(article =>
        article.horizon === selectedHorizon
      );
    }

    // Polarity filter
    if (selectedPolarity) {
      filtered = filtered.filter(article =>
        article.polarity === selectedPolarity
      );
    }

    // Type filter
    if (selectedType) {
      filtered = filtered.filter(article =>
        article.articleType === selectedType
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'title-desc':
          return b.title.localeCompare(a.title);
        case 'horizon': {
          const horizonOrder = ['NQ', 'NY', 'N5', 'N20', 'N50', 'N100'];
          const aIdx = horizonOrder.indexOf(a.horizon || 'NY');
          const bIdx = horizonOrder.indexOf(b.horizon || 'NY');
          return aIdx - bIdx;
        }
        case 'polarity': {
          const polarityOrder = ['C3', 'C2', 'C1', 'N0', 'P1', 'P2', 'P3'];
          const aIdx = polarityOrder.indexOf(a.polarity || 'N0');
          const bIdx = polarityOrder.indexOf(b.polarity || 'N0');
          return aIdx - bIdx;
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [articles, searchQuery, selectedAuthor, selectedHorizon, selectedPolarity, selectedType, sortBy]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedArticles.length / itemsPerPage);
  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedArticles.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedArticles, currentPage, itemsPerPage]);

  // Reset page when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedAuthor('');
    setSelectedHorizon('');
    setSelectedPolarity('');
    setSelectedType('');
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = searchQuery || selectedAuthor || selectedHorizon || selectedPolarity || selectedType;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      overflow: 'hidden',
    }}>
      {/* Search and Filters */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {/* Search Bar */}
        <input
          type="text"
          placeholder="🔍 Search articles..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); handleFilterChange(); }}
          style={{
            padding: '12px 16px',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '2px solid rgba(68, 136, 255, 0.3)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            fontFamily: 'monospace',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(68, 136, 255, 0.6)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(68, 136, 255, 0.3)'}
        />

        {/* Filter Row */}
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {/* Author Filter */}
          <select
            value={selectedAuthor}
            onChange={(e) => { setSelectedAuthor(e.target.value); handleFilterChange(); }}
            style={{
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            <option value="">All Authors</option>
            {authors.map(author => (
              <option key={author} value={author}>{author}</option>
            ))}
          </select>

          {/* Horizon Filter */}
          <select
            value={selectedHorizon}
            onChange={(e) => { setSelectedHorizon(e.target.value); handleFilterChange(); }}
            style={{
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            <option value="">All Horizons</option>
            {horizons.map(horizon => (
              <option key={horizon} value={horizon}>{horizonLabels[horizon] || horizon}</option>
            ))}
          </select>

          {/* Polarity Filter */}
          <select
            value={selectedPolarity}
            onChange={(e) => { setSelectedPolarity(e.target.value); handleFilterChange(); }}
            style={{
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            <option value="">All Polarities</option>
            {polarities.map(polarity => (
              <option key={polarity} value={polarity}>{polarityLabels[polarity] || polarity}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); handleFilterChange(); }}
            style={{
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            <option value="">All Types</option>
            {types.map(type => (
              <option key={type} value={type}>{type === 'fiction' ? '📖 Fiction' : '📊 Research'}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >
            <option value="date-desc">📅 Newest</option>
            <option value="date-asc">📅 Oldest</option>
            <option value="title-asc">🔤 A-Z</option>
            <option value="title-desc">🔤 Z-A</option>
            <option value="horizon">⏰ By Horizon</option>
            <option value="polarity">🎯 By Polarity</option>
          </select>

          {/* View Mode Toggle */}
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            style={{
              padding: '8px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '6px',
              color: '#ffffff',
              fontSize: '13px',
              fontFamily: 'monospace',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {viewMode === 'grid' ? '☰ List' : '⊞ Grid'}
          </button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                padding: '8px 12px',
                background: 'rgba(255, 68, 68, 0.2)',
                border: '2px solid rgba(255, 68, 68, 0.4)',
                borderRadius: '6px',
                color: '#ff4444',
                fontSize: '13px',
                fontFamily: 'monospace',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Results Count */}
        <div style={{
          color: '#888',
          fontSize: '13px',
          fontFamily: 'monospace',
        }}>
          Showing {paginatedArticles.length} of {filteredAndSortedArticles.length} articles
          {hasActiveFilters && ` (filtered from ${articles.length} total)`}
        </div>
      </div>

      {/* Articles Grid/List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingRight: '8px',
      }}>
        {paginatedArticles.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            fontFamily: 'monospace',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <div style={{ fontSize: '16px' }}>No articles found</div>
            <div style={{ fontSize: '13px', marginTop: '8px' }}>Try adjusting your filters</div>
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {paginatedArticles.map((article, idx) => {
              const globalIndex = (currentPage - 1) * itemsPerPage + idx;
              return (
                <div
                  key={article.slug}
                  onClick={() => onArticleSelect?.(article, globalIndex)}
                  style={{
                    padding: '20px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '2px solid rgba(68, 136, 255, 0.3)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(68, 136, 255, 0.6)';
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(68, 136, 255, 0.3)';
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#00ff88',
                    marginBottom: '12px',
                    lineHeight: '1.4',
                  }}>
                    {article.title}
                  </div>
                  
                  <div style={{
                    fontSize: '12px',
                    color: '#888',
                    marginBottom: '8px',
                  }}>
                    📅 {article.date}
                  </div>

                  <div style={{
                    fontSize: '12px',
                    color: '#4488ff',
                    marginBottom: '12px',
                  }}>
                    ✍️ {article.author?.join(', ')}
                  </div>

                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    marginTop: '12px',
                  }}>
                    {article.horizon && (
                      <span style={{
                        padding: '4px 8px',
                        background: 'rgba(255, 200, 100, 0.2)',
                        border: '1px solid rgba(255, 200, 100, 0.4)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#ffcc66',
                      }}>
                        {horizonLabels[article.horizon]}
                      </span>
                    )}
                    {article.polarity && (
                      <span style={{
                        padding: '4px 8px',
                        background: 'rgba(100, 200, 255, 0.2)',
                        border: '1px solid rgba(100, 200, 255, 0.4)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#66ccff',
                      }}>
                        {polarityLabels[article.polarity]}
                      </span>
                    )}
                    {article.articleType && (
                      <span style={{
                        padding: '4px 8px',
                        background: 'rgba(200, 100, 255, 0.2)',
                        border: '1px solid rgba(200, 100, 255, 0.4)',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#cc66ff',
                      }}>
                        {article.articleType === 'fiction' ? '📖 Fiction' : '📊 Research'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {paginatedArticles.map((article, idx) => {
              const globalIndex = (currentPage - 1) * itemsPerPage + idx;
              return (
                <div
                  key={article.slug}
                  onClick={() => onArticleSelect?.(article, globalIndex)}
                  style={{
                    padding: '16px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '2px solid rgba(68, 136, 255, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(68, 136, 255, 0.6)';
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(68, 136, 255, 0.3)';
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: 'bold',
                      color: '#00ff88',
                      marginBottom: '4px',
                    }}>
                      {article.title}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: '#888',
                    }}>
                      📅 {article.date} • ✍️ {article.author?.join(', ')}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    gap: '6px',
                    flexShrink: 0,
                  }}>
                    {article.horizon && (
                      <span style={{
                        padding: '3px 6px',
                        background: 'rgba(255, 200, 100, 0.2)',
                        border: '1px solid rgba(255, 200, 100, 0.4)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#ffcc66',
                      }}>
                        {horizonLabels[article.horizon]}
                      </span>
                    )}
                    {article.polarity && (
                      <span style={{
                        padding: '3px 6px',
                        background: 'rgba(100, 200, 255, 0.2)',
                        border: '1px solid rgba(100, 200, 255, 0.4)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: '#66ccff',
                      }}>
                        {polarityLabels[article.polarity].split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
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
          paddingTop: '12px',
          borderTop: '1px solid rgba(68, 136, 255, 0.2)',
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              background: currentPage === 1 ? 'rgba(0, 0, 0, 0.2)' : 'rgba(68, 136, 255, 0.2)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '6px',
              color: currentPage === 1 ? '#444' : '#4488ff',
              fontSize: '14px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ← PREV
          </button>

          <div style={{
            color: '#666',
            fontSize: '14px',
            fontFamily: 'monospace',
          }}>
            Page {currentPage} of {totalPages}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 16px',
              background: currentPage === totalPages ? 'rgba(0, 0, 0, 0.2)' : 'rgba(68, 136, 255, 0.2)',
              border: '2px solid rgba(68, 136, 255, 0.3)',
              borderRadius: '6px',
              color: currentPage === totalPages ? '#444' : '#4488ff',
              fontSize: '14px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}
