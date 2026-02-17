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
import styled, { keyframes } from 'styled-components';
import { escapeMdxContent } from '@/lib/utils';
import MarkdownImage from '@/components/ui/MarkdownImage';
import { useArticleDiscovery } from '@/components/ArticleDiscoveryProvider';
import { useEffect, useCallback } from 'react';
import { Compass, Star, ArrowRight } from 'lucide-react';
import HandwrittenNote from '@/components/ui/HandwrittenNote';
import DeskSurface from '@/components/ui/DeskSurface';
import ArticleImageGallery from '@/components/ui/ArticleImageGallery';
import { ParallaxBand, EditorialSection, GlowingContentSection } from '@/components/ui/ParallaxArtLayers';
import { discoverArticleImages } from '@/lib/article-images';
import type { MultiArtOption } from '@/lib/article-images';
import { useMemo } from 'react';

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
  overflow-x: hidden;
`;

/** Opaque content section that slides over parallax bands */
const ContentSection = styled.div`
  position: relative;
  background: #030308;
  z-index: 1;
`;

const ArticleWrapper = styled.article`
  position: relative;
  max-width: 860px;
  margin: 0 auto;
  padding: 60px 24px;
  color: #e0e0e0;
  border-left: 6px solid var(--color-cyan-accent, #00d4ff);

  @media (min-width: 1024px) {
    margin-left: 8%;
    margin-right: auto;
  }

  @media (max-width: 768px) {
    padding: 40px 16px;
    border-left-width: 4px;
  }
`;

/** Inner wrapper for footer sections (no <article> semantics) */
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

const HeroImageWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 500px;
  margin-bottom: 48px;
  border-radius: 0;
  overflow: hidden;
  border: 4px solid var(--color-cyan-accent, #00d4ff);

  @media (min-width: 900px) {
    width: 140%;
    margin-left: -20%;
  }

  @media (max-width: 768px) {
    height: 280px;
    border-width: 3px;
  }
`;

const ArticleHero = styled.header`
  margin-bottom: 48px;
  padding-bottom: 32px;
  border-bottom: 4px solid rgba(255, 255, 255, 0.15);
`;

const ArticleTitle = styled.h1`
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
    background: var(--color-gold-highlight, #ffd700);
    margin-top: 16px;
  }
`;

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  color: var(--color-cyan-accent, #00d4ff);
  font-size: 0.8rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-top: 24px;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;

  &:before {
    content: '//';
    color: var(--color-gold-highlight, #ffd700);
    font-weight: 700;
  }
`;

const ArticleContent = styled.div`
  font-size: 1.15rem;
  line-height: 1.85;
  color: #d4d4d4;

  h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    color: #ffffff;
    margin: 72px 0 24px;
    padding: 12px 0 12px 20px;
    border-left: 5px solid var(--color-gold-highlight, #ffd700);
    text-transform: uppercase;
    letter-spacing: -0.02em;
    font-weight: 800;
  }

  h3 {
    font-size: 1.4rem;
    color: var(--color-cyan-accent, #00d4ff);
    margin: 48px 0 16px;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  p {
    margin-bottom: 1.6rem;
  }

  a {
    color: var(--color-cyan-accent, #00d4ff);
    text-decoration: none;
    border-bottom: 2px solid var(--color-gold-highlight, #ffd700);
    transition: color 0.2s;

    &:hover {
      color: var(--color-gold-highlight, #ffd700);
    }
  }

  ul, ol {
    margin: 1.5rem 0;
    padding-left: 2rem;
  }

  li {
    margin-bottom: 0.75rem;
  }

  code {
    background: rgba(0, 212, 255, 0.08);
    padding: 3px 8px;
    border-radius: 0;
    border: 1px solid rgba(0, 212, 255, 0.2);
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    font-size: 0.88em;
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
    border-left: 5px solid var(--color-gold-highlight, #ffd700);
    padding: 16px 24px;
    margin: 2.5rem 0;
    background: rgba(255, 215, 0, 0.04);
    font-style: normal;
    font-weight: 500;
    color: #c8c8c8;
    border-radius: 0;
  }
`;

const RelatedArticles = styled.section`
  margin-top: 40px;
  padding: 40px;
  background: rgba(0, 212, 255, 0.03);
  border-radius: 0;
  border: 3px solid rgba(0, 212, 255, 0.25);
  border-top: 6px solid var(--color-cyan-accent, #00d4ff);
`;

const RelatedTitle = styled.h2`
  font-size: 1.75rem;
  color: #ffffff;
  margin-bottom: 30px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 800;
`;

const RelatedGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
`;

const RelatedCard = styled(Link)`
  display: flex;
  flex-direction: column;
  padding: 0;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0;
  border: 2px solid rgba(0, 212, 255, 0.2);
  text-decoration: none;
  transition: all 0.3s ease;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    border-color: var(--color-cyan-accent, #00d4ff);
    box-shadow: 0 10px 30px rgba(0, 212, 255, 0.2);
  }
`;

const CardContent = styled.div`
  padding: 20px;

  h3 {
    color: var(--color-cyan-accent, #00d4ff);
    font-size: 1.125rem;
    margin-bottom: 10px;
    text-transform: uppercase;
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  p {
    color: #b8b8b8;
    font-size: 0.9rem;
    line-height: 1.5;
  }
`;

const CardImageWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 150px;
  background: #0a0a1a;
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

const InternalLinks = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
  padding: 16px 0;
  border-bottom: 3px solid rgba(255, 255, 255, 0.1);
  font-size: 0.8rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const InternalLink = styled(Link)`
  color: var(--color-cyan-accent, #00d4ff);
  text-decoration: none;
  padding: 6px 14px;
  border-radius: 0;
  border: 1px solid rgba(0, 212, 255, 0.2);
  background: rgba(0, 212, 255, 0.05);
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    border-color: var(--color-cyan-accent, #00d4ff);
  }
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
  readingTime,
  relatedArticles,
  slug
}) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alexwelcing.com';
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
    pre: ({ children, ...props }: any) => (
      <HandwrittenNote>
        {children?.props?.children || children}
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

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:site" content="@alexwelcing" />
        <meta property="twitter:url" content={articleUrl} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description || `Read ${title}`} />
        <meta property="twitter:image" content={fullOgImage} />

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

      <CircleNav />

      {/* ---- Opening parallax band: taller, higher, with light-leak ---- */}
      {multiArtImages[0] && (
        <ParallaxBand
          image={multiArtImages[0]}
          height="85vh"
          mobileHeight="50vh"
          glowSpread={160}
          glowIntensity={0.4}
        />
      )}

      {/* ---- Section 1: Hero + Intro content ---- */}
      <GlowingContentSection image={multiArtImages[0]} glowPosition="top">
        <DeskSurface articleSlug={slug} />
        <ArticleWrapper>
          <ArticleHero>
            {heroImage && (
              <HeroImageWrapper>
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
            <ArticleTitle>{title}</ArticleTitle>
            <ArticleMeta>
              <MetaItem>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</MetaItem>
              <MetaItem>{author.join(', ')}</MetaItem>
              <MetaItem>{readingTime} min read</MetaItem>
            </ArticleMeta>
          </ArticleHero>

          <InternalLinks aria-label="Related navigation">
            <InternalLink href="/speculative-ai">Speculative AI Hub</InternalLink>
            <InternalLink href="/agent-futures">Agent Futures</InternalLink>
            <InternalLink href="/emergent-intelligence">Emergent Intelligence</InternalLink>
            <InternalLink href="/about">About</InternalLink>
          </InternalLinks>

          <ArticleClassification {...inferClassificationFromSlug(slug)} />

          {videoURL && (
            <div style={{ margin: '2rem 0' }}>
              <iframe
                width="100%"
                height="450"
                src={videoURL.replace('watch?v=', 'embed/')}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ borderRadius: '0' }}
              />
            </div>
          )}

          {/* Intro content chunk(s) */}
          <ArticleContent>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {sections[0]?.chunks.join('\n\n') || content}
            </ReactMarkdown>
          </ArticleContent>
        </ArticleWrapper>
      </GlowingContentSection>

      {/* ---- Editorial break 1: parallax + left/right layout ---- */}
      {sections.length > 1 && multiArtImages[1] && (
        <>
          <ParallaxBand
            image={multiArtImages[1]}
            height="70vh"
            mobileHeight="40vh"
            glowSpread={140}
            glowIntensity={0.38}
          />
          <GlowingContentSection image={multiArtImages[1]} glowPosition="top">
            <EditorialSection
              image={multiArtImages[1]}
              imagePosition="left"
            >
              <ArticleContent>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {sections[1].chunks.join('\n\n')}
                </ReactMarkdown>
              </ArticleContent>
            </EditorialSection>
          </GlowingContentSection>
        </>
      )}

      {/* Fallback: if no second image, render section 1 chunks inline */}
      {sections.length > 1 && !multiArtImages[1] && (
        <GlowingContentSection image={multiArtImages[0]} glowPosition="both">
          <ArticleWrapper>
            <ArticleContent>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {sections[1].chunks.join('\n\n')}
              </ReactMarkdown>
            </ArticleContent>
          </ArticleWrapper>
        </GlowingContentSection>
      )}

      {/* ---- Editorial break 2: parallax + right/left layout ---- */}
      {sections.length > 2 && multiArtImages[2] && (
        <>
          <ParallaxBand
            image={multiArtImages[2]}
            height="60vh"
            mobileHeight="35vh"
            glowSpread={120}
            glowIntensity={0.35}
          />
          <GlowingContentSection image={multiArtImages[2]} glowPosition="top">
            <EditorialSection
              image={multiArtImages[2]}
              imagePosition="right"
            >
              <ArticleContent>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {sections[2].chunks.join('\n\n')}
                </ReactMarkdown>
              </ArticleContent>
            </EditorialSection>
          </GlowingContentSection>
        </>
      )}

      {/* Fallback: if no third image, render section 2 chunks inline */}
      {sections.length > 2 && !multiArtImages[2] && (
        <GlowingContentSection image={multiArtImages[1] || multiArtImages[0]} glowPosition="both">
          <ArticleWrapper>
            <ArticleContent>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {sections[2].chunks.join('\n\n')}
              </ReactMarkdown>
            </ArticleContent>
          </ArticleWrapper>
        </GlowingContentSection>
      )}

      {/* ---- Image gallery ---- */}
      {multiArtImages.length > 0 && (
        <GlowingContentSection
          image={multiArtImages[multiArtImages.length - 1]}
          glowPosition="both"
        >
          <ArticleWrapper>
            <ArticleImageGallery images={multiArtImages} articleTitle={title} />
          </ArticleWrapper>
        </GlowingContentSection>
      )}

      {/* ---- Closing parallax + Footer ---- */}
      {multiArtImages.length > 0 && (
        <ParallaxBand
          image={multiArtImages[Math.min(multiArtImages.length - 1, 2)]}
          height="50vh"
          mobileHeight="30vh"
          glowSpread={100}
          glowIntensity={0.3}
        />
      )}

      <GlowingContentSection
        image={multiArtImages[multiArtImages.length - 1]}
        glowPosition="top"
      >
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

          {relatedArticles.length > 0 && (
            <RelatedArticles>
              <RelatedTitle>Related Articles</RelatedTitle>
              <RelatedGrid>
                {relatedArticles.map((article) => (
                  <RelatedCard key={article.slug} href={`/articles/${article.slug}`}>
                    {(article.heroImage || article.ogImage) && (
                      <CardImageWrapper>
                        <Image
                          src={article.heroImage || article.ogImage!}
                          alt={article.title}
                          fill
                          style={{ objectFit: 'cover' }}
                          sizes="(max-width: 768px) 100vw, 300px"
                        />
                      </CardImageWrapper>
                    )}
                    <CardContent>
                      <h3>{article.title}</h3>
                      <p>{article.description}</p>
                    </CardContent>
                  </RelatedCard>
                ))}
              </RelatedGrid>
            </RelatedArticles>
          )}
        </FooterWrapper>
      </GlowingContentSection>
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
      return {
        slug: filename.replace('.mdx', ''),
        title: data.title,
        description: data.description,
        date: data.date,
        ogImage: data.ogImage
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

  return {
    props: {
      title: data.title as string,
      date: (data.date instanceof Date ? data.date.toISOString() : data.date) as string,
      author: Array.isArray(data.author) ? (data.author as string[]) : ([data.author] as string[]),
      description: data.description || '',
      keywords: data.keywords || [],
      ogImage: data.ogImage || images.ogImage || '',
      heroImage: images.heroImage,
      multiArtImages: images.multiArt,
      videoURL: data.videoURL || '',
      content: escapedContent,
      readingTime,
      relatedArticles,
      slug,
    },
  };
};

export default ArticlePage;
