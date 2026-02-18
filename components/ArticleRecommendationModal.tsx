'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Star,
  Clock,
  TrendingUp,
  Layers,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Zap,
  Target,
  Compass,
  ArrowRight
} from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

// Animation keyframes
const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(0, 212, 255, 0.2); }
  50% { box-shadow: 0 0 40px rgba(0, 212, 255, 0.4); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
`;

// Styled Components
const Overlay = styled(DialogPrimitive.Overlay)`
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const Content = styled(DialogPrimitive.Content)`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 101;
  width: 95vw;
  max-width: 1400px;
  max-height: 90vh;
  background: linear-gradient(180deg, rgba(3, 3, 8, 0.98) 0%, rgba(10, 10, 26, 0.99) 100%);
  border: 1px solid rgba(0, 212, 255, 0.15);
  border-radius: 16px;
  overflow: hidden;
  box-shadow:
    0 0 60px rgba(0, 212, 255, 0.1),
    0 0 120px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
  animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translate(-50%, -48%) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 32px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);
  background: rgba(0, 212, 255, 0.03);
`;

const TitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const IconContainer = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: rgba(0, 212, 255, 0.15);
  border: 1px solid rgba(0, 212, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${pulse} 2s ease-in-out infinite;

  svg {
    color: #00d4ff;
  }
`;

const Title = styled(DialogPrimitive.Title)`
  font-size: 1.75rem;
  font-weight: 600;
  color: #fff;
  margin: 0;
  letter-spacing: -0.02em;
`;

const Subtitle = styled.p`
  font-size: 0.9rem;
  color: #9ca3af;
  margin: 4px 0 0 0;
`;

const CloseButton = styled(DialogPrimitive.Close)`
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 75, 75, 0.15);
    border-color: rgba(255, 75, 75, 0.3);
    color: #ff6b6b;
    transform: rotate(90deg);
  }
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  height: calc(90vh - 120px);
  overflow: hidden;
`;

const TabContainer = styled.div`
  display: flex;
  gap: 8px;
  padding: 20px 32px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  &::-webkit-scrollbar {
    height: 4px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.3);
    border-radius: 2px;
  }
`;

const Tab = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid ${props => props.$active ? 'rgba(0, 212, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)'};
  background: ${props => props.$active
    ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(255, 215, 0, 0.2) 100%)'
    : 'rgba(255, 255, 255, 0.03)'};
  color: ${props => props.$active ? '#fff' : '#9ca3af'};
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background: ${props => props.$active
      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(255, 215, 0, 0.25) 100%)'
      : 'rgba(255, 255, 255, 0.08)'};
    border-color: rgba(0, 212, 255, 0.3);
    color: #fff;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const TabCount = styled.span`
  background: rgba(0, 212, 255, 0.25);
  color: #00d4ff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
`;

const MainContent = styled.div`
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 380px;
  overflow: hidden;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ArticleGrid = styled.div`
  padding: 24px 32px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  align-content: start;

  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.2);
    border-radius: 4px;
  }
`;

const ArticleCard = styled(Link)<{ $featured?: boolean }>`
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, rgba(25, 25, 40, 0.9) 0%, rgba(15, 15, 25, 0.95) 100%);
  border: 1px solid rgba(0, 212, 255, 0.12);
  border-radius: 16px;
  overflow: hidden;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;

  ${props => props.$featured && css`
    grid-column: span 2;
    flex-direction: row;
    animation: ${glow} 3s ease-in-out infinite;

    @media (max-width: 768px) {
      grid-column: span 1;
      flex-direction: column;
    }
  `}

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #00d4ff, #ffd700, #00d4ff);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(0, 212, 255, 0.35);
    box-shadow: 0 12px 40px rgba(0, 212, 255, 0.15);

    &::before {
      opacity: 1;
    }
  }
`;

const CardImage = styled.div<{ $featured?: boolean }>`
  position: relative;
  width: ${props => props.$featured ? '320px' : '100%'};
  height: ${props => props.$featured ? '100%' : '160px'};
  min-height: ${props => props.$featured ? '200px' : '160px'};
  background: linear-gradient(135deg, #1a1a2e 0%, #0d0d14 100%);
  flex-shrink: 0;
  overflow: hidden;

  @media (max-width: 768px) {
    width: 100%;
    height: 160px;
    min-height: 160px;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.6) 100%);
  }
`;

const CardContent = styled.div`
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const CardTitle = styled.h3`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardDescription = styled.p`
  margin: 0;
  font-size: 0.875rem;
  color: #9ca3af;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
`;

const MetaBadge = styled.span<{ $variant?: 'horizon' | 'polarity' | 'type' | 'mechanic' }>`
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  ${({ $variant }) => {
    switch ($variant) {
      case 'horizon':
        return css`
          background: rgba(255, 215, 0, 0.2);
          color: #a5b4fc;
        `;
      case 'polarity':
        return css`
          background: rgba(0, 212, 255, 0.2);
          color: #f0a5c0;
        `;
      case 'type':
        return css`
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
        `;
      case 'mechanic':
        return css`
          background: rgba(251, 191, 36, 0.15);
          color: #fcd34d;
        `;
      default:
        return css`
          background: rgba(156, 163, 175, 0.15);
          color: #9ca3af;
        `;
    }
  }}
`;

const MatchScore = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #00d4ff;
  z-index: 1;
`;

const Sidebar = styled.div`
  background: rgba(10, 10, 18, 0.5);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;

  @media (max-width: 1024px) {
    display: none;
  }
`;

const SidebarSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SidebarTitle = styled.h4`
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 14px;
    height: 14px;
    color: #00d4ff;
  }
`;

const FeaturedCard = styled(Link)`
  display: block;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(255, 215, 0, 0.1) 100%);
  border: 1px solid rgba(0, 212, 255, 0.25);
  border-radius: 16px;
  overflow: hidden;
  text-decoration: none;
  transition: all 0.3s ease;
  animation: ${float} 4s ease-in-out infinite;

  &:hover {
    transform: scale(1.02);
    border-color: rgba(0, 212, 255, 0.5);
    box-shadow: 0 8px 32px rgba(0, 212, 255, 0.2);
  }
`;

const FeaturedImage = styled.div`
  position: relative;
  width: 100%;
  height: 180px;
  background: linear-gradient(135deg, #1a1a2e 0%, #0d0d14 100%);
`;

const FeaturedBadge = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, #00d4ff 0%, #ffd700 100%);
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  z-index: 1;
`;

const FeaturedContent = styled.div`
  padding: 16px;
`;

const FeaturedTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.4;
`;

const FeaturedDescription = styled.p`
  margin: 0;
  font-size: 0.8rem;
  color: #9ca3af;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const QuickStats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const StatCard = styled.div`
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: #00d4ff;
`;

const StatLabel = styled.div`
  font-size: 0.7rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 4px;
`;

const RecentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const RecentItem = styled(Link)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.2);
  }
`;

const RecentDot = styled.div<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

const RecentTitle = styled.span`
  flex: 1;
  font-size: 0.85rem;
  color: #e5e7eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RecentArrow = styled.span`
  color: #6b7280;
  transition: transform 0.2s ease;

  ${RecentItem}:hover & {
    transform: translateX(4px);
    color: #00d4ff;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
  color: #6b7280;

  svg {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
`;

// Types
type RecommendationType = 'all' | 'similar' | 'horizon' | 'polarity' | 'mechanics' | 'trending';

interface RecommendationTab {
  id: RecommendationType;
  label: string;
  icon: React.ReactNode;
}

const TABS: RecommendationTab[] = [
  { id: 'all', label: 'All Recommendations', icon: <Star /> },
  { id: 'similar', label: 'Similar Topics', icon: <Target /> },
  { id: 'horizon', label: 'Same Timeline', icon: <Clock /> },
  { id: 'polarity', label: 'Similar Outlook', icon: <TrendingUp /> },
  { id: 'mechanics', label: 'Related Mechanics', icon: <Layers /> },
  { id: 'trending', label: 'Trending', icon: <Zap /> },
];

const horizonLabels: Record<string, string> = {
  NQ: 'Now',
  NY: '1 Year',
  N5: '5 Years',
  N20: '20 Years',
  N50: '50 Years',
  N100: '100+ Years',
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

const polarityColors: Record<string, string> = {
  C3: '#ef4444',
  C2: '#f97316',
  C1: '#eab308',
  N0: '#6b7280',
  P1: '#22c55e',
  P2: '#06b6d4',
  P3: '#a855f7',
};

interface ArticleRecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentArticle?: EnhancedArticleData;
  allArticles?: EnhancedArticleData[];
}

// --- Precomputed recommendation index types ---

interface ScoredRecommendation {
  slug: string;
  score: number;
}

interface PrecomputedRecommendations {
  similar: ScoredRecommendation[];
  horizon: ScoredRecommendation[];
  polarity: ScoredRecommendation[];
  mechanics: ScoredRecommendation[];
  trending: ScoredRecommendation[];
}

// Category keys that exist in the precomputed index (excludes 'all' which is derived)
type IndexCategory = 'similar' | 'horizon' | 'polarity' | 'mechanics' | 'trending';

// Stable empty references to avoid dependency loops
const EMPTY_ARTICLES: EnhancedArticleData[] = [];

export default function ArticleRecommendationModal({
  isOpen,
  onClose,
  currentArticle,
  allArticles,
}: ArticleRecommendationModalProps) {
  const articlesFromProps = allArticles ?? EMPTY_ARTICLES;
  const [activeTab, setActiveTab] = useState<RecommendationType>('all');
  const [articles, setArticles] = useState<EnhancedArticleData[]>(articlesFromProps);
  const [recIndex, setRecIndex] = useState<PrecomputedRecommendations | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync with props when they change
  useEffect(() => {
    if (articlesFromProps.length > 0) {
      setArticles(articlesFromProps);
    }
  }, [articlesFromProps]);

  // Fetch articles + precomputed recommendation index when modal opens
  useEffect(() => {
    if (!isOpen || loading) return;

    const needsArticles = articles.length === 0;
    const needsIndex = !recIndex;

    if (!needsArticles && !needsIndex) return;

    setLoading(true);

    const slug = currentArticle?.slug;
    const recUrl = slug
      ? `/api/articles/recommendations?slug=${encodeURIComponent(slug)}`
      : '/api/articles/recommendations';

    const fetches: Promise<void>[] = [];

    if (needsArticles) {
      fetches.push(
        fetch('/api/articles-enhanced')
          .then(res => res.json())
          .then(data => setArticles(data))
          .catch(() => {})
      );
    }

    if (needsIndex) {
      fetches.push(
        fetch(recUrl)
          .then(res => res.json())
          .then(data => {
            if (data && data.similar) setRecIndex(data);
          })
          .catch(() => {})
      );
    }

    Promise.all(fetches).then(() => setLoading(false));
  }, [isOpen, loading, articles.length, recIndex, currentArticle?.slug]);

  // Refetch index when current article changes
  useEffect(() => {
    if (!isOpen) return;
    const slug = currentArticle?.slug;
    const recUrl = slug
      ? `/api/articles/recommendations?slug=${encodeURIComponent(slug)}`
      : '/api/articles/recommendations';

    fetch(recUrl)
      .then(res => res.json())
      .then(data => {
        if (data && data.similar) setRecIndex(data);
      })
      .catch(() => {});
  }, [isOpen, currentArticle?.slug]);

  // Build a slug → article lookup map
  const articleMap = useMemo(() => {
    const map = new Map<string, EnhancedArticleData>();
    for (const a of articles) map.set(a.slug, a);
    return map;
  }, [articles]);

  // Resolve precomputed slug+score list into full EnhancedArticleData[]
  const resolveRecommendations = useCallback(
    (recs: ScoredRecommendation[] | undefined): EnhancedArticleData[] => {
      if (!recs) return [];
      const result: EnhancedArticleData[] = [];
      for (const rec of recs) {
        const article = articleMap.get(rec.slug);
        if (article) result.push(article);
      }
      return result;
    },
    [articleMap]
  );

  // Build a slug → score lookup for the current index
  const scoreMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!recIndex) return map;
    // Use the "similar" category scores as the primary match percentage
    // since those use the full composite scoring (TF-IDF + Jaccard + all signals)
    for (const rec of recIndex.similar) {
      map.set(rec.slug, rec.score);
    }
    return map;
  }, [recIndex]);

  // Get recommendations for a given tab from the precomputed index
  const getRecommendations = useCallback((type: RecommendationType): EnhancedArticleData[] => {
    if (!recIndex) return [];

    if (type === 'all') {
      // Interleave from all 5 categories for maximum diversity
      const categories: IndexCategory[] = ['similar', 'mechanics', 'horizon', 'polarity', 'trending'];
      const sources = categories.map(cat => recIndex[cat] || []);
      const seen = new Set<string>();
      const mixed: EnhancedArticleData[] = [];
      let round = 0;
      while (mixed.length < 15) {
        let added = false;
        for (const source of sources) {
          if (round < source.length && mixed.length < 15) {
            const rec = source[round];
            if (!seen.has(rec.slug)) {
              const article = articleMap.get(rec.slug);
              if (article) {
                seen.add(rec.slug);
                mixed.push(article);
                added = true;
              }
            }
          }
        }
        if (!added) break;
        round++;
      }
      return mixed;
    }

    return resolveRecommendations(recIndex[type]);
  }, [recIndex, articleMap, resolveRecommendations]);

  const recommendations = useMemo(() =>
    getRecommendations(activeTab),
    [activeTab, getRecommendations]
  );

  const featuredArticle = useMemo(() => {
    if (!recIndex || !recIndex.similar.length) return null;
    return articleMap.get(recIndex.similar[0].slug) || null;
  }, [recIndex, articleMap]);

  const recentArticles = useMemo(() =>
    [...articles]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5),
    [articles]
  );

  const tabCounts = useMemo(() => ({
    all: getRecommendations('all').length,
    similar: resolveRecommendations(recIndex?.similar).length,
    horizon: resolveRecommendations(recIndex?.horizon).length,
    polarity: resolveRecommendations(recIndex?.polarity).length,
    mechanics: resolveRecommendations(recIndex?.mechanics).length,
    trending: resolveRecommendations(recIndex?.trending).length,
  }), [recIndex, getRecommendations, resolveRecommendations]);

  // Match score comes directly from the precomputed index
  const getMatchScore = useCallback((article: EnhancedArticleData): number => {
    return scoreMap.get(article.slug) || 0;
  }, [scoreMap]);

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogPrimitive.Portal>
        <Overlay />
        <Content>
          <Header>
            <TitleGroup>
              <IconContainer>
                <Compass size={24} color="#fff" />
              </IconContainer>
              <div>
                <Title>Discover Articles</Title>
                <Subtitle>
                  {currentArticle
                    ? `Recommendations based on "${currentArticle.title.slice(0, 40)}..."`
                    : 'Explore the archive of future scenarios'
                  }
                </Subtitle>
              </div>
            </TitleGroup>
            <CloseButton>
              <X size={20} />
            </CloseButton>
          </Header>

          <Body>
            <TabContainer>
              {TABS.map(tab => (
                <Tab
                  key={tab.id}
                  $active={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                  <TabCount>{tabCounts[tab.id]}</TabCount>
                </Tab>
              ))}
            </TabContainer>

            <MainContent>
              <ArticleGrid>
                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <EmptyState>
                      <Star />
                      <p>Loading recommendations...</p>
                    </EmptyState>
                  ) : recommendations.length === 0 ? (
                    <EmptyState>
                      <BookOpen />
                      <p>No recommendations found for this category.</p>
                      <p style={{ fontSize: '0.8rem', marginTop: 8 }}>
                        Try selecting a different tab above.
                      </p>
                    </EmptyState>
                  ) : (
                    recommendations.map((article, index) => (
                      <motion.div
                        key={article.slug}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <ArticleCard
                          href={`/articles/${article.slug}`}
                          onClick={() => onClose()}
                        >
                          <CardImage>
                            {(article.heroImage || article.ogImage) && (
                              <Image
                                src={article.heroImage || article.ogImage!}
                                alt={article.title}
                                fill
                                style={{ objectFit: 'cover' }}
                              />
                            )}
                            {currentArticle && getMatchScore(article) > 0 && (
                              <MatchScore>
                                <Target size={12} />
                                {getMatchScore(article)}% match
                              </MatchScore>
                            )}
                          </CardImage>
                          <CardContent>
                            <CardTitle>{article.title}</CardTitle>
                            <CardDescription>{article.description}</CardDescription>
                            <CardMeta>
                              <MetaBadge $variant="type">
                                {article.articleType}
                              </MetaBadge>
                              {article.horizon && (
                                <MetaBadge $variant="horizon">
                                  {horizonLabels[article.horizon]}
                                </MetaBadge>
                              )}
                              {article.polarity && article.polarity !== 'N0' && (
                                <MetaBadge $variant="polarity">
                                  {polarityLabels[article.polarity]}
                                </MetaBadge>
                              )}
                            </CardMeta>
                          </CardContent>
                        </ArticleCard>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </ArticleGrid>

              <Sidebar>
                {featuredArticle && (
                  <SidebarSection>
                    <SidebarTitle>
                      <Star /> Top Pick For You
                    </SidebarTitle>
                    <FeaturedCard
                      href={`/articles/${featuredArticle.slug}`}
                      onClick={() => onClose()}
                    >
                      <FeaturedImage>
                        {(featuredArticle.heroImage || featuredArticle.ogImage) && (
                          <Image
                            src={featuredArticle.heroImage || featuredArticle.ogImage!}
                            alt={featuredArticle.title}
                            fill
                            style={{ objectFit: 'cover' }}
                          />
                        )}
                        <FeaturedBadge>
                          <Zap size={12} />
                          Best Match
                        </FeaturedBadge>
                      </FeaturedImage>
                      <FeaturedContent>
                        <FeaturedTitle>{featuredArticle.title}</FeaturedTitle>
                        <FeaturedDescription>
                          {featuredArticle.description}
                        </FeaturedDescription>
                      </FeaturedContent>
                    </FeaturedCard>
                  </SidebarSection>
                )}

                <SidebarSection>
                  <SidebarTitle>
                    <Layers /> Quick Stats
                  </SidebarTitle>
                  <QuickStats>
                    <StatCard>
                      <StatValue>{articles.length}</StatValue>
                      <StatLabel>Total Articles</StatLabel>
                    </StatCard>
                    <StatCard>
                      <StatValue>
                        {articles.filter(a => a.articleType === 'fiction').length}
                      </StatValue>
                      <StatLabel>Fiction</StatLabel>
                    </StatCard>
                    <StatCard>
                      <StatValue>
                        {articles.filter(a => a.articleType === 'research').length}
                      </StatValue>
                      <StatLabel>Research</StatLabel>
                    </StatCard>
                    <StatCard>
                      <StatValue>
                        {new Set(articles.flatMap(a => a.mechanics || [])).size}
                      </StatValue>
                      <StatLabel>Mechanics</StatLabel>
                    </StatCard>
                  </QuickStats>
                </SidebarSection>

                <SidebarSection>
                  <SidebarTitle>
                    <Clock /> Latest Additions
                  </SidebarTitle>
                  <RecentList>
                    {recentArticles.map(article => (
                      <RecentItem
                        key={article.slug}
                        href={`/articles/${article.slug}`}
                        onClick={() => onClose()}
                      >
                        <RecentDot $color={polarityColors[article.polarity || 'N0']} />
                        <RecentTitle>{article.title}</RecentTitle>
                        <RecentArrow>
                          <ChevronRight size={14} />
                        </RecentArrow>
                      </RecentItem>
                    ))}
                  </RecentList>
                </SidebarSection>
              </Sidebar>
            </MainContent>
          </Body>
        </Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Export a trigger button component for easy integration
export const ArticleRecommendationTrigger = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(255, 215, 0, 0.15) 100%);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 14px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    transition: left 0.5s ease;
  }

  &:hover {
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(255, 215, 0, 0.25) 100%);
    border-color: rgba(0, 212, 255, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 212, 255, 0.2);

    &::before {
      left: 100%;
    }
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;
