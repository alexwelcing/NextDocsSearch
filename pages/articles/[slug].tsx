import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import styled from 'styled-components';
import { escapeMdxContent } from '@/lib/utils';
import { useArticleDiscovery } from '@/components/ArticleDiscoveryProvider';
import { Compass, Star, ArrowRight } from 'lucide-react';
import type { ArticleMediaWithUrl } from '@/types/article-media';
import VideoComponent from '@/components/VideoComponent';
import { createVideoSchema } from '@/components/StructuredData';
import ArticleVideoPlayer from '@/components/ArticleVideoPlayer';
import ArticleImageGallery from '@/components/ui/ArticleImageGallery';
import ArticleClassification, { inferClassificationFromSlug } from '@/components/ArticleClassification';
import CircleNav from '@/components/ui/CircleNav';
import StructuredData from '../../components/StructuredData';
import EsotericArticleView from '@/components/ui/EsotericArticleView';
import { TopRecommendation, MidRecommendation, BottomCarousel } from '@/components/ArticleRecommendations';
import ArticleFooterPanels from '@/components/ArticleFooterPanels';
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

const ArticlePageRoot = styled.div`
  min-height: 100vh;
  background: #030308;
  overflow-x: hidden;
`;

const ShareButtons = styled.div`
  display: flex;
  gap: 16px;
  margin: 40px 0;
  padding: 20px 0;
  border-top: 2px solid rgba(0, 212, 255, 0.15);
  border-bottom: 2px solid rgba(0, 212, 255, 0.15);
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 24px;
  padding-right: 24px;
`;

const ShareButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(0, 212, 255, 0.08);
  border: 2px solid rgba(0, 212, 255, 0.25);
  color: #00d4ff;
  text-decoration: none;
  font-size: 0.82rem;
  font-family: var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    border-color: #00d4ff;
  }
`;

const InternalLinks = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 32px 0;
  padding: 16px 0;
  font-size: 0.78rem;
  font-family: var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: 24px;
  padding-right: 24px;
`;

const InternalLink = styled(Link)`
  text-decoration: none;
  padding: 5px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
  transition: all 0.2s;

  &:hover {
    color: rgba(255, 255, 255, 0.7);
    border-color: rgba(255, 255, 255, 0.2);
  }
`;

const DiscoverSection = styled.section`
  max-width: 1200px;
  margin: 48px auto;
  padding: 40px 24px;
  background: rgba(0, 212, 255, 0.04);
  border: 2px solid rgba(0, 212, 255, 0.2);
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
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #00d4ff, #c9a227);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 28px;
    height: 28px;
    color: #030308;
  }
`;

const DiscoverText = styled.div`
  h3 {
    font-size: 1.3rem;
    font-weight: 700;
    color: #fff;
    margin: 0 0 6px;
    text-transform: uppercase;
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
  padding: 14px 28px;
  background: linear-gradient(135deg, #00d4ff, #c9a227);
  border: none;
  color: #030308;
  font-size: 0.9rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  white-space: nowrap;

  &:hover {
    opacity: 0.9;
  }
`;

const FooterWrapper = styled.footer`
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 24px 60px;
`;

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

  const [articleVideos, setArticleVideos] = useState<ArticleMediaWithUrl[]>([]);
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.success && data.media) {
          setArticleVideos(data.media.filter((m: ArticleMediaWithUrl) => m.media_type === 'video' && m.status === 'ready'));
        }
      } catch { /* silent */ }
    };
    fetchVideos();
  }, [slug]);

  const primaryVideo = articleVideos[0] || null;

  return (
    <ArticlePageRoot>
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
            url: `${siteUrl}/about`,
          })),
          publisher: {
            '@type': 'Organization',
            name: 'Alex Welcing',
            url: siteUrl,
            logo: {
              '@type': 'ImageObject',
              url: `${siteUrl}/logo.png`,
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': articleUrl,
          },
        }}
      />

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
          ESOTERIC ARTICLE BODY
          Uses offset typography, semantic media anchoring, mixed columns
          ================================================================ */}
      <EsotericArticleView
        title={title}
        date={date}
        author={author}
        content={content}
        heroImage={heroImage}
        multiArtImages={multiArtImages}
        slug={slug}
      />

      {/* ================================================================
          ARTICLE FOOTER ELEMENTS
          ================================================================ */}
      <InternalLinks aria-label="Related navigation">
        <InternalLink href="/speculative-ai">Speculative AI Hub</InternalLink>
        <InternalLink href="/agent-futures">Agent Futures</InternalLink>
        <InternalLink href="/emergent-intelligence">Emergent Intelligence</InternalLink>
        <InternalLink href="/about">About</InternalLink>
      </InternalLinks>

      <ArticleClassification {...inferClassificationFromSlug(slug)} />

      {/* Videos */}
      {articleVideo && <ArticleVideoPlayer src={articleVideo} title={title} />}

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

      {videoURL && (
        <div style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 24px' }}>
          <iframe
            width="100%"
            height="450"
            src={videoURL.replace('watch?v=', 'embed/')}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`${title} — YouTube video`}
          />
        </div>
      )}

      {/* Recommendations */}
      <TopRecommendation slug={slug} />
      <MidRecommendation slug={slug} />

      {/* Share + Discover */}
      <ShareButtons>
        <ShareButton href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`} target="_blank" rel="noopener noreferrer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Share on X
        </ShareButton>
        <ShareButton href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`} target="_blank" rel="noopener noreferrer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Share on LinkedIn
        </ShareButton>
      </ShareButtons>

      <DiscoverSection>
        <DiscoverContent>
          <DiscoverLeft>
            <DiscoverIcon><Compass /></DiscoverIcon>
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

      {/* Image Gallery */}
      {multiArtImages.length > 0 && (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 48px' }}>
          <ArticleImageGallery images={multiArtImages} articleTitle={title} />
        </div>
      )}

      {/* Footer Panels + Carousel */}
      <FooterWrapper>
        <BottomCarousel slug={slug} />
      </FooterWrapper>

      <ArticleFooterPanels articleTitle={title} />
    </ArticlePageRoot>
  );
};

export const getStaticPaths: GetStaticPaths = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);
  const paths = filenames
    .filter((filename) => filename.endsWith('.mdx'))
    .map((filename) => ({ params: { slug: filename.replace('.mdx', '') } }));
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
    .filter((article) => article.slug !== currentSlug)
    .slice(0, limit)
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      description: article.description || `Read more about ${article.title}`,
      ogImage: article.ogImage,
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
    .filter((filename) => filename.endsWith('.mdx'))
    .map((filename) => {
      const filePath = path.join(articleFolderPath, filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(fileContents);
      return {
        slug: filename.replace('.mdx', ''),
        title: data.title,
        description: data.description,
        date: data.date,
        ogImage: data.ogImage,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const readingTime = calculateReadingTime(content);
  const baseRelated = getRelatedArticles(slug, allArticles);
  const relatedArticles = baseRelated.map((article) => ({
    ...article,
    heroImage: discoverArticleImages(article.slug).heroImage,
  }));

  const images = discoverArticleImages(slug);

  const videoPath = `/images/article-videos/${slug}.mp4`;
  const videoExists = fs.existsSync(path.join(process.cwd(), 'public', videoPath));

  return {
    props: {
      title: data.title as string,
      date: data.date instanceof Date ? data.date.toISOString() : (data.date as string),
      author: Array.isArray(data.author) ? (data.author as string[]) : ([data.author] as string[]),
      description: data.description || '',
      keywords: data.keywords || [],
      ogImage: data.ogImage || images.ogImage || '',
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