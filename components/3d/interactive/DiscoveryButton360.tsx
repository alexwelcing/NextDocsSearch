'use client';

import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { Compass, Star, BookOpen, ChevronUp, ChevronDown } from 'lucide-react';
import { useArticleDiscovery } from '@/components/ArticleDiscoveryProvider';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

const pulseRing = keyframes`
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.15); opacity: 0.4; }
  100% { transform: scale(1.3); opacity: 0; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0) translateX(-50%); }
  50% { transform: translateY(-8px) translateX(-50%); }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div<{ $visible: boolean }>`
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 95;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: ${props => props.$visible ? 1 : 0};
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};

  @media (max-width: 768px) {
    bottom: 90px;
  }
`;

const MainButton = styled.button<{ $expanded: boolean }>`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: ${props => props.$expanded ? '18px 32px' : '18px'};
  background: rgba(0, 30, 50, 0.9);
  border: 2px solid rgba(0, 212, 255, 0.4);
  border-radius: ${props => props.$expanded ? '24px' : '50%'};
  color: #fff;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 8px 32px rgba(0, 212, 255, 0.3),
    0 0 60px rgba(0, 212, 255, 0.15),
    inset 0 2px 0 rgba(255, 255, 255, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${float} 3s ease-in-out infinite;
  backdrop-filter: blur(10px);

  &::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.5), rgba(255, 215, 0, 0.3), rgba(0, 212, 255, 0.5));
    background-size: 200% 100%;
    animation: ${shimmer} 3s linear infinite;
    z-index: -1;
    opacity: 0.4;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: rgba(0, 30, 50, 0.95);
    z-index: 0;
  }

  &:hover {
    transform: translateX(-50%) translateY(-4px) scale(1.02);
    box-shadow:
      0 12px 48px rgba(0, 212, 255, 0.4),
      0 0 80px rgba(0, 212, 255, 0.25);
    border-color: rgba(0, 212, 255, 0.6);
    animation: none;
  }

  svg, span {
    position: relative;
    z-index: 1;
  }

  svg {
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    color: #00d4ff;
  }
`;

const PulseRing = styled.div`
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(0, 212, 255, 0.5);
  animation: ${pulseRing} 2s ease-out infinite;
  pointer-events: none;
`;

const ButtonText = styled.span`
  white-space: nowrap;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
`;

const PreviewCard = styled.div<{ $visible: boolean }>`
  display: ${props => props.$visible ? 'flex' : 'none'};
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  background: rgba(3, 3, 8, 0.95);
  border: 1px solid rgba(0, 212, 255, 0.25);
  border-radius: 8px;
  width: 320px;
  max-width: 90vw;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(20px);
  animation: ${slideUp} 0.3s ease;

  @media (max-width: 768px) {
    width: 280px;
    padding: 16px;
  }
`;

const PreviewHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PreviewTitle = styled.h4`
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #00d4ff;
  text-transform: uppercase;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 8px;

  svg {
    width: 16px;
    height: 16px;
  }
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;

  &:hover {
    color: #00d4ff;
  }
`;

const PreviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const PreviewItem = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  width: 100%;

  &:hover {
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.25);
    transform: translateX(4px);
  }
`;

const PreviewDot = styled.div<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

const PreviewItemContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const PreviewItemTitle = styled.div`
  font-size: 0.9rem;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PreviewItemMeta = styled.div`
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 2px;
`;

const ViewAllButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: rgba(0, 212, 255, 0.08);
  border: 1px solid rgba(0, 212, 255, 0.25);
  border-radius: 6px;
  color: #00d4ff;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 4px;

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.4);
    transform: translateY(-2px);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

const polarityColors: Record<string, string> = {
  C3: '#ef4444',
  C2: '#f97316',
  C1: '#eab308',
  N0: '#6b7280',
  P1: '#22c55e',
  P2: '#06b6d4',
  P3: '#a855f7',
};

interface DiscoveryButton360Props {
  isGamePlaying?: boolean;
}

export default function DiscoveryButton360({ isGamePlaying = false }: DiscoveryButton360Props) {
  const { openModal } = useArticleDiscovery();
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewArticles, setPreviewArticles] = useState<EnhancedArticleData[]>([]);
  const [loading, setLoading] = useState(false);

  // Intelligent diversity selection - pick articles with different characteristics
  const selectDiverseArticles = (articles: EnhancedArticleData[], count: number): EnhancedArticleData[] => {
    if (articles.length <= count) return articles;

    const selected: EnhancedArticleData[] = [];
    const usedPolarities = new Set<string>();
    const usedHorizons = new Set<string>();
    const usedTypes = new Set<string>();

    // First pass: prioritize diversity across polarity, horizon, and type
    const shuffled = [...articles].sort(() => 0.5 - Math.random());

    for (const article of shuffled) {
      if (selected.length >= count) break;

      const polarity = article.polarity || 'N0';
      const horizon = article.horizon || 'NY';
      const type = article.articleType || 'research';

      // Calculate diversity score - prefer articles that add new characteristics
      const polarityNew = !usedPolarities.has(polarity);
      const horizonNew = !usedHorizons.has(horizon);
      const typeNew = !usedTypes.has(type);

      // Accept if it adds at least one new characteristic, or if we haven't filled slots yet
      if (polarityNew || horizonNew || typeNew || selected.length < Math.ceil(count / 2)) {
        selected.push(article);
        usedPolarities.add(polarity);
        usedHorizons.add(horizon);
        usedTypes.add(type);
      }
    }

    // Fill remaining slots if needed
    if (selected.length < count) {
      const remaining = shuffled.filter(a => !selected.includes(a));
      selected.push(...remaining.slice(0, count - selected.length));
    }

    return selected.slice(0, count);
  };

  // Fetch preview articles when component mounts or preview is shown
  useEffect(() => {
    if (showPreview && previewArticles.length === 0) {
      setLoading(true);
      fetch('/api/articles-enhanced')
        .then(res => res.json())
        .then((articles: EnhancedArticleData[]) => {
          // Get 3 diverse articles for preview using intelligent selection
          const diverseArticles = selectDiverseArticles(articles, 3);
          setPreviewArticles(diverseArticles);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [showPreview, previewArticles.length]);

  if (isGamePlaying) return null;

  return (
    <Container $visible={true}>
      {/* Preview Card */}
      <PreviewCard $visible={showPreview && !isHovered}>
        <PreviewHeader>
          <PreviewTitle>
            <Star /> Featured Articles
          </PreviewTitle>
          <ToggleButton onClick={() => setShowPreview(false)}>
            <ChevronDown size={18} />
          </ToggleButton>
        </PreviewHeader>

        <PreviewList>
          {loading ? (
            <div style={{ color: '#6b7280', fontSize: '0.875rem', textAlign: 'center', padding: '20px' }}>
              Loading...
            </div>
          ) : (
            previewArticles.map((article, index) => (
              <PreviewItem
                key={article.slug}
                onClick={() => {
                  window.location.href = `/articles/${article.slug}`;
                }}
              >
                <PreviewDot $color={polarityColors[article.polarity || 'N0']} />
                <PreviewItemContent>
                  <PreviewItemTitle>{article.title}</PreviewItemTitle>
                  <PreviewItemMeta>
                    {article.articleType === 'fiction' ? 'Fiction' : 'Research'} • {article.readingTime} min
                  </PreviewItemMeta>
                </PreviewItemContent>
              </PreviewItem>
            ))
          )}
        </PreviewList>

        <ViewAllButton onClick={() => openModal()}>
          <Compass size={18} />
          View All Recommendations
        </ViewAllButton>
      </PreviewCard>

      {/* Main Discovery Button */}
      <MainButton
        $expanded={isHovered}
        onClick={() => {
          if (showPreview) {
            openModal();
          } else {
            setShowPreview(true);
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <PulseRing />
        <Compass />
        {isHovered && <ButtonText>Discover Articles</ButtonText>}
      </MainButton>
    </Container>
  );
}
