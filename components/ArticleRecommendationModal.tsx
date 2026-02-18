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

// --- Recommendation diversity utilities ---

// Calculate how similar a candidate is to already-selected articles
function diversityPenalty(
  candidate: EnhancedArticleData,
  selected: EnhancedArticleData[]
): number {
  if (selected.length === 0) return 0;
  let totalPenalty = 0;

  for (const sel of selected) {
    if (candidate.horizon && candidate.horizon === sel.horizon) totalPenalty += 3;
    if (candidate.polarity && candidate.polarity === sel.polarity) totalPenalty += 2;
    if (candidate.articleType === sel.articleType) totalPenalty += 1;
    const sharedMechanics = candidate.mechanics?.filter(m =>
      sel.mechanics?.includes(m)
    ).length || 0;
    totalPenalty += sharedMechanics * 2;
    const sharedDomains = candidate.domains?.filter(d =>
      sel.domains?.includes(d)
    ).length || 0;
    totalPenalty += sharedDomains * 1.5;
  }

  return totalPenalty / selected.length;
}

// Greedy diversified selection: picks items balancing relevance score with diversity
function diversifiedSelect(
  scored: Array<{ article: EnhancedArticleData; score: number }>,
  limit: number,
  diversityWeight: number = 0.4
): EnhancedArticleData[] {
  if (scored.length === 0) return [];
  if (scored.length <= limit) {
    return scored.sort((a, b) => b.score - a.score).map(s => s.article);
  }

  // Normalize scores to 0-1 range for fair diversity weighting
  const maxScore = Math.max(...scored.map(s => s.score));
  const minScore = Math.min(...scored.map(s => s.score));
  const scoreRange = maxScore - minScore || 1;
  const normalized = scored.map(s => ({
    article: s.article,
    normalizedScore: (s.score - minScore) / scoreRange,
  }));

  normalized.sort((a, b) => b.normalizedScore - a.normalizedScore);

  const selected: EnhancedArticleData[] = [];
  const remaining = [...normalized];

  // Always pick the top-scored item first
  selected.push(remaining[0].article);
  remaining.splice(0, 1);

  // For subsequent picks, balance relevance with diversity
  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestAdjustedScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const penalty = diversityPenalty(remaining[i].article, selected);
      const normalizedPenalty = Math.min(1, penalty / 15);
      const adjustedScore =
        remaining[i].normalizedScore * (1 - diversityWeight) +
        (1 - normalizedPenalty) * diversityWeight;
      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx].article);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

// Calculate keyword overlap between two articles
function keywordOverlap(a: EnhancedArticleData, b: EnhancedArticleData): number {
  const aKeywords = (a.keywords || []).filter(Boolean).map(k => k.toLowerCase());
  const bKeywords = new Set((b.keywords || []).filter(Boolean).map(k => k.toLowerCase()));
  if (aKeywords.length === 0 || bKeywords.size === 0) return 0;
  let shared = 0;
  for (const k of aKeywords) {
    if (bKeywords.has(k)) shared++;
  }
  return shared;
}

// Round-robin pick from categorized buckets for even distribution
function roundRobinPick<K extends string>(
  bucketOrder: K[],
  buckets: Map<K, EnhancedArticleData[]>,
  limit: number
): EnhancedArticleData[] {
  const result: EnhancedArticleData[] = [];
  let round = 0;
  while (result.length < limit) {
    let added = false;
    for (const key of bucketOrder) {
      const bucket = buckets.get(key);
      if (bucket && round < bucket.length && result.length < limit) {
        result.push(bucket[round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  return result;
}

// Stable empty array reference to avoid dependency loops
const EMPTY_ARTICLES: EnhancedArticleData[] = [];

export default function ArticleRecommendationModal({
  isOpen,
  onClose,
  currentArticle,
  allArticles,
}: ArticleRecommendationModalProps) {
  // Use stable reference for articles prop
  const articlesFromProps = allArticles ?? EMPTY_ARTICLES;
  const [activeTab, setActiveTab] = useState<RecommendationType>('all');
  const [articles, setArticles] = useState<EnhancedArticleData[]>(articlesFromProps);
  const [loading, setLoading] = useState(false);

  // Sync with props when they change
  useEffect(() => {
    if (articlesFromProps.length > 0) {
      setArticles(articlesFromProps);
      setLoading(false);
    }
  }, [articlesFromProps]);

  // Fetch articles only if not provided and modal is open
  useEffect(() => {
    if (isOpen && articles.length === 0 && !loading) {
      setLoading(true);
      fetch('/api/articles-enhanced')
        .then(res => res.json())
        .then(data => {
          setArticles(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, articles.length, loading]);

  // Recommendation algorithms — each category uses diversified selection
  // to ensure variety across mechanics, horizons, polarities, and domains.
  // When a currentArticle is provided, results are unique to that article's attributes.
  const getRecommendations = useCallback((type: RecommendationType): EnhancedArticleData[] => {
    const filtered = articles.filter(a => a.slug !== currentArticle?.slug);
    if (filtered.length === 0) return [];

    switch (type) {
      case 'similar': {
        if (currentArticle) {
          const scored = filtered.map(article => {
            let score = 0;
            const sharedMechanics = article.mechanics?.filter(m =>
              currentArticle.mechanics?.includes(m)
            ).length || 0;
            score += sharedMechanics * 4;

            const sharedDomains = article.domains?.filter(d =>
              currentArticle.domains?.includes(d)
            ).length || 0;
            score += sharedDomains * 3;

            score += keywordOverlap(article, currentArticle) * 2;

            if (article.articleType === currentArticle.articleType) score += 1;

            // Small bonus for adjacent time horizon
            if (article.horizon && currentArticle.horizon) {
              const horizonOrder = ['NQ', 'NY', 'N5', 'N20', 'N50', 'N100'];
              const dist = Math.abs(
                horizonOrder.indexOf(article.horizon) - horizonOrder.indexOf(currentArticle.horizon)
              );
              if (dist <= 1) score += 1;
            }

            return { article, score };
          }).filter(({ score }) => score > 0);

          return diversifiedSelect(scored, 12, 0.35);
        }
        // No current article: diverse mix weighted by metadata richness
        const scored = filtered.map(article => ({
          article,
          score: (article.mechanics?.length || 0) * 2 + (article.domains?.length || 0),
        }));
        return diversifiedSelect(scored, 12, 0.6);
      }

      case 'horizon': {
        const horizonOrder = ['NQ', 'NY', 'N5', 'N20', 'N50', 'N100'];
        if (currentArticle?.horizon) {
          const currentIdx = horizonOrder.indexOf(currentArticle.horizon);
          const withHorizon = filtered.filter(a => a.horizon);
          const scored = withHorizon.map(article => {
            const idx = horizonOrder.indexOf(article.horizon!);
            const distance = Math.abs(idx - currentIdx);
            const proximityScore = Math.max(0, 10 - distance * 2);
            // Bonus for sharing attributes with current article
            const sharedMechanics = article.mechanics?.filter(m =>
              currentArticle.mechanics?.includes(m)
            ).length || 0;
            return { article, score: proximityScore + sharedMechanics };
          });
          // Higher diversity weight ensures we don't get 12 articles with identical horizon
          return diversifiedSelect(scored, 12, 0.5);
        }
        // No current article: round-robin across all horizons for even distribution
        const byHorizon = new Map<string, EnhancedArticleData[]>();
        for (const h of horizonOrder) byHorizon.set(h, []);
        for (const a of filtered) {
          if (a.horizon && byHorizon.has(a.horizon)) {
            byHorizon.get(a.horizon)!.push(a);
          }
        }
        return roundRobinPick(horizonOrder, byHorizon, 12);
      }

      case 'polarity': {
        const polarityOrder = ['C3', 'C2', 'C1', 'N0', 'P1', 'P2', 'P3'];
        if (currentArticle?.polarity) {
          const currentIdx = polarityOrder.indexOf(currentArticle.polarity);
          const withPolarity = filtered.filter(a => a.polarity);
          const scored = withPolarity.map(article => {
            const idx = polarityOrder.indexOf(article.polarity!);
            const distance = Math.abs(idx - currentIdx);
            const proximityScore = Math.max(0, 12 - distance * 2);
            // Bonus for shared domains so results relate to current topic
            const sharedDomains = article.domains?.filter(d =>
              currentArticle.domains?.includes(d)
            ).length || 0;
            return { article, score: proximityScore + sharedDomains };
          });
          return diversifiedSelect(scored, 12, 0.5);
        }
        // No current article: round-robin across polarity spectrum
        const byPolarity = new Map<string, EnhancedArticleData[]>();
        for (const p of polarityOrder) byPolarity.set(p, []);
        for (const a of filtered) {
          if (a.polarity && byPolarity.has(a.polarity)) {
            byPolarity.get(a.polarity)!.push(a);
          }
        }
        return roundRobinPick(polarityOrder, byPolarity, 12);
      }

      case 'mechanics': {
        if (currentArticle?.mechanics?.length) {
          const targetMechanics = new Set(currentArticle.mechanics);
          const scored = filtered
            .map(article => {
              const shared = article.mechanics?.filter(m => targetMechanics.has(m)).length || 0;
              // Small score for complementary mechanics (exploration)
              const complementary = article.mechanics?.filter(m => !targetMechanics.has(m)).length || 0;
              return { article, score: shared * 3 + complementary * 0.5 };
            })
            .filter(({ score }) => score > 0);
          return diversifiedSelect(scored, 12, 0.45);
        }
        // No current article: diverse mechanics coverage
        const scored = filtered
          .filter(a => a.mechanics?.length)
          .map(article => ({
            article,
            score: article.mechanics!.length,
          }));
        return diversifiedSelect(scored, 12, 0.6);
      }

      case 'trending': {
        const now = Date.now();
        const scored = filtered.map(article => {
          const ageInDays = (now - new Date(article.date).getTime()) / (1000 * 60 * 60 * 24);
          // Recency score decays over ~6 months
          const recencyScore = Math.max(0, 20 - ageInDays / 9);
          let contextBonus = 0;
          if (currentArticle) {
            const sharedMechanics = article.mechanics?.filter(m =>
              currentArticle.mechanics?.includes(m)
            ).length || 0;
            const sharedDomains = article.domains?.filter(d =>
              currentArticle.domains?.includes(d)
            ).length || 0;
            contextBonus = sharedMechanics * 1.5 + sharedDomains;
          }
          return { article, score: recencyScore + contextBonus };
        });
        return diversifiedSelect(scored, 12, 0.3);
      }

      case 'all':
      default: {
        // Interleave results from all 5 categories for maximum diversity
        const sources = [
          getRecommendations('similar'),
          getRecommendations('mechanics'),
          getRecommendations('horizon'),
          getRecommendations('polarity'),
          getRecommendations('trending'),
        ];
        const seen = new Set<string>();
        const mixed: EnhancedArticleData[] = [];
        let round = 0;
        while (mixed.length < 12) {
          let added = false;
          for (const source of sources) {
            if (round < source.length && mixed.length < 12) {
              const article = source[round];
              if (!seen.has(article.slug)) {
                seen.add(article.slug);
                mixed.push(article);
                added = true;
              }
            }
          }
          if (!added) break;
          round++;
        }
        return mixed;
      }
    }
  }, [articles, currentArticle]);

  const recommendations = useMemo(() =>
    getRecommendations(activeTab),
    [activeTab, getRecommendations]
  );

  const featuredArticle = useMemo(() => {
    if (recommendations.length === 0) return null;
    // Featured = highest match score from similar
    const similar = getRecommendations('similar');
    return similar[0] || recommendations[0];
  }, [recommendations, getRecommendations]);

  const recentArticles = useMemo(() =>
    [...articles]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5),
    [articles]
  );

  const tabCounts = useMemo(() => ({
    all: getRecommendations('all').length,
    similar: getRecommendations('similar').length,
    horizon: getRecommendations('horizon').length,
    polarity: getRecommendations('polarity').length,
    mechanics: getRecommendations('mechanics').length,
    trending: getRecommendations('trending').length,
  }), [getRecommendations]);

  const calculateMatchScore = useCallback((article: EnhancedArticleData): number => {
    if (!currentArticle) return 0;
    let score = 0;

    // Mechanics match (max 25) — proportional to overlap ratio
    const currentMechanics = currentArticle.mechanics?.length || 0;
    const mechanicsMatch = article.mechanics?.filter(m =>
      currentArticle.mechanics?.includes(m)
    ).length || 0;
    if (currentMechanics > 0) {
      score += (mechanicsMatch / currentMechanics) * 25;
    }

    // Domain match (max 20) — proportional to overlap ratio
    const currentDomains = currentArticle.domains?.length || 0;
    const domainMatch = article.domains?.filter(d =>
      currentArticle.domains?.includes(d)
    ).length || 0;
    if (currentDomains > 0) {
      score += (domainMatch / currentDomains) * 20;
    }

    // Keyword match (max 15) — proportional to overlap ratio
    const currentKeywords = (currentArticle.keywords || []).filter(Boolean);
    const articleKeywords = (article.keywords || []).filter(Boolean);
    if (currentKeywords.length > 0) {
      const kwSet = new Set(currentKeywords.map(k => k.toLowerCase()));
      const kwMatch = articleKeywords.filter(k => kwSet.has(k.toLowerCase())).length;
      score += (kwMatch / currentKeywords.length) * 15;
    }

    // Horizon proximity (max 20) — same horizon = full, adjacent = partial
    if (article.horizon && currentArticle.horizon) {
      const horizonOrder = ['NQ', 'NY', 'N5', 'N20', 'N50', 'N100'];
      const distance = Math.abs(
        horizonOrder.indexOf(article.horizon) - horizonOrder.indexOf(currentArticle.horizon)
      );
      score += Math.max(0, 20 - distance * 4);
    }

    // Polarity proximity (max 10) — same polarity = full, adjacent = partial
    if (article.polarity && currentArticle.polarity) {
      const polarityOrder = ['C3', 'C2', 'C1', 'N0', 'P1', 'P2', 'P3'];
      const distance = Math.abs(
        polarityOrder.indexOf(article.polarity) - polarityOrder.indexOf(currentArticle.polarity)
      );
      score += Math.max(0, 10 - distance * 2);
    }

    // Type match (10)
    if (article.articleType === currentArticle.articleType) score += 10;

    return Math.min(100, Math.round(score));
  }, [currentArticle]);

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
                            {currentArticle && (
                              <MatchScore>
                                <Target size={12} />
                                {calculateMatchScore(article)}% match
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
