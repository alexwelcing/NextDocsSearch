'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styled, { keyframes, css } from 'styled-components';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

// ---------------------------------------------------------------------------
// Shared types & data hook
// ---------------------------------------------------------------------------

interface ScoredRecommendation {
  slug: string;
  score: number;
}

interface Recommendations {
  similar: ScoredRecommendation[];
  horizon: ScoredRecommendation[];
  polarity: ScoredRecommendation[];
  mechanics: ScoredRecommendation[];
  trending: ScoredRecommendation[];
}

interface ResolvedRec {
  slug: string;
  title: string;
  description?: string;
  heroImage?: string;
  ogImage?: string;
  score: number;
}

function useRecommendations(slug: string | undefined) {
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [articles, setArticles] = useState<EnhancedArticleData[]>([]);
  const fetchedSlug = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!slug || slug === fetchedSlug.current) return;
    fetchedSlug.current = slug;

    const recUrl = `/api/articles/recommendations?slug=${encodeURIComponent(slug)}`;
    Promise.all([
      fetch(recUrl).then(r => r.json()),
      fetch('/api/articles-enhanced').then(r => r.json()),
    ]).then(([recData, articleData]) => {
      if (recData?.similar) setRecs(recData);
      if (Array.isArray(articleData)) setArticles(articleData);
    }).catch(() => {});
  }, [slug]);

  const articleMap = useMemo(() => {
    const m = new Map<string, EnhancedArticleData>();
    for (const a of articles) m.set(a.slug, a);
    return m;
  }, [articles]);

  const resolve = useCallback(
    (scored: ScoredRecommendation[], limit: number): ResolvedRec[] => {
      if (!scored || articleMap.size === 0) return [];
      return scored.slice(0, limit).flatMap(s => {
        const a = articleMap.get(s.slug);
        if (!a) return [];
        return [{
          slug: a.slug,
          title: a.title,
          description: a.description,
          heroImage: a.heroImage,
          ogImage: a.ogImage,
          score: s.score,
        }];
      });
    },
    [articleMap]
  );

  return { recs, resolve, ready: recs !== null && articleMap.size > 0 };
}

// ---------------------------------------------------------------------------
// 1. TopRecommendation — compact inline card after the hero
// ---------------------------------------------------------------------------

const TopWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  margin-bottom: 32px;
  background: rgba(0, 212, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.12);
  border-left: 3px solid rgba(0, 212, 255, 0.4);
  transition: border-color 0.3s, background 0.3s;

  &:hover {
    border-color: rgba(0, 212, 255, 0.5);
    background: rgba(0, 212, 255, 0.06);
  }

  @media (max-width: 600px) {
    gap: 12px;
    padding: 12px 14px;
  }
`;

const TopThumb = styled.div`
  position: relative;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  overflow: hidden;
  background: #0a0a1a;

  @media (max-width: 600px) {
    width: 48px;
    height: 48px;
  }
`;

const TopMeta = styled.div`
  flex: 1;
  min-width: 0;
`;

const TopLabel = styled.span`
  display: block;
  font-size: 0.65rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(0, 212, 255, 0.6);
  margin-bottom: 4px;
`;

const TopTitle = styled.span`
  display: block;
  font-size: 0.9rem;
  font-weight: 700;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TopScore = styled.span`
  font-size: 0.7rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  color: rgba(0, 212, 255, 0.8);
  flex-shrink: 0;
`;

const TopLink = styled(Link)`
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;

  @media (max-width: 600px) {
    gap: 12px;
  }
`;

export function TopRecommendation({ slug }: { slug: string }) {
  const { recs, resolve, ready } = useRecommendations(slug);
  const top = useMemo(() => {
    if (!ready || !recs) return null;
    const resolved = resolve(recs.similar, 1);
    return resolved[0] || null;
  }, [ready, recs, resolve]);

  if (!top) return null;

  const img = top.heroImage || top.ogImage;

  return (
    <TopWrap>
      <TopLink href={`/articles/${top.slug}`}>
        {img && (
          <TopThumb>
            <Image src={img} alt="" fill style={{ objectFit: 'cover' }} sizes="64px" />
          </TopThumb>
        )}
        <TopMeta>
          <TopLabel>{'// Top Match'}</TopLabel>
          <TopTitle>{top.title}</TopTitle>
        </TopMeta>
        <TopScore>{top.score}%</TopScore>
      </TopLink>
    </TopWrap>
  );
}

// ---------------------------------------------------------------------------
// 2. MidRecommendation — editorial break between content sections
// ---------------------------------------------------------------------------

const MidWrap = styled.div`
  max-width: 860px;
  margin: 0 auto;
  padding: 0 24px;

  @media (min-width: 1024px) {
    margin-left: 8%;
    margin-right: auto;
  }

  @media (max-width: 768px) {
    padding: 0 16px;
  }
`;

const MidCard = styled(Link)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  text-decoration: none;
  border: 2px solid rgba(0, 212, 255, 0.15);
  border-left: 4px solid rgba(0, 212, 255, 0.5);
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;

  &:hover {
    border-color: rgba(0, 212, 255, 0.4);
    box-shadow: 0 8px 32px rgba(0, 212, 255, 0.1);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const MidImage = styled.div`
  position: relative;
  min-height: 220px;
  background: #0a0a1a;

  @media (max-width: 768px) {
    min-height: 180px;
  }
`;

const MidBody = styled.div`
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
`;

const MidLabel = styled.span`
  font-size: 0.65rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(0, 212, 255, 0.6);
  margin-bottom: 10px;
`;

const MidTitle = styled.span`
  display: block;
  font-size: 1.25rem;
  font-weight: 800;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: -0.01em;
  line-height: 1.2;
  margin-bottom: 8px;
`;

const MidDesc = styled.span`
  display: block;
  font-size: 0.85rem;
  color: #9ca3af;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 14px;
`;

const MidFooter = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  color: rgba(0, 212, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.06em;

  svg { width: 14px; height: 14px; }
`;

export function MidRecommendation({ slug }: { slug: string }) {
  const { recs, resolve, ready } = useRecommendations(slug);
  const pick = useMemo(() => {
    if (!ready || !recs) return null;
    // Use 2nd similar match (1st is shown at top)
    const resolved = resolve(recs.similar, 2);
    return resolved[1] || resolved[0] || null;
  }, [ready, recs, resolve]);

  if (!pick) return null;
  const img = pick.heroImage || pick.ogImage;

  return (
    <MidWrap>
      <MidCard href={`/articles/${pick.slug}`}>
        {img && (
          <MidImage>
            <Image src={img} alt="" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 430px" />
          </MidImage>
        )}
        <MidBody>
          <MidLabel>{'// Continue exploring'}</MidLabel>
          <MidTitle>{pick.title}</MidTitle>
          {pick.description && <MidDesc>{pick.description}</MidDesc>}
          <MidFooter>
            {pick.score}% match
            <ArrowRight />
            Read article
          </MidFooter>
        </MidBody>
      </MidCard>
    </MidWrap>
  );
}

// ---------------------------------------------------------------------------
// 3. BottomCarousel — image-forward lazy-load carousel
// ---------------------------------------------------------------------------

const CarouselSection = styled.section`
  position: relative;
  padding: 48px 0 0;
  margin-top: 40px;

  /* The power-move separator: hard gradient that visually ends the article
     text and starts the visual carousel zone */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: linear-gradient(90deg,
      rgba(0, 212, 255, 0.6),
      rgba(255, 215, 0, 0.5),
      rgba(0, 212, 255, 0.6)
    );
  }
`;

const CarouselHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
`;

const CarouselTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 800;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
`;

const CarouselNav = styled.div`
  display: flex;
  gap: 8px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavBtn = styled.button`
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 212, 255, 0.08);
  border: 1px solid rgba(0, 212, 255, 0.2);
  color: rgba(0, 212, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.5);
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  svg { width: 18px; height: 18px; }
`;

const Track = styled.div`
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;

  /* hide scrollbar */
  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }
`;

const slideUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const Card = styled(Link)`
  position: relative;
  flex: 0 0 280px;
  height: 370px;
  scroll-snap-align: start;
  overflow: hidden;
  text-decoration: none;
  border: 2px solid rgba(255, 255, 255, 0.06);
  transition: border-color 0.3s, transform 0.3s;
  animation: ${slideUp} 0.4s ease both;

  &:hover {
    border-color: rgba(0, 212, 255, 0.4);
    transform: translateY(-4px);
  }

  @media (max-width: 600px) {
    flex: 0 0 240px;
    height: 320px;
  }
`;

const CardImage = styled.div`
  position: absolute;
  inset: 0;
  background: #0a0a1a;
`;

/* The power move: a strong bottom gradient that makes the title
   pop off the image and creates a hard visual floor. Text never
   blends into the image because this gradient owns the separation. */
const CardOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(3, 3, 8, 0.95) 0%,
    rgba(3, 3, 8, 0.7) 35%,
    rgba(3, 3, 8, 0.1) 60%,
    transparent 100%
  );
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 20px;
`;

const CardScore = styled.span`
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 0.65rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: rgba(0, 212, 255, 0.9);
  letter-spacing: 0.06em;
`;

const CardTitle = styled.span`
  font-size: 1rem;
  font-weight: 800;
  color: #ffffff;
  text-transform: uppercase;
  letter-spacing: 0.01em;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardArrow = styled.span`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 0.7rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  color: rgba(0, 212, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.08em;

  svg { width: 12px; height: 12px; }
`;

export function BottomCarousel({ slug }: { slug: string }) {
  const { recs, resolve, ready } = useRecommendations(slug);
  const trackRef = useRef<HTMLDivElement>(null);

  const items = useMemo(() => {
    if (!ready || !recs) return [];
    // Mix similar + trending + horizon for variety, dedup
    const seen = new Set<string>();
    const result: ResolvedRec[] = [];
    for (const list of [recs.similar, recs.trending, recs.horizon]) {
      for (const rec of resolve(list, 10)) {
        if (!seen.has(rec.slug) && (rec.heroImage || rec.ogImage)) {
          seen.add(rec.slug);
          result.push(rec);
        }
        if (result.length >= 12) break;
      }
      if (result.length >= 12) break;
    }
    return result;
  }, [ready, recs, resolve]);

  const scroll = useCallback((dir: number) => {
    trackRef.current?.scrollBy({ left: dir * 296, behavior: 'smooth' });
  }, []);

  if (items.length < 3) return null;

  return (
    <CarouselSection>
      <CarouselHeader>
        <CarouselTitle>Keep Reading</CarouselTitle>
        <CarouselNav>
          <NavBtn onClick={() => scroll(-1)} aria-label="Scroll left">
            <ChevronLeft />
          </NavBtn>
          <NavBtn onClick={() => scroll(1)} aria-label="Scroll right">
            <ChevronRight />
          </NavBtn>
        </CarouselNav>
      </CarouselHeader>

      <Track ref={trackRef}>
        {items.map((item, i) => (
          <Card
            key={item.slug}
            href={`/articles/${item.slug}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <CardImage>
              <Image
                src={(item.heroImage || item.ogImage)!}
                alt={item.title}
                fill
                style={{ objectFit: 'cover' }}
                sizes="280px"
                loading="lazy"
              />
            </CardImage>
            <CardOverlay>
              <CardScore>{item.score}%</CardScore>
              <CardTitle>{item.title}</CardTitle>
              <CardArrow>
                Read <ArrowRight />
              </CardArrow>
            </CardOverlay>
          </Card>
        ))}
      </Track>
    </CarouselSection>
  );
}
