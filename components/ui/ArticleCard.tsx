import React from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

const Card = styled(Link)`
  display: block;
  background: rgba(10, 10, 26, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 20px;
  text-decoration: none;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, #00d4ff, #ffd700);
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  &:hover {
    border-color: rgba(0, 212, 255, 0.25);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

    &::before {
      opacity: 1;
    }
  }
`;

const Title = styled.h3`
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Description = styled.p`
  color: #9ca3af;
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 0.75rem;
  color: #6b7280;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Badge = styled.span<{ $variant?: 'horizon' | 'polarity' | 'mechanic' | 'domain' | 'research' | 'fiction' }>`
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.3px;

  ${({ $variant }) => {
    switch ($variant) {
      case 'horizon':
        return `
          background: rgba(99, 102, 241, 0.2);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.3);
        `;
      case 'polarity':
        return `
          background: rgba(222, 126, 162, 0.2);
          color: #de7ea2;
          border: 1px solid rgba(222, 126, 162, 0.3);
        `;
      case 'mechanic':
        return `
          background: rgba(16, 185, 129, 0.15);
          color: #6ee7b7;
          border: 1px solid rgba(16, 185, 129, 0.3);
        `;
      case 'research':
        return `
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.4);
        `;
      case 'fiction':
        return `
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
          border: 1px solid rgba(168, 85, 247, 0.4);
        `;
      case 'domain':
      default:
        return `
          background: rgba(156, 163, 175, 0.1);
          color: #9ca3af;
          border: 1px solid rgba(156, 163, 175, 0.2);
        `;
    }
  }}
`;

const horizonLabels: Record<string, string> = {
  NQ: 'Now',
  NY: '1 Year',
  N5: '5 Years',
  N20: '20 Years',
  N50: '50 Years',
  N100: '100 Years',
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

const mechanicLabels: Record<string, string> = {
  'labor-substitution': 'Labor',
  'discovery-compression': 'Discovery',
  'control-governance': 'Governance',
  'epistemic-drift': 'Epistemic',
  'scarcity-inversion': 'Scarcity',
  'security-adversarial': 'Security',
  'biological-convergence': 'Bio',
  'market-restructuring': 'Markets',
  'agency-multiplication': 'Agents',
  'alignment-incentives': 'Alignment',
};

const articleTypeLabels: Record<string, string> = {
  fiction: 'Fiction',
  research: 'Research',
};

interface ArticleCardProps {
  article: EnhancedArticleData;
  compact?: boolean;
}

export default function ArticleCard({ article, compact = false }: ArticleCardProps) {
  const formattedDate = article.date
    ? new Date(article.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

  return (
    <Card href={`/articles/${article.slug}`}>
      <Title>{article.title}</Title>

      {!compact && article.description && (
        <Description>{article.description}</Description>
      )}

      <Meta>
        {formattedDate && <MetaItem>{formattedDate}</MetaItem>}
        {article.author?.[0] && (
          <>
            <span>•</span>
            <MetaItem>{article.author[0]}</MetaItem>
          </>
        )}
        {article.readingTime > 0 && (
          <>
            <span>•</span>
            <MetaItem>{article.readingTime} min read</MetaItem>
          </>
        )}
      </Meta>

      <BadgeRow>
        {article.articleType && (
          <Badge $variant={article.articleType === 'research' ? 'research' : 'fiction'}>
            {articleTypeLabels[article.articleType] || article.articleType}
          </Badge>
        )}
        {article.horizon && (
          <Badge $variant="horizon">{horizonLabels[article.horizon] || article.horizon}</Badge>
        )}
        {article.polarity && article.polarity !== 'N0' && (
          <Badge $variant="polarity">{polarityLabels[article.polarity] || article.polarity}</Badge>
        )}
        {article.mechanics?.slice(0, 2).map((mechanic) => (
          <Badge key={mechanic} $variant="mechanic">
            {mechanicLabels[mechanic] || mechanic}
          </Badge>
        ))}
        {!compact && article.domains?.slice(0, 2).map((domain) => (
          <Badge key={domain} $variant="domain">{domain}</Badge>
        ))}
      </BadgeRow>
    </Card>
  );
}
