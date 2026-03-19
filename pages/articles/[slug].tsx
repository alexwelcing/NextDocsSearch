import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StructuredData from '../../components/StructuredData';
import ArticleClassification, { inferClassificationFromSlug } from '@/components/ArticleClassification';
import CircleNav from '@/components/ui/CircleNav';
import styled, { css } from 'styled-components';
import { escapeMdxContent } from '@/lib/utils';
import MarkdownImage from '@/components/ui/MarkdownImage';
import { useArticleDiscovery } from '@/components/ArticleDiscoveryProvider';
import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Star, ArrowRight } from 'lucide-react';
import type { ArticleMediaWithUrl } from '@/types/article-media';
import VideoComponent from '@/components/VideoComponent';
import { createVideoSchema } from '@/components/StructuredData';
import HandwrittenNote from '@/components/ui/HandwrittenNote';
import { BottomCarousel } from '@/components/ArticleRecommendations';
import ArticleFooterPanels from '@/components/ArticleFooterPanels';
import { discoverArticleImages } from '@/lib/article-images';
import { SITE_URL } from '@/lib/site-url';
import type { MultiArtOption } from '@/lib/article-images';
import { useSupabaseData } from '@/components/contexts/SupabaseDataContext';
import { buildStoryCompanion } from '@/lib/articles/storyCompanion';
import StoryConstellationPreview from '@/components/articles/StoryConstellationPreview';
import { getRelatedArticles } from '@/lib/articles/cache';

interface ArticleProps {
  title: string;
  date: string;
  author: string[];
  content: string;
  articleType: 'fiction' | 'research';
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

// =============================================================================
// NEW EDITORIAL LAYOUT - Confident, cohesive design
// =============================================================================

const ArticleLayout = styled.div`
  min-height: 100vh;
  background: #030308;
  overflow-x: hidden;
`;

// Hero Section - Bold cinematic opening
const HeroSection = styled.header<{ $hasImage: boolean }>`
  position: relative;
  min-height: ${p => p.$hasImage ? '85vh' : '50vh'};
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 48px 24px 64px;
  margin-bottom: 32px;

  @media (min-width: 768px) {
    padding: 64px 48px 80px;
  }

  @media (min-width: 1200px) {
    padding: 80px 8vw 96px;
  }
`;

const HeroBackground = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(3, 3, 8, 0.2) 0%,
      rgba(3, 3, 8, 0.5) 40%,
      rgba(3, 3, 8, 0.85) 70%,
      #030308 100%
    );
  }

  img {
    object-fit: cover;
    width: 100%;
    height: 100%;
  }
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 900px;
`;

const ArticleTitle = styled.h1`
  font-size: clamp(2.25rem, 7vw, 4.5rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin: 0 0 24px;
  text-transform: uppercase;

  &::after {
    content: '';
    display: block;
    width: 100px;
    height: 4px;
    background: linear-gradient(90deg, #00d4ff, #ffd700);
    margin-top: 20px;
  }
`;

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-size: 0.8rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.6);

  span {
    display: flex;
    align-items: center;
    gap: 8px;

    &::before {
      content: '//';
      color: rgba(255, 255, 255, 0.3);
    }
  }
`;

// Body Content - Editorial typography
const BodyContainer = styled.div`
  max-width: 680px;
  margin: 0 auto;
  padding: 0 24px;
  font-size: 1.125rem;
  line-height: 1.75;
  color: #c8c8c8;

  @media (min-width: 768px) {
    padding: 0 48px;
  }

  @media (min-width: 1400px) {
    max-width: 720px;
  }

  /* Typography scale */
  h2 {
    font-size: clamp(1.5rem, 3.5vw, 2.25rem);
    font-weight: 800;
    margin: 56px 0 20px;
    padding-left: 16px;
    border-left: 3px solid #00d4ff;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: #ffffff;
  }

  h3 {
    font-size: 1.2rem;
    font-weight: 700;
    margin: 36px 0 14px;
    color: #00d4ff;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  p {
    margin-bottom: 1.5rem;
  }

  /* Lead paragraph */
  > p:first-of-type {
    font-size: 1.2rem;
    line-height: 1.65;
    color: #e0e0e0;
    font-weight: 400;
  }

  a {
    color: #00d4ff;
    text-decoration: none;
    border-bottom: 1px solid rgba(0, 212, 255, 0.3);
    transition: all 0.2s;

    &:hover {
      color: #ffd700;
      border-bottom-color: #ffd700;
    }
  }

  ul, ol {
    margin: 1.5rem 0;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.75rem;
  }

  blockquote {
    margin: 40px 0;
    padding: 24px 28px;
    background: rgba(0, 212, 255, 0.03);
    border-left: 3px solid #ffd700;
    font-style: italic;
    font-size: 1.1rem;
    color: #d8d8d8;

    p:last-child {
      margin-bottom: 0;
    }
  }

  code {
    background: rgba(0, 212, 255, 0.08);
    border: 1px solid rgba(0, 212, 255, 0.15);
    padding: 2px 6px;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    font-size: 0.88em;
    color: #00d4ff;
  }

  pre {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 20px;
    overflow-x: auto;
    margin: 24px 0;
    font-size: 0.9rem;

    code {
      background: none;
      border: none;
      padding: 0;
    }
  }
`;

// Navigation pills
const NavPills = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 32px 0 48px;
  padding-bottom: 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const NavPill = styled(Link)`
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-decoration: none;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.4);
    color: #00d4ff;
  }
`;

// Full-width image that breaks container
const WideImage = styled.figure`
  margin: 56px calc(-50vw + 50%);
  width: 100vw;
  position: relative;

  @media (min-width: 1200px) {
    margin: 64px calc(-50vw + 50% + 6vw);
  }

  img {
    width: 100%;
    height: auto;
    max-height: 70vh;
    object-fit: cover;
    display: block;
  }
`;

const WideImageCaption = styled.figcaption`
  text-align: center;
  padding: 16px 24px;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.45);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

// Side-by-side image + text (cohesive, not disjointed)
const SplitSection = styled.div<{ $reversed?: boolean }>`
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  margin: 56px 0;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);

  @media (min-width: 900px) {
    grid-template-columns: ${p => p.$reversed ? '1fr 45%' : '45% 1fr'};
    margin: 64px calc(-50vw + 50% + 6vw);
    width: calc(100vw - 12vw);
    max-width: 1400px;
  }
`;

const SplitImage = styled.div<{ $bgImage: string }>`
  min-height: 300px;
  background-image: url(${p => p.$bgImage});
  background-size: cover;
  background-position: center;

  @media (min-width: 900px) {
    min-height: 400px;
  }
`;

const SplitContent = styled.div`
  padding: 32px;
  display: flex;
  flex-direction: column;
  justify-content: center;

  @media (min-width: 900px) {
    padding: 48px;
  }

  h3 {
    margin-top: 0;
    color: #ffd700;
  }

  p:last-child {
    margin-bottom: 0;
  }
`;

// Section divider
const SectionDivider = styled.hr`
  border: none;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 212, 255, 0.3) 30%,
    rgba(255, 215, 0, 0.4) 50%,
    rgba(0, 212, 255, 0.3) 70%,
    transparent 100%
  );
  margin: 64px auto;
  max-width: 400px;
  position: relative;

  &::before {
    content: '◆';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: #030308;
    padding: 0 16px;
    color: rgba(255, 215, 0, 0.4);
    font-size: 0.7rem;
  }
`;

// Author card
const AuthorCard = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin: 48px 0;

  .avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00d4ff, #3b82f6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 20px;
    color: white;
    flex-shrink: 0;
  }

  .info {
    flex: 1;

    .name {
      font-weight: 600;
      color: #fff;
      margin-bottom: 4px;
    }

    .title {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.85rem;
    }
  }

  .cta {
    padding: 10px 18px;
    background: transparent;
    border: 1px solid rgba(0, 212, 255, 0.3);
    color: #00d4ff;
    font-size: 0.8rem;
    text-decoration: none;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover {
      background: rgba(0, 212, 255, 0.1);
      border-color: #00d4ff;
    }

    @media (max-width: 600px) {
      display: none;
    }
  }
`;

// Share section
const ShareSection = styled.div`
  display: flex;
  gap: 12px;
  margin: 40px 0;
  padding: 24px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const ShareButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: rgba(0, 212, 255, 0.05);
  border: 1px solid rgba(0, 212, 255, 0.2);
  color: rgba(0, 212, 255, 0.8);
  text-decoration: none;
  font-size: 0.8rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.4);
    color: #00d4ff;
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

// Discover section
const DiscoverSection = styled.section`
  margin: 48px 0;
  padding: 32px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.05) 0%, rgba(255, 215, 0, 0.02) 100%);
  border: 1px solid rgba(0, 212, 255, 0.15);
`;

const DiscoverContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  @media (max-width: 600px) {
    flex-direction: column;
    text-align: center;
  }
`;

const DiscoverLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;

  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const DiscoverIcon = styled.div`
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #00d4ff 0%, #ffd700 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 24px;
    height: 24px;
    color: #030308;
  }
`;

const DiscoverText = styled.div`
  h3 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #fff;
    margin: 0 0 6px 0;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  p {
    font-size: 0.95rem;
    color: #9ca3af;
    margin: 0;
  }
`;

const DiscoverButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  background: linear-gradient(135deg, #00d4ff 0%, #ffd700 100%);
  border: none;
  color: #030308;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 212, 255, 0.3);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

// Footer wrapper
const FooterWrapper = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px 64px;

  @media (min-width: 768px) {
    padding: 0 48px 80px;
  }
`;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

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
  slug,
  articleType,
}) => {
  const siteUrl = SITE_URL;
  const articleUrl = `${siteUrl}/articles/${slug}`;
  const defaultOgImage = `${siteUrl}/og-default.png`;
  const fullOgImage = ogImage ? (ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`) : defaultOgImage;

  const { openModal, setCurrentArticle } = useArticleDiscovery();
  const { chatData, sendMessage } = useSupabaseData();

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
      articleType,
    });
  }, [slug, title, date, author, description, keywords, ogImage, readingTime, content, articleType, setCurrentArticle]);

  // Fetch article videos
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
        // Videos are optional
      }
    };
    fetchVideos();
  }, [slug]);

  const primaryVideo = articleVideos[0] || null;
  const indexedVideo = primaryVideo || (articleVideo
    ? {
        title: `${title} - Video`,
        caption: description || title,
        public_url: `${siteUrl}${articleVideo}`,
        thumbnail_url: heroImage ? `${siteUrl}${heroImage}` : fullOgImage,
        mime_type: 'video/mp4',
        width: undefined,
        height: undefined,
        duration_seconds: undefined,
        created_at: date,
      }
    : null);

  // Split content into sections for interleaving with images
  const contentChunks = useMemo(() => {
    const parts = content.split(/(?=^## )/m);
    return parts.filter(p => p.trim().length > 0);
  }, [content]);

  // Distribute images throughout content
  const sections = useMemo(() => {
    const result: Array<{
      type: 'content' | 'wide-image' | 'split';
      content?: string;
      image?: MultiArtOption;
      reversed?: boolean;
    }> = [];

    // First chunk always starts the article
    if (contentChunks[0]) {
      result.push({ type: 'content', content: contentChunks[0] });
    }

    // Interleave remaining content with images
    let imageIndex = 0;
    for (let i = 1; i < contentChunks.length; i++) {
      // Every 2-3 sections, insert an image if available
      if (imageIndex < multiArtImages.length && i % 2 === 0) {
        const image = multiArtImages[imageIndex];
        imageIndex++;
        
        // Alternate between wide image and split layout
        if (i % 4 === 0) {
          result.push({ type: 'wide-image', image });
        } else {
          result.push({ 
            type: 'split', 
            image, 
            content: contentChunks[i],
            reversed: (i / 2) % 2 === 1
          });
          continue; // Skip adding content separately
        }
      }
      
      result.push({ type: 'content', content: contentChunks[i] });
    }

    return result;
  }, [contentChunks, multiArtImages]);

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

  const storyCompanion = useMemo(() => {
    if (articleType !== 'fiction') return null;
    return buildStoryCompanion({ title, description, keywords, content });
  }, [articleType, content, description, keywords, title]);

  const articleChatContext = useMemo(() => ({
    slug, title, articleType, description, keywords, content,
  }), [articleType, content, description, keywords, slug, title]);

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

        {indexedVideo && (
          <>
            <meta property="og:video" content={indexedVideo.public_url} />
            <meta property="og:video:type" content={indexedVideo.mime_type || 'video/mp4'} />
            {indexedVideo.width && <meta property="og:video:width" content={String(indexedVideo.width)} />}
            {indexedVideo.height && <meta property="og:video:height" content={String(indexedVideo.height)} />}
          </>
        )}

        <meta name="twitter:card" content={indexedVideo ? "player" : "summary_large_image"} />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description || `Read ${title}`} />
        <meta name="twitter:image" content={indexedVideo?.thumbnail_url || fullOgImage} />

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

      {indexedVideo && (
        <StructuredData
          type="VideoObject"
          data={createVideoSchema({
            name: indexedVideo.title || `${title} — Video`,
            description: indexedVideo.caption || description || title,
            thumbnailUrl: indexedVideo.thumbnail_url || fullOgImage,
            contentUrl: indexedVideo.public_url,
            uploadDate: indexedVideo.created_at || date,
            duration: indexedVideo.duration_seconds,
            articleUrl,
          })}
        />
      )}

      <CircleNav />

      {/* HERO SECTION */}
      <HeroSection $hasImage={!!heroImage}>
        {heroImage && (
          <HeroBackground>
            <Image
              src={heroImage}
              alt={title}
              fill
              style={{ objectFit: 'cover' }}
              priority
              sizes="100vw"
            />
          </HeroBackground>
        )}
        <HeroContent>
          <ArticleClassification {...inferClassificationFromSlug(slug)} />
          <ArticleTitle>{title}</ArticleTitle>
          <ArticleMeta>
            <span>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>{author.join(', ')}</span>
            <span>{readingTime} min read</span>
          </ArticleMeta>
        </HeroContent>
      </HeroSection>

      {/* BODY CONTENT */}
      <BodyContainer>
        <NavPills aria-label="Related navigation">
          <NavPill href="/speculative-ai">Speculative AI Hub</NavPill>
          <NavPill href="/agent-futures">Agent Futures</NavPill>
          <NavPill href="/emergent-intelligence">Emergent Intelligence</NavPill>
          <NavPill href="/about">About</NavPill>
          <NavPill href="/hire-me">Work With Me</NavPill>
        </NavPills>

        {/* Video if available */}
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

        {articleVideo && !primaryVideo && (
          <video
            src={articleVideo}
            controls
            style={{ width: '100%', margin: '32px 0', borderRadius: 0 }}
          />
        )}

        {videoURL && (
          <div style={{ margin: '32px 0' }}>
            <iframe
              width="100%"
              height="400"
              src={videoURL.replace('watch?v=', 'embed/')}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${title} — YouTube video`}
              style={{ borderRadius: 0 }}
            />
          </div>
        )}

        {/* Render interleaved content and images */}
        {sections.map((section, idx) => {
          if (section.type === 'content' && section.content) {
            return (
              <React.Fragment key={idx}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {section.content}
                </ReactMarkdown>
              </React.Fragment>
            );
          }

          if (section.type === 'wide-image' && section.image) {
            return (
              <WideImage key={idx}>
                <Image
                  src={section.image.path}
                  alt={`${section.image.model} artwork`}
                  width={1600}
                  height={900}
                  style={{ width: '100%', height: 'auto', maxHeight: '70vh' }}
                />
                <WideImageCaption>{section.image.model.replace(/-/g, ' ')}</WideImageCaption>
              </WideImage>
            );
          }

          if (section.type === 'split' && section.image && section.content) {
            return (
              <SplitSection key={idx} $reversed={section.reversed}>
                <SplitImage $bgImage={section.image.path} />
                <SplitContent>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {section.content}
                  </ReactMarkdown>
                </SplitContent>
              </SplitSection>
            );
          }

          return null;
        })}

        {/* Author Card */}
        <AuthorCard>
          <div className="avatar">AW</div>
          <div className="info">
            <div className="name">Alex Welcing</div>
            <div className="title">AI Product Leader & Technical Strategist</div>
          </div>
          <Link href="/hire-me" className="cta">
            Work With Me
          </Link>
        </AuthorCard>
      </BodyContainer>

      {/* FOOTER SECTION */}
      <FooterWrapper>
        <ShareSection>
          <ShareButton
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Share on X
          </ShareButton>
          <ShareButton
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            Share on LinkedIn
          </ShareButton>
        </ShareSection>

        <SectionDivider />

        <DiscoverSection>
          <DiscoverContent>
            <DiscoverLeft>
              <DiscoverIcon><Compass /></DiscoverIcon>
              <DiscoverText>
                <h3>Discover Related</h3>
                <p>Explore more scenarios and research on similar themes.</p>
              </DiscoverText>
            </DiscoverLeft>
            <DiscoverButton onClick={() => openModal()}>
              <Star />
              Explore
              <ArrowRight />
            </DiscoverButton>
          </DiscoverContent>
        </DiscoverSection>

        <BottomCarousel slug={slug} />
      </FooterWrapper>

      {/* Story companion for fiction */}
      {storyCompanion && (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 64px' }}>
          <StoryConstellationPreview
            structuredAnswer={chatData.structuredAnswer}
            storyCompanion={storyCompanion}
            onPromptSelect={(prompt) => void sendMessage(prompt, { articleContext: articleChatContext })}
          />
        </div>
      )}

      {/* Footer panels */}
      <ArticleFooterPanels
        articleTitle={title}
        articleSlug={slug}
        articleType={articleType}
        articleDescription={description}
        articleKeywords={keywords}
        articleContent={content}
      />
    </ArticleLayout>
  );
};

// =============================================================================
// STATIC GENERATION
// =============================================================================

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

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string };
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const articleFilePath = path.join(articleFolderPath, `${slug}.mdx`);
  const fileContents = fs.readFileSync(articleFilePath, 'utf8');
  const { data, content } = matter(fileContents);
  const escapedContent = escapeMdxContent(content);

  // Use cached loader instead of re-reading all files (320x faster!)
  const relatedArticles = getRelatedArticles(slug, 3);

  const images = discoverArticleImages(slug);
  const resolvedOgImage =
    images.ogImage ||
    images.heroImage ||
    images.thumbnail ||
    '';

  const videoPath = `/images/article-videos/${slug}.mp4`;
  const videoExists = fs.existsSync(path.join(process.cwd(), 'public', videoPath));
  const articleType = data.articleType === 'research' ? 'research' : 'fiction';

  return {
    props: {
      title: data.title as string,
      date: (data.date instanceof Date ? data.date.toISOString() : data.date) as string,
      author: Array.isArray(data.author) ? (data.author as string[]) : ([data.author] as string[]),
      articleType,
      description: data.description || '',
      keywords: data.keywords || [],
      ogImage: resolvedOgImage,
      heroImage: images.heroImage,
      multiArtImages: images.multiArt,
      videoURL: data.videoURL || '',
      articleVideo: videoExists ? videoPath : '',
      content: escapedContent,
      readingTime: calculateReadingTime(content),
      relatedArticles,
      slug,
    },
  };
};

export default ArticlePage;
