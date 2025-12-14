import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ArticleContainer from '@/components/ArticleContainer';
import StructuredData from '../../components/StructuredData';
import Footer from '../../components/ui/footer';
import CircleNav from '@/components/ui/CircleNav';
import styled from 'styled-components';

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

  pre {
    background: rgba(0, 0, 0, 0.4);
    padding: 20px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 2rem 0;
    border: 1px solid rgba(222, 126, 162, 0.2);

    code {
      background: none;
      padding: 0;
    }
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 2rem 0;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
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
  display: block;
  padding: 20px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(222, 126, 162, 0.2);
  text-decoration: none;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-4px);
    border-color: #de7ea2;
    box-shadow: 0 10px 30px rgba(222, 126, 162, 0.2);
  }

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourdomain.com';
  const articleUrl = `${siteUrl}/articles/${slug}`;
  const defaultOgImage = `${siteUrl}/og-default.png`;

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
          author: author.map(name => ({
            '@type': 'Person',
            name: name
          })),
          publisher: {
            '@type': 'Organization',
            name: 'Alex Welcing',
            logo: {
              '@type': 'ImageObject',
              url: `${siteUrl}/logo.png`
            }
          }
        }}
      />

      <CircleNav />

      <ArticleWrapper>
        <ArticleHero>
          <ArticleTitle>{title}</ArticleTitle>
          <ArticleMeta>
            <MetaItem>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</MetaItem>
            <MetaItem>{author.join(', ')}</MetaItem>
            <MetaItem>{readingTime} min read</MetaItem>
          </ArticleMeta>
        </ArticleHero>

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
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
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

        {relatedArticles.length > 0 && (
          <RelatedArticles>
            <RelatedTitle>Related Articles</RelatedTitle>
            <RelatedGrid>
              {relatedArticles.map((article) => (
                <RelatedCard key={article.slug} href={`/articles/${article.slug}`}>
                  <h3>{article.title}</h3>
                  <p>{article.description}</p>
                </RelatedCard>
              ))}
            </RelatedGrid>
          </RelatedArticles>
        )}
      </ArticleWrapper>

      <Footer onImageChange={() => {}} showChangeScenery={false} />
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

// Helper function to get related articles
function getRelatedArticles(currentSlug: string, allArticles: any[], limit = 3) {
  return allArticles
    .filter(article => article.slug !== currentSlug)
    .slice(0, limit)
    .map(article => ({
      slug: article.slug,
      title: article.title,
      description: article.description || `Read more about ${article.title}`
    }));
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string };
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const articleFilePath = path.join(articleFolderPath, `${slug}.mdx`);
  const fileContents = fs.readFileSync(articleFilePath, 'utf8');
  const { data, content } = matter(fileContents);

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
        date: data.date
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
      content,
      readingTime,
      relatedArticles,
      slug,
    },
  };
};

export default ArticlePage;
