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
import { useEffect } from 'react';
import { Compass, Star, ArrowRight } from 'lucide-react';
import HandwrittenNote from '@/components/ui/HandwrittenNote';

interface ArticleProps {
  title: string;
  date: string;
  author: string[];
  content: string;
  description?: string;
  keywords?: string[];
  ogImage?: string;
  videoURL?: string;
  readingTime: number;
  relatedArticles: Array<{
    slug: string;
    title: string;
    description: string;
    ogImage?: string;
  }>;
  slug: string;
}

const ArticleLayout = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
`;

const ArticleWrapper = styled.article`
  max-width: 800px;
  margin: 0 auto;
  padding: 120px 20px 60px;
  color: #e0e0e0;
`;

const HeroImageWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 450px;
  margin-bottom: 40px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0,0,0,0.4);
  border: 1px solid rgba(222, 126, 162, 0.2);

  @media (min-width: 900px) {
    width: 120%;
    margin-left: -10%;
  }

  @media (max-width: 768px) {
    height: 250px;
    border-radius: 8px;
  }
`;

const ArticleHero = styled.header`
  margin-bottom: 60px;
  padding-bottom: 40px;
  border-bottom: 2px solid rgba(222, 126, 162, 0.3);
`;

const ArticleTitle = styled.h1`
  font-size: 3rem;
  font-weight: 800;
  color: #ffffff;
  margin-bottom: 20px;
  line-height: 1.2;

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  color: #de7ea2;
  font-size: 0.95rem;
  margin-top: 20px;
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;

  &:before {
    content: '●';
    color: #de7ea2;
  }
`;

const ArticleContent = styled.div`
  font-size: 1.125rem;
  line-height: 1.8;
  color: #e0e0e0;

  h2 {
    font-size: 2rem;
    color: #ffffff;
    margin: 60px 0 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(222, 126, 162, 0.2);
  }

  h3 {
    font-size: 1.5rem;
    color: #de7ea2;
    margin: 40px 0 15px;
  }

  p {
    margin-bottom: 1.5rem;
  }

  a {
    color: #de7ea2;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.3s ease;

    &:hover {
      border-bottom-color: #de7ea2;
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
    background: rgba(222, 126, 162, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.9em;
  }

  /* Pre blocks are now handled by HandwrittenNote component */
  /* Legacy pre styling for non-code blocks */
  pre:not([data-handwritten]) {
    background: transparent;
    padding: 0;
    margin: 0;
    border: none;
    overflow-x: visible;

    code {
      background: none;
      padding: 0;
    }
  }

  blockquote {
    border-left: 4px solid #de7ea2;
    padding-left: 20px;
    margin: 2rem 0;
    font-style: italic;
    color: #b8b8b8;
  }
`;

const RelatedArticles = styled.section`
  margin-top: 80px;
  padding: 40px;
  background: rgba(222, 126, 162, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(222, 126, 162, 0.2);
`;

const RelatedTitle = styled.h2`
  font-size: 1.75rem;
  color: #ffffff;
  margin-bottom: 30px;
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
  border-radius: 8px;
  border: 1px solid rgba(222, 126, 162, 0.2);
  text-decoration: none;
  transition: all 0.3s ease;
  overflow: hidden;

  &:hover {
    transform: translateY(-4px);
    border-color: #de7ea2;
    box-shadow: 0 10px 30px rgba(222, 126, 162, 0.2);
  }
`;

const CardContent = styled.div`
  padding: 20px;

  h3 {
    color: #de7ea2;
    font-size: 1.125rem;
    margin-bottom: 10px;
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
  background: #1a1a2e;
`;

const ShareButtons = styled.div`
  display: flex;
  gap: 15px;
  margin: 40px 0;
  padding: 20px 0;
  border-top: 1px solid rgba(222, 126, 162, 0.2);
  border-bottom: 1px solid rgba(222, 126, 162, 0.2);
`;

const ShareButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: rgba(222, 126, 162, 0.1);
  border: 1px solid rgba(222, 126, 162, 0.3);
  border-radius: 6px;
  color: #de7ea2;
  text-decoration: none;
  font-size: 0.9rem;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(222, 126, 162, 0.2);
    transform: translateY(-2px);
  }
`;

const InternalLinks = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(222, 126, 162, 0.2);
  font-size: 0.9rem;
`;

const InternalLink = styled(Link)`
  color: #a5b4fc;
  text-decoration: none;
  padding: 4px 12px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.1);
  transition: all 0.2s;

  &:hover {
    background: rgba(99, 102, 241, 0.2);
  }
`;

// Discovery Section Styles
const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 8px 32px rgba(222, 126, 162, 0.3); }
  50% { box-shadow: 0 8px 48px rgba(222, 126, 162, 0.5); }
`;

const shimmerEffect = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const DiscoverSection = styled.section`
  margin: 60px 0;
  padding: 40px;
  background: linear-gradient(135deg, rgba(222, 126, 162, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%);
  border: 1px solid rgba(222, 126, 162, 0.25);
  border-radius: 20px;
  position: relative;
  overflow: hidden;
  animation: ${pulseGlow} 4s ease-in-out infinite;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #de7ea2, #6366f1, #de7ea2);
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
  border-radius: 16px;
  background: linear-gradient(135deg, #de7ea2 0%, #6366f1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg {
    width: 32px;
    height: 32px;
    color: #fff;
  }
`;

const DiscoverText = styled.div`
  h3 {
    font-size: 1.5rem;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px 0;
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
  background: linear-gradient(135deg, #de7ea2 0%, #6366f1 100%);
  border: none;
  border-radius: 14px;
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
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
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(222, 126, 162, 0.4);

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

const ArticlePage: NextPage<ArticleProps> = ({
  title,
  date,
  author,
  content,
  description,
  keywords,
  ogImage,
  videoURL,
  readingTime,
  relatedArticles,
  slug
}) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://alexwelcing.com';
  const articleUrl = `${siteUrl}/articles/${slug}`;
  const defaultOgImage = `${siteUrl}/og-default.png`;

  // Discovery context integration
  const { openModal, setCurrentArticle } = useArticleDiscovery();

  // Set the current article context for recommendations
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
      articleType: 'fiction', // Default, will be enhanced by API
    });
  }, [slug, title, date, author, description, keywords, ogImage, readingTime, content, setCurrentArticle]);

  return (
    <ArticleLayout>
      <Head>
        {/* Primary Meta Tags */}
        <title>{title} | Alex Welcing</title>
        <meta name="title" content={title} />
        <meta name="description" content={description || `Read ${title} and more insights.`} />
        {keywords && <meta name="keywords" content={keywords.join(', ')} />}
        <meta name="author" content={author.join(', ')} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description || `Read ${title}`} />
        <meta property="og:image" content={ogImage || defaultOgImage} />
        <meta property="article:published_time" content={date} />
        <meta property="article:author" content={author.join(', ')} />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={articleUrl} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description || `Read ${title}`} />
        <meta property="twitter:image" content={ogImage || defaultOgImage} />

        {/* Canonical URL */}
        <link rel="canonical" href={articleUrl} />
      </Head>

      <StructuredData
        type="Article"
        data={{
          headline: title,
          description: description,
          image: ogImage || defaultOgImage,
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

      <ArticleWrapper>
        <ArticleHero>
          {ogImage && (
            <HeroImageWrapper>
              <Image
                src={ogImage}
                alt={title}
                fill
                style={{ objectFit: 'cover' }}
                priority
                sizes="(max-width: 768px) 100vw, 800px"
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

        {/* Internal Links - Required for SEO authority flow */}
        <InternalLinks aria-label="Related navigation">
          <InternalLink href="/speculative-ai">Speculative AI Hub</InternalLink>
          <InternalLink href="/agent-futures">Agent Futures</InternalLink>
          <InternalLink href="/emergent-intelligence">Emergent Intelligence</InternalLink>
          <InternalLink href="/about">About</InternalLink>
        </InternalLinks>

        {/* Classification Header - Shows article taxonomy */}
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
              style={{ borderRadius: '8px' }}
            />
          </div>
        )}

        <ArticleContent>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              img: MarkdownImage as any,
              pre: ({ children, ...props }: any) => {
                // Wrap pre blocks in HandwrittenNote for interactive viewing
                return (
                  <HandwrittenNote>
                    {children?.props?.children || children}
                  </HandwrittenNote>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </ArticleContent>

        <ShareButtons>
          <ShareButton
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            🐦 Share on Twitter
          </ShareButton>
          <ShareButton
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            💼 Share on LinkedIn
          </ShareButton>
        </ShareButtons>

        {/* Prominent Discovery Section */}
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
                  {article.ogImage && (
                    <CardImageWrapper>
                      <Image
                        src={article.ogImage}
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
      </ArticleWrapper>
    </ArticleLayout>
  );
};


export const getStaticPaths: GetStaticPaths = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);
  const paths = filenames
    .filter((filename) => filename.endsWith('.mdx')) // Only include .mdx files
    .map((filename) => ({
      params: { slug: filename.replace('.mdx', '') },
    }));
  return { paths, fallback: false };
};

// Helper function to calculate reading time
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

// Helper function to get related articles
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

  // Get all articles for related articles section
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
  const relatedArticles = getRelatedArticles(slug, allArticles);

  return {
    props: {
      title: data.title as string,
      date: data.date as string,
      author: data.author as string[],
      description: data.description || '',
      keywords: data.keywords || [],
      ogImage: data.ogImage || '',
      videoURL: data.videoURL || '',
      content: escapedContent,
      readingTime,
      relatedArticles,
      slug,
    },
  };
};

export default ArticlePage;
