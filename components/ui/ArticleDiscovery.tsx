import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

type ViewMode = 'grid' | 'list' | 'timeline';
type SortOption = 'date' | 'horizon' | 'polarity' | 'title';

interface ArticleDiscoveryProps {
  initialArticles?: EnhancedArticleData[];
}

const horizonLabels: Record<string, string> = {
  NQ: 'Now',
  NY: '1Y',
  N5: '5Y',
  N20: '20Y',
  N50: '50Y',
  N100: '100Y',
};

const polarityLabels: Record<string, string> = {
  C3: 'Calamity',
  C2: 'Severe',
  C1: 'Negative',
  N0: 'Neutral',
  P1: 'Positive',
  P2: 'Transform',
  P3: 'Utopian',
};

export default function ArticleDiscovery({ initialArticles }: ArticleDiscoveryProps) {
  const [articles, setArticles] = useState<EnhancedArticleData[]>(initialArticles || []);
  const [loading, setLoading] = useState(!initialArticles);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [horizonFilter, setHorizonFilter] = useState<string>('all');
  const [polarityFilter, setPolarityFilter] = useState<string>('all');
  const [mechanicFilter, setMechanicFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  useEffect(() => {
    if (!initialArticles) {
      fetch('/api/articles-enhanced')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setArticles(data);
          }
        })
        .catch(err => {
          console.error('Failed to fetch articles:', err);
          setError('Failed to load articles');
        })
        .finally(() => setLoading(false));
    }
  }, [initialArticles]);

  const filteredArticles = useMemo(() => {
    let result = [...articles];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.description?.toLowerCase().includes(query) ||
        article.keywords?.some(k => k.toLowerCase().includes(query))
      );
    }

    if (horizonFilter !== 'all') {
      result = result.filter(article => article.horizon === horizonFilter);
    }

    if (polarityFilter !== 'all') {
      result = result.filter(article => article.polarity === polarityFilter);
    }

    if (mechanicFilter !== 'all') {
      result = result.filter(article => article.mechanics?.includes(mechanicFilter as any));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
        case 'horizon':
          const horizonOrder = ['NQ', 'NY', 'N5', 'N20', 'N50', 'N100'];
          return horizonOrder.indexOf(a.horizon || 'N100') - horizonOrder.indexOf(b.horizon || 'N100');
        case 'polarity':
          const polarityOrder = ['C3', 'C2', 'C1', 'N0', 'P1', 'P2', 'P3'];
          return polarityOrder.indexOf(a.polarity || 'N0') - polarityOrder.indexOf(b.polarity || 'N0');
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [articles, searchQuery, horizonFilter, polarityFilter, mechanicFilter, sortBy]);

  const groupedByYear = useMemo(() => {
    const groups: Record<string, EnhancedArticleData[]> = {};
    filteredArticles.forEach(article => {
      const year = article.date ? new Date(article.date).getFullYear().toString() : 'Unknown';
      if (!groups[year]) groups[year] = [];
      groups[year].push(article);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredArticles]);

  const hasActiveFilters = horizonFilter !== 'all' || polarityFilter !== 'all' || mechanicFilter !== 'all' || searchQuery;

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setHorizonFilter('all');
    setPolarityFilter('all');
    setMechanicFilter('all');
  }, []);

  if (loading) {
    return (
      <div style={{
        padding: '60px 20px',
        textAlign: 'center',
        fontFamily: 'monospace',
        color: '#666',
      }}>
        Loading articles...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '60px 20px',
        textAlign: 'center',
        fontFamily: 'monospace',
        color: '#f66',
      }}>
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: '#111',
            border: '1px solid #333',
            color: '#fff',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Filters Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '24px',
        alignItems: 'flex-end',
      }}>
        <FilterSelect
          label="Horizon"
          value={horizonFilter}
          onChange={setHorizonFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'NQ', label: 'Now' },
            { value: 'NY', label: '1 Year' },
            { value: 'N5', label: '5 Years' },
            { value: 'N20', label: '20 Years' },
            { value: 'N50', label: '50 Years' },
            { value: 'N100', label: '100 Years' },
          ]}
        />

        <FilterSelect
          label="Outlook"
          value={polarityFilter}
          onChange={setPolarityFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'C3', label: 'Calamity' },
            { value: 'C2', label: 'Severe' },
            { value: 'C1', label: 'Negative' },
            { value: 'N0', label: 'Neutral' },
            { value: 'P1', label: 'Positive' },
            { value: 'P2', label: 'Transform' },
            { value: 'P3', label: 'Utopian' },
          ]}
        />

        <FilterSelect
          label="Sort"
          value={sortBy}
          onChange={(v) => setSortBy(v as SortOption)}
          options={[
            { value: 'date', label: 'Date' },
            { value: 'horizon', label: 'Horizon' },
            { value: 'polarity', label: 'Outlook' },
            { value: 'title', label: 'Title' },
          ]}
        />

        {/* View Toggle */}
        <div style={{
          display: 'flex',
          marginLeft: 'auto',
          border: '1px solid #333',
        }}>
          {(['list', 'grid', 'timeline'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              style={{
                padding: '8px 14px',
                background: viewMode === mode ? '#fff' : 'transparent',
                border: 'none',
                color: viewMode === mode ? '#000' : '#666',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '12px',
        borderBottom: '1px solid #222',
      }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#666' }}>
          {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid #444',
              color: '#888',
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Articles Display */}
      {filteredArticles.length === 0 ? (
        <div style={{
          padding: '60px 20px',
          textAlign: 'center',
          fontFamily: 'monospace',
          color: '#555',
        }}>
          No articles match your filters.
        </div>
      ) : viewMode === 'timeline' ? (
        <div style={{ position: 'relative', paddingLeft: '32px' }}>
          <div style={{
            position: 'absolute',
            left: '12px',
            top: 0,
            bottom: 0,
            width: '1px',
            background: '#333',
          }} />
          {groupedByYear.map(([year, yearArticles]) => (
            <div key={year} style={{ marginBottom: '32px', position: 'relative' }}>
              <div style={{
                position: 'absolute',
                left: '-26px',
                top: '4px',
                width: '8px',
                height: '8px',
                background: '#fff',
              }} />
              <h4 style={{
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                color: '#fff',
                margin: '0 0 16px 0',
                fontWeight: 600,
              }}>
                {year}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {yearArticles.map(article => (
                  <ArticleRow key={article.slug} article={article} compact />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}>
          {filteredArticles.map(article => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#222' }}>
          {filteredArticles.map(article => (
            <ArticleRow key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}

// Filter Select Component
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: 'monospace',
        fontSize: '0.65rem',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '4px',
      }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 32px 8px 12px',
          background: '#111',
          border: '1px solid #333',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23666'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '14px',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// Article Card for Grid View
function ArticleCard({ article }: { article: EnhancedArticleData }) {
  const formattedDate = article.date
    ? new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
    : '';

  return (
    <Link
      href={`/articles/${article.slug}`}
      style={{
        display: 'block',
        background: '#111',
        border: '1px solid #222',
        padding: '20px',
        textDecoration: 'none',
        transition: 'border-color 0.15s',
      }}
    >
      <h3 style={{
        fontFamily: 'monospace',
        fontSize: '1rem',
        fontWeight: 600,
        color: '#fff',
        margin: '0 0 8px 0',
        lineHeight: 1.4,
      }}>
        {article.title}
      </h3>

      {article.description && (
        <p style={{
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          color: '#888',
          margin: '0 0 12px 0',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {article.description}
        </p>
      )}

      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        alignItems: 'center',
      }}>
        {formattedDate && (
          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#555' }}>
            {formattedDate}
          </span>
        )}
        {article.horizon && (
          <Badge>{horizonLabels[article.horizon]}</Badge>
        )}
        {article.polarity && article.polarity !== 'N0' && (
          <Badge variant="polarity">{polarityLabels[article.polarity]}</Badge>
        )}
      </div>
    </Link>
  );
}

// Article Row for List View
function ArticleRow({ article, compact = false }: { article: EnhancedArticleData; compact?: boolean }) {
  const formattedDate = article.date
    ? new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <Link
      href={`/articles/${article.slug}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        background: '#0a0a0a',
        padding: compact ? '12px 16px' : '16px 20px',
        textDecoration: 'none',
        transition: 'background 0.1s',
      }}
    >
      {/* Date */}
      <span style={{
        fontFamily: 'monospace',
        fontSize: '0.7rem',
        color: '#555',
        minWidth: compact ? '80px' : '100px',
        flexShrink: 0,
      }}>
        {formattedDate}
      </span>

      {/* Title */}
      <span style={{
        fontFamily: 'monospace',
        fontSize: compact ? '0.85rem' : '0.9rem',
        color: '#fff',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {article.title}
      </span>

      {/* Badges */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexShrink: 0,
      }}>
        {article.horizon && (
          <Badge small>{horizonLabels[article.horizon]}</Badge>
        )}
        {article.polarity && article.polarity !== 'N0' && (
          <Badge small variant="polarity">{polarityLabels[article.polarity]}</Badge>
        )}
      </div>

      {/* Arrow */}
      <span style={{ color: '#444', fontSize: '1rem' }}>→</span>
    </Link>
  );
}

// Badge Component
function Badge({
  children,
  variant = 'default',
  small = false,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'polarity';
  small?: boolean;
}) {
  return (
    <span style={{
      padding: small ? '2px 6px' : '3px 8px',
      background: variant === 'polarity' ? 'rgba(255,255,255,0.05)' : 'transparent',
      border: `1px solid ${variant === 'polarity' ? '#444' : '#333'}`,
      color: variant === 'polarity' ? '#888' : '#666',
      fontFamily: 'monospace',
      fontSize: small ? '0.6rem' : '0.65rem',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    }}>
      {children}
    </span>
  );
}
