import React, { useState, useEffect, useMemo, useCallback } from 'react';
import styled from 'styled-components';
import ArticleCard from './ArticleCard';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

const Container = styled.div`
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
`;

const SearchBar = styled.div`
  position: relative;
  margin-bottom: 24px;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 16px 20px 16px 48px;
  background: rgba(20, 20, 30, 0.9);
  border: 1px solid rgba(222, 126, 162, 0.2);
  border-radius: 12px;
  color: #fff;
  font-size: 1rem;
  outline: none;
  transition: all 0.2s ease;

  &::placeholder {
    color: #6b7280;
  }

  &:focus {
    border-color: rgba(222, 126, 162, 0.5);
    box-shadow: 0 0 0 3px rgba(222, 126, 162, 0.1);
  }
`;

const SearchIcon = styled.span`
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  color: #6b7280;
  font-size: 1.1rem;
`;

const FiltersContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const FilterLabel = styled.label`
  font-size: 0.75rem;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const FilterSelect = styled.select`
  padding: 10px 36px 10px 14px;
  background: rgba(20, 20, 30, 0.9);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  color: #a5b4fc;
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 16px;

  &:focus {
    border-color: rgba(99, 102, 241, 0.5);
  }

  option {
    background: #1a1a2e;
    color: #fff;
  }
`;

const ViewToggle = styled.div`
  display: flex;
  gap: 4px;
  margin-left: auto;
  background: rgba(20, 20, 30, 0.9);
  border-radius: 8px;
  padding: 4px;
`;

const ViewButton = styled.button<{ $active: boolean }>`
  padding: 8px 14px;
  background: ${({ $active }) => $active ? 'rgba(99, 102, 241, 0.3)' : 'transparent'};
  border: none;
  border-radius: 6px;
  color: ${({ $active }) => $active ? '#a5b4fc' : '#6b7280'};
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: #a5b4fc;
  }
`;

const SortSelect = styled(FilterSelect)`
  border-color: rgba(222, 126, 162, 0.2);
  color: #de7ea2;
`;

const ResultsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
`;

const ResultsCount = styled.span`
  color: #9ca3af;
  font-size: 0.875rem;
`;

const ClearFilters = styled.button`
  padding: 6px 12px;
  background: transparent;
  border: 1px solid rgba(222, 126, 162, 0.3);
  border-radius: 6px;
  color: #de7ea2;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(222, 126, 162, 0.1);
  }
`;

const ArticleGrid = styled.div<{ $view: 'grid' | 'list' }>`
  display: grid;
  gap: 20px;

  ${({ $view }) => $view === 'grid'
    ? `grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));`
    : `grid-template-columns: 1fr;`
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const TimelineContainer = styled.div`
  position: relative;
  padding-left: 40px;

  &::before {
    content: '';
    position: absolute;
    left: 16px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(180deg, #6366f1 0%, #de7ea2 50%, #6366f1 100%);
  }
`;

const TimelineYear = styled.div`
  position: relative;
  margin-bottom: 32px;

  &::before {
    content: '';
    position: absolute;
    left: -32px;
    top: 8px;
    width: 12px;
    height: 12px;
    background: #de7ea2;
    border-radius: 50%;
    border: 2px solid #0a0a0a;
  }
`;

const TimelineYearLabel = styled.h4`
  color: #de7ea2;
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 16px 0;
`;

const TimelineArticles = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
`;

type ViewMode = 'grid' | 'list' | 'timeline';
type SortOption = 'date' | 'horizon' | 'polarity' | 'title';

interface ArticleDiscoveryProps {
  initialArticles?: EnhancedArticleData[];
}

export default function ArticleDiscovery({ initialArticles }: ArticleDiscoveryProps) {
  const [articles, setArticles] = useState<EnhancedArticleData[]>(initialArticles || []);
  const [loading, setLoading] = useState(!initialArticles);
  const [searchQuery, setSearchQuery] = useState('');
  const [horizonFilter, setHorizonFilter] = useState<string>('all');
  const [polarityFilter, setPolarityFilter] = useState<string>('all');
  const [mechanicFilter, setMechanicFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    if (!initialArticles) {
      fetch('/api/articles-enhanced')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setArticles(data);
          }
        })
        .catch(err => console.error('Failed to fetch articles:', err))
        .finally(() => setLoading(false));
    }
  }, [initialArticles]);

  const filteredArticles = useMemo(() => {
    let result = [...articles];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(article =>
        article.title.toLowerCase().includes(query) ||
        article.description?.toLowerCase().includes(query) ||
        article.keywords?.some(k => k.toLowerCase().includes(query)) ||
        article.domains?.some(d => d.toLowerCase().includes(query))
      );
    }

    // Horizon filter
    if (horizonFilter !== 'all') {
      result = result.filter(article => article.horizon === horizonFilter);
    }

    // Polarity filter
    if (polarityFilter !== 'all') {
      result = result.filter(article => article.polarity === polarityFilter);
    }

    // Mechanic filter
    if (mechanicFilter !== 'all') {
      result = result.filter(article => article.mechanics?.includes(mechanicFilter as any));
    }

    // Sort
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
    return <LoadingState>Loading articles...</LoadingState>;
  }

  return (
    <Container>
      <SearchBar>
        <SearchIcon>🔍</SearchIcon>
        <SearchInput
          type="text"
          placeholder="Search articles by title, topic, or keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </SearchBar>

      <FiltersContainer>
        <FilterGroup>
          <FilterLabel>Time Horizon</FilterLabel>
          <FilterSelect value={horizonFilter} onChange={(e) => setHorizonFilter(e.target.value)}>
            <option value="all">All Horizons</option>
            <option value="NQ">Now (0-3 months)</option>
            <option value="NY">1 Year</option>
            <option value="N5">5 Years</option>
            <option value="N20">20 Years</option>
            <option value="N50">50 Years</option>
            <option value="N100">100 Years</option>
          </FilterSelect>
        </FilterGroup>

        <FilterGroup>
          <FilterLabel>Outlook</FilterLabel>
          <FilterSelect value={polarityFilter} onChange={(e) => setPolarityFilter(e.target.value)}>
            <option value="all">All Outlooks</option>
            <option value="C3">Calamity</option>
            <option value="C2">Severe</option>
            <option value="C1">Negative</option>
            <option value="N0">Neutral</option>
            <option value="P1">Positive</option>
            <option value="P2">Transformative</option>
            <option value="P3">Utopian</option>
          </FilterSelect>
        </FilterGroup>

        <FilterGroup>
          <FilterLabel>Theme</FilterLabel>
          <FilterSelect value={mechanicFilter} onChange={(e) => setMechanicFilter(e.target.value)}>
            <option value="all">All Themes</option>
            <option value="labor-substitution">Labor & Automation</option>
            <option value="discovery-compression">Discovery & Science</option>
            <option value="control-governance">Governance & Control</option>
            <option value="epistemic-drift">Truth & Knowledge</option>
            <option value="scarcity-inversion">Scarcity & Abundance</option>
            <option value="security-adversarial">Security</option>
            <option value="biological-convergence">Bio & Consciousness</option>
            <option value="market-restructuring">Markets & Economics</option>
            <option value="agency-multiplication">Agents & Coordination</option>
            <option value="alignment-incentives">Alignment</option>
          </FilterSelect>
        </FilterGroup>

        <FilterGroup>
          <FilterLabel>Sort By</FilterLabel>
          <SortSelect value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}>
            <option value="date">Date (Newest)</option>
            <option value="horizon">Time Horizon</option>
            <option value="polarity">Outlook</option>
            <option value="title">Title (A-Z)</option>
          </SortSelect>
        </FilterGroup>

        <ViewToggle>
          <ViewButton $active={viewMode === 'grid'} onClick={() => setViewMode('grid')}>
            Grid
          </ViewButton>
          <ViewButton $active={viewMode === 'list'} onClick={() => setViewMode('list')}>
            List
          </ViewButton>
          <ViewButton $active={viewMode === 'timeline'} onClick={() => setViewMode('timeline')}>
            Timeline
          </ViewButton>
        </ViewToggle>
      </FiltersContainer>

      <ResultsHeader>
        <ResultsCount>
          {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </ResultsCount>
        {hasActiveFilters && (
          <ClearFilters onClick={clearFilters}>Clear Filters</ClearFilters>
        )}
      </ResultsHeader>

      {filteredArticles.length === 0 ? (
        <EmptyState>
          <p>No articles match your filters.</p>
          <ClearFilters onClick={clearFilters} style={{ marginTop: '16px' }}>
            Clear Filters
          </ClearFilters>
        </EmptyState>
      ) : viewMode === 'timeline' ? (
        <TimelineContainer>
          {groupedByYear.map(([year, yearArticles]) => (
            <TimelineYear key={year}>
              <TimelineYearLabel>{year}</TimelineYearLabel>
              <TimelineArticles>
                {yearArticles.map(article => (
                  <ArticleCard key={article.slug} article={article} compact />
                ))}
              </TimelineArticles>
            </TimelineYear>
          ))}
        </TimelineContainer>
      ) : (
        <ArticleGrid $view={viewMode}>
          {filteredArticles.map(article => (
            <ArticleCard key={article.slug} article={article} compact={viewMode === 'list'} />
          ))}
        </ArticleGrid>
      )}
    </Container>
  );
}
