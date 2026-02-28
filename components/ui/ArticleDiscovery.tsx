import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced'

type ViewMode = 'grid' | 'list' | 'timeline'
type SortOption = 'date' | 'horizon' | 'polarity' | 'title'

interface ArticleDiscoveryProps {
  initialArticles?: EnhancedArticleData[]
}

const horizonLabels: Record<string, string> = {
  NQ: 'Now',
  NY: '1Y',
  N5: '5Y',
  N20: '20Y',
  N50: '50Y',
  N100: '100Y',
}

const polarityLabels: Record<string, string> = {
  C3: 'Calamity',
  C2: 'Severe',
  C1: 'Negative',
  N0: 'Neutral',
  P1: 'Positive',
  P2: 'Transform',
  P3: 'Utopian',
}

const articleTypeLabels: Record<string, string> = {
  fiction: 'Fiction',
  research: 'Research',
}

export default function ArticleDiscovery({ initialArticles }: ArticleDiscoveryProps) {
  const [articles, setArticles] = useState<EnhancedArticleData[]>(initialArticles || [])
  const [loading, setLoading] = useState(!initialArticles)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [horizonFilter, setHorizonFilter] = useState<string>('all')
  const [polarityFilter, setPolarityFilter] = useState<string>('all')
  const [mechanicFilter, setMechanicFilter] = useState<string>('all')
  const [articleTypeFilter, setArticleTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortOption>('date')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => {
    if (!initialArticles) {
      fetch('/api/articles-enhanced')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch')
          return res.json()
        })
        .then((data) => {
          if (Array.isArray(data)) {
            setArticles(data)
          }
        })
        .catch((err) => {
          console.error('Failed to fetch articles:', err)
          setError('Failed to load articles')
        })
        .finally(() => setLoading(false))
    }
  }, [initialArticles])

  const filteredArticles = useMemo(() => {
    let result = [...articles]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (article) =>
          article.title?.toLowerCase().includes(query) ||
          article.description?.toLowerCase().includes(query) ||
          article.keywords?.some((k) => typeof k === 'string' && k.toLowerCase().includes(query))
      )
    }

    if (horizonFilter !== 'all') {
      result = result.filter((article) => article.horizon === horizonFilter)
    }

    if (polarityFilter !== 'all') {
      result = result.filter((article) => article.polarity === polarityFilter)
    }

    if (mechanicFilter !== 'all') {
      result = result.filter((article) =>
        article.mechanics?.includes(mechanicFilter as never)
      )
    }

    if (articleTypeFilter !== 'all') {
      result = result.filter((article) => article.articleType === articleTypeFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        case 'horizon': {
          const horizonOrder = ['NQ', 'NY', 'N5', 'N20', 'N50', 'N100']
          return (
            horizonOrder.indexOf(a.horizon || 'N100') -
            horizonOrder.indexOf(b.horizon || 'N100')
          )
        }
        case 'polarity': {
          const polarityOrder = ['C3', 'C2', 'C1', 'N0', 'P1', 'P2', 'P3']
          return (
            polarityOrder.indexOf(a.polarity || 'N0') -
            polarityOrder.indexOf(b.polarity || 'N0')
          )
        }
        case 'title':
          return a.title.localeCompare(b.title)
        default:
          return 0
      }
    })

    return result
  }, [
    articles,
    searchQuery,
    horizonFilter,
    polarityFilter,
    mechanicFilter,
    articleTypeFilter,
    sortBy,
  ])

  const groupedByYear = useMemo(() => {
    const groups: Record<string, EnhancedArticleData[]> = {}
    filteredArticles.forEach((article) => {
      const year = article.date ? new Date(article.date).getFullYear().toString() : 'Unknown'
      if (!groups[year]) groups[year] = []
      groups[year].push(article)
    })
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [filteredArticles])

  const hasActiveFilters =
    horizonFilter !== 'all' ||
    polarityFilter !== 'all' ||
    mechanicFilter !== 'all' ||
    articleTypeFilter !== 'all' ||
    searchQuery

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setHorizonFilter('all')
    setPolarityFilter('all')
    setMechanicFilter('all')
    setArticleTypeFilter('all')
  }, [])

  if (loading) {
    return (
      <div
        style={{
          padding: '80px 20px',
          textAlign: 'center',
          fontFamily: 'monospace',
          color: '#555',
          fontSize: '0.85rem',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            border: '2px solid #222',
            borderTopColor: '#00d4ff',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        Loading publications...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          fontFamily: 'monospace',
          color: '#f66',
        }}
      >
        {error}
      </div>
    )
  }

  // Split first article for hero treatment in grid mode
  const heroArticle = viewMode === 'grid' ? filteredArticles[0] : null
  const remainingArticles = viewMode === 'grid' ? filteredArticles.slice(1) : filteredArticles

  return (
    <div>
      {/* Search & Filter Bar */}
      <div
        style={{
          background: '#0a0a14',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 20px',
          marginBottom: '32px',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <span
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#444',
              fontSize: '0.9rem',
              pointerEvents: 'none',
            }}
          >
            &#x2315;
          </span>
          <input
            type="text"
            placeholder="Search publications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 36px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              color: '#fff',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)')}
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')
            }
          />
        </div>

        {/* Filters row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'flex-end',
          }}
        >
          <FilterPill
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

          <FilterPill
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

          <FilterPill
            label="Type"
            value={articleTypeFilter}
            onChange={setArticleTypeFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'fiction', label: 'Fiction' },
              { value: 'research', label: 'Research' },
            ]}
          />

          <FilterPill
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

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* View toggle */}
          <div
            style={{
              display: 'flex',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {(['grid', 'list', 'timeline'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '7px 14px',
                  background:
                    viewMode === mode ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: 'none',
                  color: viewMode === mode ? '#fff' : '#555',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#555' }}>
          {filteredArticles.length} publication{filteredArticles.length !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              padding: '5px 12px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: '#777',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'all 0.15s',
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Articles Display */}
      {filteredArticles.length === 0 ? (
        <div
          style={{
            padding: '80px 20px',
            textAlign: 'center',
            fontFamily: 'monospace',
            color: '#444',
            fontSize: '0.85rem',
          }}
        >
          No publications match your criteria.
        </div>
      ) : viewMode === 'timeline' ? (
        <TimelineView groupedByYear={groupedByYear} />
      ) : viewMode === 'grid' ? (
        <div>
          {/* Hero article — magazine-style lead */}
          {heroArticle && <HeroCard article={heroArticle} />}

          {/* Grid of remaining articles */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px',
            }}
          >
            {remainingArticles.map((article) => (
              <GridCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {filteredArticles.map((article) => (
            <ListRow key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Filter Pill ──────────────────────────────────────────── */

function FilterPill({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontFamily: 'monospace',
          fontSize: '0.6rem',
          color: '#555',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '4px',
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '7px 28px 7px 10px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '6px',
          color: value !== 'all' ? '#fff' : '#888',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          cursor: 'pointer',
          outline: 'none',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23555'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 6px center',
          backgroundSize: '12px',
          transition: 'border-color 0.15s',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ─── Hero Card (magazine lead) ───────────────────────────── */

function HeroCard({ article }: { article: EnhancedArticleData }) {
  const formattedDate = article.date
    ? new Date(article.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return (
    <Link
      href={`/articles/${article.slug}`}
      style={{
        display: 'grid',
        gridTemplateColumns: (article.heroImage || article.ogImage) ? '1fr 1fr' : '1fr',
        gap: '0',
        textDecoration: 'none',
        borderRadius: '12px',
        overflow: 'hidden',
        background: '#0a0a14',
        border: '1px solid rgba(255,255,255,0.06)',
        marginBottom: '20px',
        transition: 'all 0.3s ease',
        minHeight: '280px',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)'
        e.currentTarget.style.boxShadow = '0 16px 48px rgba(0,0,0,0.3)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Image side */}
      {(article.heroImage || article.ogImage) && (
        <div
          style={{
            position: 'relative',
            background: '#111',
            minHeight: '280px',
          }}
        >
          <Image
            src={article.heroImage || article.ogImage!}
            alt={article.title}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 768px) 100vw, 600px"
            priority
          />
        </div>
      )}

      {/* Content side */}
      <div
        style={{
          padding: '36px 32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        {/* Meta line */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          {article.articleType && (
            <TypeBadge type={article.articleType} />
          )}
          {article.horizon && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                color: '#00d4ff',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {horizonLabels[article.horizon]}
            </span>
          )}
          {formattedDate && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                color: '#444',
              }}
            >
              {formattedDate}
            </span>
          )}
        </div>

        <h3
          style={{
            fontSize: 'clamp(1.3rem, 2.5vw, 1.8rem)',
            fontWeight: 700,
            color: '#fff',
            margin: '0 0 12px 0',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
          }}
        >
          {article.title}
        </h3>

        {article.description && (
          <p
            style={{
              fontSize: '0.9rem',
              color: '#888',
              margin: '0 0 20px 0',
              lineHeight: 1.7,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {article.description}
          </p>
        )}

        {/* Bottom metadata */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            marginTop: 'auto',
          }}
        >
          {article.readingTime > 0 && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                color: '#555',
              }}
            >
              {article.readingTime} min read
            </span>
          )}
          {article.polarity && article.polarity !== 'N0' && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                color: getPolarityColor(article.polarity),
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {polarityLabels[article.polarity]}
            </span>
          )}
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#00d4ff',
              marginLeft: 'auto',
              opacity: 0.7,
            }}
          >
            Read &rarr;
          </span>
        </div>
      </div>
    </Link>
  )
}

/* ─── Grid Card ────────────────────────────────────────────── */

function GridCard({ article }: { article: EnhancedArticleData }) {
  const formattedDate = article.date
    ? new Date(article.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      })
    : ''

  const hasImage = article.heroImage || article.ogImage

  return (
    <Link
      href={`/articles/${article.slug}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#0a0a14',
        border: '1px solid rgba(255,255,255,0.06)',
        transition: 'all 0.25s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.35)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Image */}
      {hasImage && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#111',
            overflow: 'hidden',
          }}
        >
          <Image
            src={(article.heroImage || article.ogImage)!}
            alt={article.title}
            fill
            style={{ objectFit: 'cover', transition: 'transform 0.4s ease' }}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
          />
          {/* Type badge overlay */}
          {article.articleType && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                left: '10px',
                zIndex: 1,
              }}
            >
              <TypeBadge type={article.articleType} />
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div
        style={{
          padding: '18px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        {/* Meta line */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginBottom: '10px',
            flexWrap: 'wrap',
          }}
        >
          {!hasImage && article.articleType && (
            <TypeBadge type={article.articleType} />
          )}
          {article.horizon && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.6rem',
                color: '#00d4ff',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {horizonLabels[article.horizon]}
            </span>
          )}
          {formattedDate && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.6rem',
                color: '#444',
                marginLeft: 'auto',
              }}
            >
              {formattedDate}
            </span>
          )}
        </div>

        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#fff',
            margin: '0 0 8px 0',
            lineHeight: 1.4,
            letterSpacing: '-0.01em',
          }}
        >
          {article.title}
        </h3>

        {article.description && (
          <p
            style={{
              fontSize: '0.8rem',
              color: '#777',
              margin: '0 0 14px 0',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1,
            }}
          >
            {article.description}
          </p>
        )}

        {/* Bottom row */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {article.readingTime > 0 && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.65rem',
                color: '#444',
              }}
            >
              {article.readingTime} min
            </span>
          )}
          {article.polarity && article.polarity !== 'N0' && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.6rem',
                color: getPolarityColor(article.polarity),
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {polarityLabels[article.polarity]}
            </span>
          )}
          {article.domains && article.domains.length > 0 && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.6rem',
                color: '#444',
                marginLeft: 'auto',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {article.domains[0]}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

/* ─── List Row ─────────────────────────────────────────────── */

function ListRow({ article }: { article: EnhancedArticleData }) {
  const formattedDate = article.date
    ? new Date(article.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : ''

  const hasImage = article.heroImage || article.ogImage

  return (
    <Link
      href={`/articles/${article.slug}`}
      style={{
        display: 'grid',
        gridTemplateColumns: hasImage ? '120px 1fr' : '1fr',
        gap: '16px',
        alignItems: 'center',
        textDecoration: 'none',
        padding: '16px 20px',
        borderRadius: '8px',
        background: 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Thumbnail */}
      {hasImage && (
        <div
          style={{
            position: 'relative',
            width: '120px',
            height: '72px',
            borderRadius: '6px',
            overflow: 'hidden',
            background: '#111',
            flexShrink: 0,
          }}
        >
          <Image
            src={(article.heroImage || article.ogImage)!}
            alt={article.title}
            fill
            style={{ objectFit: 'cover' }}
            sizes="120px"
          />
        </div>
      )}

      {/* Content */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '4px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              color: '#444',
              flexShrink: 0,
            }}
          >
            {formattedDate}
          </span>
          {article.articleType && <TypeBadge type={article.articleType} small />}
          {article.horizon && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '0.6rem',
                color: '#00d4ff',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {horizonLabels[article.horizon]}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: '0.9rem',
            fontWeight: 500,
            color: '#e5e5e5',
            lineHeight: 1.4,
            marginBottom: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {article.title}
        </div>

        {article.description && (
          <div
            style={{
              fontSize: '0.75rem',
              color: '#666',
              lineHeight: 1.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {article.description}
          </div>
        )}
      </div>
    </Link>
  )
}

/* ─── Timeline View ────────────────────────────────────────── */

function TimelineView({
  groupedByYear,
}: {
  groupedByYear: [string, EnhancedArticleData[]][]
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: '40px' }}>
      {/* Vertical line */}
      <div
        style={{
          position: 'absolute',
          left: '15px',
          top: '8px',
          bottom: '8px',
          width: '1px',
          background: 'linear-gradient(180deg, #333 0%, #222 50%, transparent 100%)',
        }}
      />

      {groupedByYear.map(([year, yearArticles]) => (
        <div key={year} style={{ marginBottom: '40px', position: 'relative' }}>
          {/* Year marker */}
          <div
            style={{
              position: 'absolute',
              left: '-33px',
              top: '3px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#0a0a14',
              border: '2px solid #00d4ff',
            }}
          />

          <h4
            style={{
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              color: '#fff',
              margin: '0 0 20px 0',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {year}
          </h4>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px',
            }}
          >
            {yearArticles.map((article) => {
              const hasImage = article.heroImage || article.ogImage
              return (
                <Link
                  key={article.slug}
                  href={`/articles/${article.slug}`}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    textDecoration: 'none',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    background: '#0a0a14',
                    border: '1px solid rgba(255,255,255,0.04)',
                    transition: 'all 0.2s',
                    alignItems: 'center',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                    e.currentTarget.style.background = '#0a0a14'
                  }}
                >
                  {hasImage && (
                    <div
                      style={{
                        position: 'relative',
                        width: '56px',
                        height: '56px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        background: '#111',
                        flexShrink: 0,
                      }}
                    >
                      <Image
                        src={(article.heroImage || article.ogImage)!}
                        alt=""
                        fill
                        style={{ objectFit: 'cover' }}
                        sizes="56px"
                      />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        color: '#e5e5e5',
                        lineHeight: 1.3,
                        marginBottom: '4px',
                      }}
                    >
                      {article.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        alignItems: 'center',
                      }}
                    >
                      {article.articleType && (
                        <TypeBadge type={article.articleType} small />
                      )}
                      {article.readingTime > 0 && (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.6rem',
                            color: '#444',
                          }}
                        >
                          {article.readingTime} min
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Shared Components ────────────────────────────────────── */

function TypeBadge({
  type,
  small = false,
}: {
  type: string
  small?: boolean
}) {
  const isResearch = type === 'research'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: small ? '1px 5px' : '2px 7px',
        borderRadius: '3px',
        background: isResearch ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)',
        color: isResearch ? '#60a5fa' : '#c084fc',
        fontFamily: 'monospace',
        fontSize: small ? '0.55rem' : '0.6rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        fontWeight: 500,
      }}
    >
      {articleTypeLabels[type] || type}
    </span>
  )
}

function getPolarityColor(polarity: string): string {
  switch (polarity) {
    case 'C3':
      return '#ef4444'
    case 'C2':
      return '#f97316'
    case 'C1':
      return '#eab308'
    case 'P1':
      return '#22c55e'
    case 'P2':
      return '#3b82f6'
    case 'P3':
      return '#a855f7'
    default:
      return '#666'
  }
}
