import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ArticleContainer from '@/components/ArticleContainer';
import StructuredData from '../../components/StructuredData';
import ArticleClassification, { inferClassificationFromSlug } from '@/components/ArticleClassification';
import CircleNav from '@/components/ui/CircleNav';
import styled, { keyframes, css } from 'styled-components';
import { escapeMdxContent } from '@/lib/utils';
import MarkdownImage from '@/components/ui/MarkdownImage';
import { useArticleDiscovery } from '@/components/ArticleDiscoveryProvider';
import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Star, ArrowRight } from 'lucide-react';
import type { ArticleMediaWithUrl } from '@/types/article-media';
import VideoComponent from '@/components/VideoComponent';
import { createVideoSchema } from '@/components/StructuredData';
import HandwrittenNote from '@/components/ui/HandwrittenNote';
import { TopRecommendation, MidRecommendation, BottomCarousel } from '@/components/ArticleRecommendations';
import ArticleFooterPanels from '@/components/ArticleFooterPanels';
import DeskSurface from '@/components/ui/DeskSurface';
import ArticleImageGallery from '@/components/ui/ArticleImageGallery';
import ArticleVideoPlayer from '@/components/ArticleVideoPlayer';
import { ArtFrame, DepthSection, DepthDivider, EditorialSection } from '@/components/ui/ParallaxArtLayers';
import type { DepthStage } from '@/components/ui/ParallaxArtLayers';
import { discoverArticleImages } from '@/lib/article-images';
import type { MultiArtOption } from '@/lib/article-images';

interface ArticleProps {
  title: string;
  date: string;
  author: string[];
  content: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  heroImage: string | null;
  multiArtImages: MultiArtOption[];
  videoURL?: string;
  articleVideo?: string;
  readingTime: number;
  relatedArticles: Array<{
    slug: string;
    title: string;
    description: string;
    ogImage?: string;
    heroImage: string | null;
  }>;
  slug: string;
}

// ---------------------------------------------------------------------------
// Brutalist Styled Components
// ---------------------------------------------------------------------------

const ArticleLayout = styled.div`
  min-height: 100vh;
  background: #030308;
  overflow-x: clip;
`;

const ArticleWrapper = styled.article<{ $depth?: DepthStage }>`
  position: relative;
  max-width: 860px;
  margin: 0 auto;
  padding: 60px 24px;
  transition: border-color 0.8s ease, color 0.8s ease;

  /* Depth-aware border + text color */
  ${p => (p.$depth === undefined || p.$depth === 0) && css`
    color: #a0a0a0;
    border-left: 6px solid rgba(255, 255, 255, 0.08);
  `}
  ${p => p.$depth === 1 && css`
    color: #c0c0c0;
    border-left: 6px solid rgba(255, 255, 255, 0.15);
  `}
  ${p => p.$depth === 2 && css`
    color: #d8d8d8;
    border-left: 6px solid rgba(0, 212, 255, 0.35);
  `}
  ${p => p.$depth === 3 && css`
    color: #e0e0e0;
    border-left: 6px solid var(--color-cyan-accent, #00d4ff);
  `}

  @media (min-width: 1024px) {
    margin-left: 8%;
    margin-right: auto;
  }

  @media (max-width: 768px) {
    padding: 40px 16px;
    border-left-width: 4px;
  }
`;

const FooterWrapper = styled.div`
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 24px 60px;
  color: #e0e0e0;
  border-left: 6px solid var(--color-cyan-accent, #00d4ff);

  @media (min-width: 1024px) {
    margin-left: 8%;
    margin-right: auto;
  }

  @media (max-width: 768px) {
    padding: 32px 16px 40px;
    border-left-width: 4px;
  }
`;

const HeroImageWrapper = styled.div<{ $depth?: DepthStage }>`
  position: relative;
  width: 100%;
  height: 500px;
  margin-bottom: 48px;
  border-radius: 0;
  overflow: hidden;
  transition: filter 0.8s ease, border-color 0.8s ease;

  ${p => (p.$depth === undefined || p.$depth <= 1) && css`
    border: 2px solid rgba(255, 255, 255, 0.1);
    filter: grayscale(0.8) contrast(1.15);
  `}
  ${p => p.$depth === 2 && css`
    border: 3px solid rgba(0, 212, 255, 0.3);
    filter: grayscale(0.3) saturate(1.1);
  `}
  ${p => p.$depth === 3 && css`
    border: 4px solid var(--color-cyan-accent, #00d4ff);
    filter: none;
  `}

  @media (min-width: 900px) {
    width: 140%;
    margin-left: -20%;
  }

  @media (max-width: 768px) {
    height: 280px;
  }
`;

const ArticleHero = styled.header<{ $depth?: DepthStage }>`
  margin-bottom: 48px;
  padding-bottom: 32px;
  transition: border-color 0.8s ease;

  ${p => (p.$depth === undefined || p.$depth === 0) && css`
    border-bottom: 4px solid rgba(255, 255, 255, 0.06);
  `}
  ${p => p.$depth === 1 && css`
    border-bottom: 4px solid rgba(255, 255, 255, 0.12);
  `}
  ${p => p.$depth === 2 && css`
    border-bottom: 4px solid rgba(0, 212, 255, 0.2);
  `}
  ${p => p.$depth === 3 && css`
    border-bottom: 4px solid rgba(255, 255, 255, 0.15);
  `}
`;

const ArticleTitle = styled.h1<{ $depth?: DepthStage }>`
  font-size: clamp(2.5rem, 6vw, 4.5rem);
  font-weight: 900;
  color: #ffffff;
  margin-bottom: 16px;
  line-height: 1.05;
  letter-spacing: -0.03em;
  text-transform: uppercase;

  &::after {
    content: '';
    display: block;
    width: 120px;
    height: 6px;
    margin-top: 16px;
    transition: background 0.8s ease;

    ${p => (p.$depth === undefined || p.$depth === 0) && css`
      background: rgba(255, 255, 255, 0.15);
    `}
    ${p => p.$depth === 1 && css`
      background: rgba(255, 255, 255, 0.25);
    `}
    ${p => p.$depth === 2 && css`
      background: rgba(0, 212, 255, 0.5);
    `}
    ${p => p.$depth === 3 && css`
      background: var(--color-gold-highlight, #ffd700);
    `}
  }
`;

const ArticleMeta = styled.div<{ $depth?: DepthStage }>`
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  font-size: 0.8rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-top: 24px;
  transition: color 0.8s ease;

  ${p => (p.$depth === undefined || p.$depth <= 1) && css`
    color: rgba(255, 255, 255, 0.4);
  `}
  ${p => p.$depth === 2 && css`
    color: rgba(0, 212, 255, 0.7);
  `}
  ${p => p.$depth === 3 && css`
    color: var(--color-cyan-accent, #00d4ff);
  `}
`;

const MetaItem = styled.span<{ $depth?: DepthStage }>`
  display: flex;
  align-items: center;
  gap: 8px;

  &:before {
    content: '//';
    font-weight: 700;
    transition: color 0.8s ease;

    ${p => (p.$depth === undefined || p.$depth <= 1) && css`
      color: rgba(255, 255, 255, 0.2);
    `}
    ${p => p.$depth === 2 && css`
      color: rgba(255, 215, 0, 0.5);
    `}
    ${p => p.$depth === 3 && css`
      color: var(--color-gold-highlight, #ffd700);
    `}
  }
`;

const ArticleContent = styled.div<{ $depth?: DepthStage }>`
  font-size: 1.15rem;
  line-height: 1.85;

  ${p => (p.$depth === undefined || p.$depth <= 1) && css`
    color: #a8a8a8;
  `}
  ${p => p.$depth === 2 && css`
    color: #c8c8c8;
  `}
  ${p => p.$depth === 3 && css`
    color: #d4d4d4;
  `}

  h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    color: #ffffff;
    margin: 72px 0 24px;
    padding: 12px 0 12px 20px;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    font-weight: 800;
    transition: border-color 0.8s ease;

    ${p => (p.$depth === undefined || p.$depth === 0) && css`
      border-left: 5px solid rgba(255, 255, 255, 0.1);
    `}
    ${p => p.$depth === 1 && css`
      border-left: 5px solid rgba(255, 255, 255, 0.2);
    `}
    ${p => p.$depth === 2 && css`
      border-left: 5px solid rgba(0, 212, 255, 0.4);
    `}
    ${p => p.$depth === 3 && css`
      border-left: 5px solid var(--color-gold-highlight, #ffd700);
    `}
  }

  h3 {
    font-size: 1.4rem;
    margin: 48px 0 16px;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
    transition: color 0.8s ease;

    ${p => (p.$depth === undefined || p.$depth <= 1) && css`
      color: rgba(255, 255, 255, 0.5);
    `}
    ${p => p.$depth === 2 && css`
      color: rgba(0, 212, 255, 0.7);
    `}
    ${p => p.$depth === 3 && css`
      color: var(--color-cyan-accent, #00d4ff);
    `}
  }

  p {
    margin-bottom: 1.6rem;
  }

  a {
    text-decoration: none;
    transition: color 0.2s;

    ${p => (p.$depth === undefined || p.$depth <= 1) && css`
      color: rgba(255, 255, 255, 0.6);
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      &:hover { color: #ffffff; }
    `}
    ${p => p.$depth === 2 && css`
      color: rgba(0, 212, 255, 0.8);
      border-bottom: 2px solid rgba(0, 212, 255, 0.3);
      &:hover { color: var(--color-cyan-accent, #00d4ff); }
    `}
    ${p => p.$depth === 3 && css`
      color: var(--color-cyan-accent, #00d4ff);
      border-bottom: 2px solid var(--color-gold-highlight, #ffd700);
      &:hover { color: var(--color-gold-highlight, #ffd700); }
    `}
  }

  ul, ol {
    margin: 1.5rem 0;
    padding-left: 2rem;
  }

  li {
    margin-bottom: 0.75rem;
  }

  code {
    padding: 3px 8px;
    border-radius: 0;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    font-size: 0.88em;

    ${p => (p.$depth === undefined || p.$depth <= 1) && css`
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `}
    ${p => p.$depth === 2 && css`
      background: rgba(0, 212, 255, 0.06);
      border: 1px solid rgba(0, 212, 255, 0.15);
    `}
    ${p => p.$depth === 3 && css`
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
    `}
  }

  pre:not([data-handwritten]) {
    background: transparent;
    padding: 0;
    margin: 0;
    border: none;
    overflow-x: visible;

    code {
      background: none;
      padding: 0;
      border: none;
    }
  }

  blockquote {
    padding: 16px 24px;
    margin: 2.5rem 0;
    font-style: normal;
    font-weight: 500;
    border-radius: 0;
    transition: border-color 0.8s ease, background 0.8s ease;

    ${p => (p.$depth === undefined || p.$depth <= 1) && css`
      border-left: 5px solid rgba(255, 255, 255, 0.12);
      background: rgba(255, 255, 255, 0.02);
      color: #999;
    `}
    ${p => p.$depth === 2 && css`
      border-left: 5px solid rgba(0, 212, 255, 0.3);
      background: rgba(0, 212, 255, 0.03);
      color: #b8b8b8;
    `}
    ${p => p.$depth === 3 && css`
      border-left: 5px solid var(--color-gold-highlight, #ffd700);
      background: rgba(255, 215, 0, 0.04);
      color: #c8c8c8;
    `}
  }
`;


const ShareButtons = styled.div`
  display: flex;
  gap: 15px;
  margin: 40px 0;
  padding: 20px 0;
  border-top: 3px solid rgba(0, 212, 255, 0.2);
  border-bottom: 3px solid rgba(0, 212, 255, 0.2);
`;

const ShareButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(0, 212, 255, 0.1);
  border: 2px solid rgba(0, 212, 255, 0.3);
  border-radius: 0;
  color: var(--color-cyan-accent, #00d4ff);
  text-decoration: none;
  font-size: 0.85rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(0, 212, 255, 0.2);
    transform: translateY(-2px);
    border-color: var(--color-cyan-accent, #00d4ff);
  }
`;

const InternalLinks = styled.nav<{ $depth?: DepthStage }>`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
  padding: 16px 0;
  font-size: 0.8rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: border-color 0.8s ease, opacity 0.8s ease;

  ${p => (p.$depth === undefined || p.$depth === 0) && css`
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    opacity: 0.4;
  `}
  ${p => p.$depth === 1 && css`
    border-bottom: 2px solid rgba(255, 255, 255, 0.08);
    opacity: 0.6;
  `}
  ${p => p.$depth === 2 && css`
    border-bottom: 2px solid rgba(0, 212, 255, 0.15);
    opacity: 0.8;
  `}
  ${p => p.$depth === 3 && css`
    border-bottom: 3px solid rgba(255, 255, 255, 0.1);
    opacity: 1;
  `}
`;

const InternalLink = styled(Link)<{ $depth?: DepthStage }>`
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 0;
  transition: all 0.2s;

  ${p => (p.$depth === undefined || p.$depth <= 1) && css`
    color: rgba(255, 255, 255, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    &:hover {
      color: rgba(255, 255, 255, 0.6);
      border-color: rgba(255, 255, 255, 0.15);
    }
  `}
  ${p => p.$depth === 2 && css`
    color: rgba(0, 212, 255, 0.6);
    border: 1px solid rgba(0, 212, 255, 0.15);
    background: rgba(0, 212, 255, 0.03);
    &:hover {
      background: rgba(0, 212, 255, 0.1);
      border-color: rgba(0, 212, 255, 0.4);
    }
  `}
  ${p => p.$depth === 3 && css`
    color: var(--color-cyan-accent, #00d4ff);
    border: 1px solid rgba(0, 212, 255, 0.2);
    background: rgba(0, 212, 255, 0.05);
    &:hover {
      background: rgba(0, 212, 255, 0.15);
      border-color: var(--color-cyan-accent, #00d4ff);
    }
  `}
`;

// Discovery Section Styles
const shimmerEffect = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const DiscoverSection = styled.section`
  margin: 40px 0;
  padding: 40px;
  background: rgba(0, 212, 255, 0.05);
  border: 3px solid rgba(0, 212, 255, 0.25);
  border-radius: 0;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, #00d4ff, #ffd700, #00d4ff);
    background-size: 200% 100%;
    animation: ${shimmerEffect} 3s linear infinite;
  }
`;

const DiscoverContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  @media (max-width: 768px) {
    flex-direction: column;
    text-align: center;
  }
`;

const DiscoverLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const DiscoverIcon = styled.div`
  width: 64px;
  height: 64px;
  border-radius: 0;
  background: linear-gradient(135deg, #00d4ff 0%, #ffd700 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 32px;
    height: 32px;
    color: #030308;
  }
`;

const DiscoverText = styled.div`
  h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  p {
    font-size: 1rem;
    color: #9ca3af;
    margin: 0;
    max-width: 400px;
  }
`;

const DiscoverButton = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 32px;
  background: linear-gradient(135deg, #00d4ff 0%, #ffd700 100%);
  border: none;
  border-radius: 0;
  color: #030308;
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(0, 212, 255, 0.4);

    &::before {
      left: 100%;
    }
  }

  svg {
    width: 20px;
    height: 20px;
    transition: transform 0.3s ease;
  }

  &:hover svg:last-child {
    transform: translateX(4px);
  }
`;

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const ArticlePage: NextPage<ArticleProps> = ({
  title,
  date,
  author,
  content,
  description,
  keywords,
  ogImage,
  heroImage,
  multiArtImages,
  videoURL,
  articleVideo,
  readingTime,
  relatedArticles,
  slug
}) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alexwelcing.com';
  const articleUrl = `${siteUrl}/articles/${slug}`;
  const defaultOgImage = `${siteUrl}/og-default.png`;
  const fullOgImage = ogImage ? (ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`) : defaultOgImage;

  const { openModal, setCurrentArticle } = useArticleDiscovery();

  useEffect(() => {
    setCurrentArticle({
      slug,
      filename: `${slug}.mdx`,
      title,
      date,
      author,
      description,
      keywords,
      ogImage,
      readingTime,
      wordCount: content.split(/\s+/).length,
      articleType: 'fiction',
    });
  }, [slug, title, date, author, description, keywords, ogImage, readingTime, content, setCurrentArticle]);

  // Fetch article videos from Supabase media storage
  const [articleVideos, setArticleVideos] = useState<ArticleMediaWithUrl[]>([]);
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.success && data.media) {
          setArticleVideos(
            data.media.filter((m: ArticleMediaWithUrl) => m.media_type === 'video' && m.status === 'ready')
          );
        }
      } catch {
        // Videos are optional — fail silently
      }
    };
    fetchVideos();
  }, [slug]);

  const primaryVideo = articleVideos[0] || null;

  /* -------------------------------------------------------------------
     Split markdown content at ## headings to interleave with parallax.
     We get chunks like: [intro text, "## Heading\ntext", "## Heading\ntext", ...]
     ------------------------------------------------------------------- */
  const contentChunks = useMemo(() => {
    // Split on lines that start with "## " (h2 headings)
    const parts = content.split(/(?=^## )/m);
    // Filter out empty parts
    return parts.filter(p => p.trim().length > 0);
  }, [content]);

  // Distribute chunks across sections — we want at least 2 chunks in the
  // opening section, then 1–2 chunks per editorial/parallax break
  const sections = useMemo(() => {
    if (contentChunks.length <= 2) {
      // Short article: don't split, render as one block
      return [{ chunks: contentChunks, type: 'full' as const }];
    }

    const result: Array<{
      chunks: string[];
      type: 'intro' | 'editorial-left' | 'editorial-right' | 'closing';
    }> = [];

    // First ~40% of chunks go in the intro section
    const introEnd = Math.max(1, Math.ceil(contentChunks.length * 0.35));
    result.push({ chunks: contentChunks.slice(0, introEnd), type: 'intro' });

    // Distribute remaining chunks across editorial sections
    const remaining = contentChunks.slice(introEnd);
    const midpoint = Math.ceil(remaining.length / 2);

    if (remaining.length > 0) {
      result.push({
        chunks: remaining.slice(0, midpoint),
        type: 'editorial-left',
      });
    }
    if (remaining.length > midpoint) {
      result.push({
        chunks: remaining.slice(midpoint),
        type: 'editorial-right',
      });
    }

    return result;
  }, [contentChunks]);

  const mdComponents = useMemo(() => ({
    img: MarkdownImage as any,
    pre: ({ children }: React.HTMLAttributes<HTMLPreElement> & { children?: React.ReactNode }) => (
      <HandwrittenNote>
        {React.isValidElement(children)
          ? (children.props as { children?: React.ReactNode }).children
          : children}
      </HandwrittenNote>
    ),
  }), []);

  return (
    <ArticleLayout>
      <Head>
        <title>{title} | Alex Welcing</title>
        <meta name="title" content={title} />
        <meta name="description" content={description || `Read ${title} and more insights.`} />
        {keywords && <meta name="keywords" content={keywords.join(', ')} />}
        <meta name="author" content={author.join(', ')} />

        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description || `Read ${title}`} />
        <meta property="og:image" content={fullOgImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="article:published_time" content={date} />
        <meta property="article:author" content={author.join(', ')} />

        {/* Video meta tags for social sharing */}
        {primaryVideo && (
          <>
            <meta property="og:video" content={primaryVideo.public_url} />
            <meta property="og:video:type" content={primaryVideo.mime_type || 'video/mp4'} />
            {primaryVideo.width && <meta property="og:video:width" content={String(primaryVideo.width)} />}
            {primaryVideo.height && <meta property="og:video:height" content={String(primaryVideo.height)} />}
          </>
        )}

        {primaryVideo ? (
          <>
            <meta name="twitter:card" content="player" />
            <meta name="twitter:site" content="@alexwelcing" />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description || `Read ${title}`} />
            <meta name="twitter:player" content={articleUrl} />
            {primaryVideo.width && <meta name="twitter:player:width" content={String(primaryVideo.width)} />}
            {primaryVideo.height && <meta name="twitter:player:height" content={String(primaryVideo.height)} />}
            <meta name="twitter:image" content={primaryVideo.thumbnail_url || fullOgImage} />
          </>
        ) : (
          <>
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:site" content="@alexwelcing" />
            <meta property="twitter:url" content={articleUrl} />
            <meta property="twitter:title" content={title} />
            <meta property="twitter:description" content={description || `Read ${title}`} />
            <meta property="twitter:image" content={fullOgImage} />
          </>
        )}

        <meta name="theme-color" content="#030308" />
        {heroImage && <link rel="preload" as="image" href={heroImage} />}
        <link rel="canonical" href={articleUrl} />
      </Head>

      <StructuredData
        type="Article"
        data={{
          headline: title,
          description: description,
          image: fullOgImage,
          datePublished: date,
          dateModified: date,
          url: articleUrl,
          articleSection: 'Speculative AI Research',
          author: author.map(name => ({
            '@type': 'Person',
            name: name,
            url: `${siteUrl}/about`
          })),
          publisher: {
            '@type': 'Organization',
            name: 'Alex Welcing',
            url: siteUrl,
            logo: {
              '@type': 'ImageObject',
              url: `${siteUrl}/logo.png`
            }
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': articleUrl
          }
        }}
      />

      {/* VideoObject structured data for Google Video indexing */}
      {primaryVideo && (
        <StructuredData
          type="VideoObject"
          data={createVideoSchema({
            name: primaryVideo.title || `${title} — Video`,
            description: primaryVideo.caption || description || title,
            thumbnailUrl: primaryVideo.thumbnail_url || fullOgImage,
            contentUrl: primaryVideo.public_url,
            uploadDate: primaryVideo.created_at || date,
            duration: primaryVideo.duration_seconds,
            articleUrl,
          })}
        />
      )}

      <CircleNav />

      {/* ================================================================
          DEPTH 0 — THE SURFACE
          Pure brutalist. Black void. White text. No color. No decoration.
          The article begins as a clinical document, a blank page.
          ================================================================ */}
      <DepthSection depth={0}>
        <DeskSurface articleSlug={slug} />
        <ArticleWrapper $depth={0}>
          <ArticleHero $depth={0}>
            {heroImage && (
              <HeroImageWrapper $depth={0}>
                <Image
                  src={heroImage}
                  alt={title}
                  fill
                  style={{ objectFit: 'cover' }}
                  priority
                  sizes="(max-width: 768px) 100vw, 1200px"
                />
              </HeroImageWrapper>
            )}
            <ArticleTitle $depth={0}>{title}</ArticleTitle>
            <ArticleMeta $depth={0}>
              <MetaItem $depth={0}>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</MetaItem>
              <MetaItem $depth={0}>{author.join(', ')}</MetaItem>
              <MetaItem $depth={0}>{readingTime} min read</MetaItem>
            </ArticleMeta>
          </ArticleHero>

          {articleVideo && (
            <ArticleVideoPlayer src={articleVideo} title={title} />
          )}

          <InternalLinks $depth={0} aria-label="Related navigation">
            <InternalLink $depth={0} href="/speculative-ai">Speculative AI Hub</InternalLink>
            <InternalLink $depth={0} href="/agent-futures">Agent Futures</InternalLink>
            <InternalLink $depth={0} href="/emergent-intelligence">Emergent Intelligence</InternalLink>
            <InternalLink $depth={0} href="/about">About</InternalLink>
          </InternalLinks>

          <ArticleClassification {...inferClassificationFromSlug(slug)} />

          <TopRecommendation slug={slug} />

          {/* Generated article video (from Supabase media storage) */}
          {primaryVideo && (
            <VideoComponent
              videoSrc={primaryVideo.public_url}
              poster={primaryVideo.thumbnail_url}
              title={primaryVideo.title || `${title} — Video`}
              description={primaryVideo.caption}
              width={primaryVideo.width}
              height={primaryVideo.height}
            />
          )}

          {/* Additional article videos */}
          {articleVideos.slice(1).map((video) => (
            <VideoComponent
              key={video.id}
              videoSrc={video.public_url}
              poster={video.thumbnail_url}
              title={video.title}
              description={video.caption}
              width={video.width}
              height={video.height}
            />
          ))}

          {/* YouTube embed (legacy frontmatter videoURL) */}
          {videoURL && (
            <div style={{ margin: '2rem 0' }}>
              <iframe
                width="100%"
                height="450"
                src={videoURL.replace('watch?v=', 'embed/')}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${title} — YouTube video`}
                style={{ borderRadius: '0' }}
              />
            </div>
          )}

          <ArticleContent $depth={0}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {sections[0]?.chunks.join('\n\n') || content}
            </ReactMarkdown>
          </ArticleContent>
        </ArticleWrapper>
      </DepthSection>

      {/* ================================================================
          DEPTH 1 — FIRST CRACKS
          The first artwork appears, desaturated. Faint hairlines emerge.
          Something stirs beneath the surface.
          ================================================================ */}
      {multiArtImages[0] && (
        <DepthSection depth={1}>
          <DepthDivider depth={1} />
          <ArtFrame
            image={multiArtImages[0]}
            depth={1}
            height="70vh"
            mobileHeight="40vh"
            priority
          />
        </DepthSection>
      )}

      {sections.length > 1 && (
        <DepthSection depth={1}>
          {multiArtImages[1] ? (
            <EditorialSection
              image={multiArtImages[1]}
              imagePosition="left"
              depth={1}
            >
              <ArticleContent $depth={1}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {sections[1].chunks.join('\n\n')}
                </ReactMarkdown>
              </ArticleContent>
            </EditorialSection>
          ) : (
            <ArticleWrapper $depth={1}>
              <ArticleContent $depth={1}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {sections[1].chunks.join('\n\n')}
                </ReactMarkdown>
              </ArticleContent>
            </ArticleWrapper>
          )}
        </DepthSection>
      )}

      {/* Mid-article recommendation — editorial break between sections */}
      {sections.length > 2 && (
        <DepthSection depth={1}>
          <MidRecommendation slug={slug} />
        </DepthSection>
      )}

      {/* ================================================================
          DEPTH 2 — AWAKENING
          Color bleeds in. Cyan accents appear. The image gains saturation.
          The world is no longer monochrome.
          ================================================================ */}
      {multiArtImages[1] && (
        <DepthSection depth={2}>
          <DepthDivider depth={2} />
          <ArtFrame
            image={multiArtImages[1]}
            depth={2}
            height="60vh"
            mobileHeight="35vh"
          />
        </DepthSection>
      )}

      {sections.length > 2 && (
        <DepthSection depth={2}>
          {multiArtImages[2] ? (
            <EditorialSection
              image={multiArtImages[2]}
              imagePosition="right"
              depth={2}
            >
              <ArticleContent $depth={2}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {sections[2].chunks.join('\n\n')}
                </ReactMarkdown>
              </ArticleContent>
            </EditorialSection>
          ) : (
            <ArticleWrapper $depth={2}>
              <ArticleContent $depth={2}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {sections[2].chunks.join('\n\n')}
                </ReactMarkdown>
              </ArticleContent>
            </ArticleWrapper>
          )}
        </DepthSection>
      )}

      {/* ================================================================
          DEPTH 3 — WONDERLAND
          Full bloom. Gold highlights, saturated art, lush color. The
          gallery, the discovery section, the full experience.
          ================================================================ */}
      {multiArtImages.length > 0 && (
        <DepthSection depth={3}>
          <DepthDivider depth={3} />
          <ArtFrame
            image={multiArtImages[Math.min(multiArtImages.length - 1, 2)]}
            depth={3}
            height="50vh"
            mobileHeight="30vh"
          />
        </DepthSection>
      )}

      {multiArtImages.length > 0 && (
        <DepthSection depth={3}>
          <ArticleWrapper $depth={3}>
            <ArticleImageGallery images={multiArtImages} articleTitle={title} />
          </ArticleWrapper>
        </DepthSection>
      )}

      <DepthSection depth={3}>
        <FooterWrapper>
          <ShareButtons>
            <ShareButton
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Share on X
            </ShareButton>
            <ShareButton
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              Share on LinkedIn
            </ShareButton>
          </ShareButtons>

          <DiscoverSection>
            <DiscoverContent>
              <DiscoverLeft>
                <DiscoverIcon>
                  <Compass />
                </DiscoverIcon>
                <DiscoverText>
                  <h3>Discover Related Articles</h3>
                  <p>Explore more scenarios and research based on similar themes, timelines, and perspectives.</p>
                </DiscoverText>
              </DiscoverLeft>
              <DiscoverButton onClick={() => openModal()}>
                <Star />
                Explore Recommendations
                <ArrowRight />
              </DiscoverButton>
            </DiscoverContent>
          </DiscoverSection>

          <BottomCarousel slug={slug} />
        </FooterWrapper>
      </DepthSection>

      <DepthSection depth={3}>
        <ArticleFooterPanels articleTitle={title} />
      </DepthSection>
    </ArticleLayout>
  );
};


export const getStaticPaths: GetStaticPaths = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);
  const paths = filenames
    .filter((filename) => filename.endsWith('.mdx'))
    .map((filename) => ({
      params: { slug: filename.replace('.mdx', '') },
    }));
  return { paths, fallback: false };
};

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

function resolveExistingPublicImage(candidate: unknown): string | null {
  if (typeof candidate !== 'string' || !candidate.startsWith('/')) {
    return null;
  }

  const diskPath = path.join(process.cwd(), 'public', candidate.replace(/^\//, ''));
  return fs.existsSync(diskPath) ? candidate : null;
}

interface ArticleSummary {
  slug: string;
  title: string;
  description?: string;
  date: string;
  ogImage?: string;
}

function getRelatedArticles(currentSlug: string, allArticles: ArticleSummary[], limit = 3) {
  return allArticles
    .filter(article => article.slug !== currentSlug)
    .slice(0, limit)
    .map(article => ({
      slug: article.slug,
      title: article.title,
      description: article.description || `Read more about ${article.title}`,
      ogImage: article.ogImage
    }));
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string };
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const articleFilePath = path.join(articleFolderPath, `${slug}.mdx`);
  const fileContents = fs.readFileSync(articleFilePath, 'utf8');
  const { data, content } = matter(fileContents);
  const escapedContent = escapeMdxContent(content);

  const filenames = fs.readdirSync(articleFolderPath);
  const allArticles = filenames
    .filter(filename => filename.endsWith('.mdx'))
    .map(filename => {
      const filePath = path.join(articleFolderPath, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContents);
      const relatedSlug = filename.replace('.mdx', '');
      const relatedImages = discoverArticleImages(relatedSlug);
      return {
        slug: relatedSlug,
        title: data.title,
        description: data.description,
        date: data.date,
        ogImage: resolveExistingPublicImage(data.ogImage) || relatedImages.ogImage || relatedImages.heroImage || undefined
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const readingTime = calculateReadingTime(content);
  const baseRelated = getRelatedArticles(slug, allArticles);
  const relatedArticles = baseRelated.map(article => ({
    ...article,
    heroImage: discoverArticleImages(article.slug).heroImage,
  }));

  const images = discoverArticleImages(slug);
  const resolvedOgImage =
    resolveExistingPublicImage(data.ogImage) ||
    images.ogImage ||
    images.heroImage ||
    images.thumbnail ||
    '';

  const videoPath = `/images/article-videos/${slug}.mp4`;
  const videoExists = fs.existsSync(path.join(process.cwd(), 'public', videoPath));

  return {
    props: {
      title: data.title as string,
      date: (data.date instanceof Date ? data.date.toISOString() : data.date) as string,
      author: Array.isArray(data.author) ? (data.author as string[]) : ([data.author] as string[]),
      description: data.description || '',
      keywords: data.keywords || [],
      ogImage: resolvedOgImage,
      heroImage: images.heroImage,
      multiArtImages: images.multiArt,
      videoURL: data.videoURL || '',
      articleVideo: videoExists ? videoPath : '',
      content: escapedContent,
      readingTime,
      relatedArticles,
      slug,
    },
  };
};

export default ArticlePage;
