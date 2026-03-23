import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import styled, { keyframes } from 'styled-components';
import StructuredData, { createVideoSchema } from '@/components/StructuredData';
import { SITE_URL } from '@/lib/site-url';
import { ArrowLeft, Play, Clock, Calendar, User, ExternalLink } from 'lucide-react';
import VideoComponent from '@/components/VideoComponent';

// =============================================================================
// ANIMATIONS - Fluid, academic motion inspired by latent space exploration
// =============================================================================

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

// =============================================================================
// LAYOUT - Editorial, confident design
// =============================================================================

const PageLayout = styled.div`
  min-height: 100vh;
  background: #030308;
  overflow-x: hidden;
`;

const VideoHero = styled.section`
  position: relative;
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 48px 24px 64px;
  background: linear-gradient(180deg, #0a0a12 0%, #030308 100%);

  @media (min-width: 768px) {
    padding: 64px 48px 80px;
  }

  @media (min-width: 1200px) {
    padding: 80px 8vw 96px;
  }
`;

const BackgroundGrid = styled.div`
  position: absolute;
  inset: 0;
  background-image: 
    linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  opacity: 0.5;
  pointer-events: none;
`;

const FloatingOrb = styled.div`
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 212, 255, 0.15) 0%, transparent 70%);
  filter: blur(40px);
  animation: ${float} 8s ease-in-out infinite;
  pointer-events: none;
  
  &:nth-child(1) {
    top: 10%;
    right: 10%;
    animation-delay: 0s;
  }
  
  &:nth-child(2) {
    bottom: 20%;
    left: 5%;
    background: radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%);
    animation-delay: -4s;
  }
`;

const BackLink = styled(Link)`
  position: absolute;
  top: 24px;
  left: 24px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.3s ease;
  z-index: 10;

  &:hover {
    color: #00d4ff;
    border-color: rgba(0, 212, 255, 0.3);
    background: rgba(0, 212, 255, 0.05);
  }

  @media (min-width: 768px) {
    top: 32px;
    left: 48px;
  }
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 900px;
  animation: ${fadeInUp} 0.8s ease-out;
`;

const VideoLabel = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin-bottom: 24px;
  background: rgba(0, 212, 255, 0.1);
  border: 1px solid rgba(0, 212, 255, 0.2);
  color: #00d4ff;
  font-size: 0.75rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;

  svg {
    width: 14px;
    height: 14px;
  }
`;

const VideoTitle = styled.h1`
  font-size: clamp(2rem, 5vw, 3.5rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: #ffffff;
  margin: 0 0 24px;

  &::after {
    content: '';
    display: block;
    width: 100px;
    height: 3px;
    background: linear-gradient(90deg, #00d4ff, #ffd700);
    margin-top: 20px;
  }
`;

const VideoMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-size: 0.85rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  color: rgba(255, 255, 255, 0.5);

  span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  svg {
    width: 14px;
    height: 14px;
    color: rgba(0, 212, 255, 0.6);
  }
`;

const VideoContainer = styled.div`
  position: relative;
  max-width: 1200px;
  margin: -40px auto 0;
  padding: 0 24px;
  z-index: 2;

  @media (min-width: 768px) {
    padding: 0 48px;
    margin-top: -60px;
  }

  @media (min-width: 1200px) {
    padding: 0 8vw;
  }
`;

const VideoWrapper = styled.div`
  position: relative;
  background: #0a0a12;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(0, 212, 255, 0.1);
  animation: ${fadeInUp} 1s ease-out 0.2s both;
`;

const ContentSection = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 24px;

  @media (min-width: 768px) {
    padding: 80px 48px;
  }
`;

const Description = styled.p`
  font-size: 1.125rem;
  line-height: 1.8;
  color: #a0a0a8;
  margin: 0 0 32px;
`;

const ArticleLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(255, 215, 0, 0.05));
  border: 1px solid rgba(0, 212, 255, 0.2);
  color: #00d4ff;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s ease;

  &:hover {
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(255, 215, 0, 0.1));
    border-color: rgba(0, 212, 255, 0.4);
    transform: translateY(-2px);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const SectionDivider = styled.div`
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 212, 255, 0.2) 30%,
    rgba(255, 215, 0, 0.3) 50%,
    rgba(0, 212, 255, 0.2) 70%,
    transparent 100%
  );
  margin: 48px 0;
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

const RelatedVideos = styled.section`
  max-width: 1200px;
  margin: 0 auto;
  padding: 64px 24px 96px;

  @media (min-width: 768px) {
    padding: 80px 48px 120px;
  }

  @media (min-width: 1200px) {
    padding: 80px 8vw 120px;
  }
`;

const SectionTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 32px;
  display: flex;
  align-items: center;
  gap: 12px;

  &::before {
    content: '';
    width: 4px;
    height: 24px;
    background: linear-gradient(180deg, #00d4ff, #ffd700);
  }
`;

const VideoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
`;

const VideoCard = styled(Link)`
  display: block;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  text-decoration: none;
  transition: all 0.3s ease;

  &:hover {
    border-color: rgba(0, 212, 255, 0.2);
    transform: translateY(-4px);
    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.3);
  }
`;

const VideoThumbnail = styled.div`
  position: relative;
  aspect-ratio: 16 / 9;
  background: #0a0a12;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s ease;
  }

  ${VideoCard}:hover & img {
    transform: scale(1.05);
  }
`;

const PlayOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.3s ease;

  ${VideoCard}:hover & {
    opacity: 1;
  }

  svg {
    width: 48px;
    height: 48px;
    color: #00d4ff;
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.5));
  }
`;

const VideoCardContent = styled.div`
  padding: 16px;
`;

const VideoCardTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 8px;
  line-height: 1.4;
`;

const VideoCardMeta = styled.div`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
`;

// =============================================================================
// TYPES
// =============================================================================

interface VideoPageProps {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string[];
  videoSrc: string;
  poster: string;
  width?: number;
  height?: number;
  duration?: number;
  articleSlug: string;
  relatedVideos: Array<{
    slug: string;
    title: string;
    date: string;
    poster: string;
    duration?: number;
  }>;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

const VideoPage: NextPage<VideoPageProps> = ({
  slug,
  title,
  description,
  date,
  author,
  videoSrc,
  poster,
  width,
  height,
  duration,
  articleSlug,
  relatedVideos,
}) => {
  const siteUrl = SITE_URL;
  const videoUrl = `${siteUrl}/videos/${slug}`;
  const articleUrl = `${siteUrl}/articles/${articleSlug}`;

  // Format duration for display
  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <PageLayout>
      <Head>
        <title>{title} | Video | Alex Welcing</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow, max-video-preview: -1" />
        <link rel="canonical" href={videoUrl} />

        {/* Open Graph - Video specific */}
        <meta property="og:type" content="video.other" />
        <meta property="og:url" content={videoUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={poster} />
        <meta property="og:video" content={videoSrc} />
        <meta property="og:video:type" content="video/mp4" />
        {width && <meta property="og:video:width" content={String(width)} />}
        {height && <meta property="og:video:height" content={String(height)} />}

        {/* Twitter Card - Player card for video */}
        <meta name="twitter:card" content="player" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={poster} />
        <meta name="twitter:player" content={videoUrl} />
        {width && <meta name="twitter:player:width" content={String(width)} />}
        {height && <meta name="twitter:player:height" content={String(height)} />}

        <meta name="theme-color" content="#030308" />
      </Head>

      {/* VideoObject Structured Data for Google Video Indexing */}
      <StructuredData
        type="VideoObject"
        data={createVideoSchema({
          name: title,
          description,
          thumbnailUrl: poster,
          contentUrl: videoSrc,
          uploadDate: date,
          duration,
          articleUrl: videoUrl,
        })}
      />

      <VideoHero>
        <BackgroundGrid />
        <FloatingOrb />
        <FloatingOrb />
        
        <BackLink href={`/articles/${articleSlug}`}>
          <ArrowLeft />
          Back to Article
        </BackLink>

        <HeroContent>
          <VideoLabel>
            <Play />
            Video Content
          </VideoLabel>
          <VideoTitle>{title}</VideoTitle>
          <VideoMeta>
            <span>
              <Calendar />
              {new Date(date).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
            <span>
              <User />
              {author.join(', ')}
            </span>
            {duration && (
              <span>
                <Clock />
                {formatDuration(duration)}
              </span>
            )}
          </VideoMeta>
        </HeroContent>
      </VideoHero>

      <VideoContainer>
        <VideoWrapper>
          <VideoComponent
            videoSrc={videoSrc}
            poster={poster}
            title={title}
            description={description}
            width={width}
            height={height}
            autoPlay={false}
            muted={false}
          />
        </VideoWrapper>
      </VideoContainer>

      <ContentSection>
        <Description>{description}</Description>
        
        <ArticleLink href={`/articles/${articleSlug}`}>
          Read Full Article
          <ExternalLink />
        </ArticleLink>

        <SectionDivider />

        <div style={{ 
          padding: '24px', 
          background: 'rgba(0, 212, 255, 0.03)',
          border: '1px solid rgba(0, 212, 255, 0.1)',
          fontSize: '0.85rem',
          color: 'rgba(255, 255, 255, 0.5)',
          fontFamily: 'var(--font-mono, "Monaco", "Courier New", monospace)',
        }}>
          <strong style={{ color: '#00d4ff' }}>About this video:</strong>
          <br /><br />
          This video is part of the research archive on speculative AI systems, 
          emergent intelligence, and the future of human-machine collaboration. 
          For the complete context and supporting analysis, please refer to the 
          full article.
        </div>
      </ContentSection>

      {relatedVideos.length > 0 && (
        <RelatedVideos>
          <SectionTitle>Related Videos</SectionTitle>
          <VideoGrid>
            {relatedVideos.map((video) => (
              <VideoCard key={video.slug} href={`/videos/${video.slug}`}>
                <VideoThumbnail>
                  <Image
                    src={video.poster}
                    alt={video.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <PlayOverlay>
                    <Play />
                  </PlayOverlay>
                </VideoThumbnail>
                <VideoCardContent>
                  <VideoCardTitle>{video.title}</VideoCardTitle>
                  <VideoCardMeta>
                    {new Date(video.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                    {video.duration && ` • ${formatDuration(video.duration)}`}
                  </VideoCardMeta>
                </VideoCardContent>
              </VideoCard>
            ))}
          </VideoGrid>
        </RelatedVideos>
      )}
    </PageLayout>
  );
};

// =============================================================================
// STATIC GENERATION
// =============================================================================

export const getStaticPaths: GetStaticPaths = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);
  
  // Find all articles that have videos
  const paths: { params: { slug: string } }[] = [];
  
  for (const filename of filenames) {
    if (!filename.endsWith('.mdx')) continue;
    
    const slug = filename.replace('.mdx', '');
    const videoPath = `/images/article-videos/${slug}.mp4`;
    const videoExists = fs.existsSync(path.join(process.cwd(), 'public', videoPath));
    
    // Also check for Supabase videos via a marker or just generate for all
    // For now, generate paths for articles that have local videos
    if (videoExists) {
      paths.push({ params: { slug } });
    }
  }
  
  return { paths, fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string };
  
  try {
    const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
    const articleFilePath = path.join(articleFolderPath, `${slug}.mdx`);
    
    // Check if article exists
    if (!fs.existsSync(articleFilePath)) {
      return { notFound: true };
    }
    
    const fileContents = fs.readFileSync(articleFilePath, 'utf8');
    const { data } = matter(fileContents);
    
    const siteUrl = SITE_URL;
    
    // Get video path
    const videoPath = `/images/article-videos/${slug}.mp4`;
    const videoExists = fs.existsSync(path.join(process.cwd(), 'public', videoPath));
    
    if (!videoExists) {
      return { notFound: true };
    }
    
    // Get poster image
    const posterPath = `/images/article-videos/${slug}-poster.jpg`;
    const posterExists = fs.existsSync(path.join(process.cwd(), 'public', posterPath));
    const defaultPoster = `${siteUrl}/og-default.png`;
    
    // Find related videos (other articles with videos)
    const allFilenames = fs.readdirSync(articleFolderPath);
    const relatedVideos: Array<{
      slug: string;
      title: string;
      date: string;
      poster: string;
      duration?: number;
    }> = [];
    
    for (const filename of allFilenames) {
      if (!filename.endsWith('.mdx') || filename === `${slug}.mdx`) continue;
      
      const otherSlug = filename.replace('.mdx', '');
      const otherVideoPath = `/images/article-videos/${otherSlug}.mp4`;
      const otherVideoExists = fs.existsSync(path.join(process.cwd(), 'public', otherVideoPath));
      
      if (otherVideoExists && relatedVideos.length < 3) {
        const otherFileContents = fs.readFileSync(
          path.join(articleFolderPath, filename), 
          'utf8'
        );
        const { data: otherData } = matter(otherFileContents);
        
        const otherPosterPath = `/images/article-videos/${otherSlug}-poster.jpg`;
        const otherPosterExists = fs.existsSync(path.join(process.cwd(), 'public', otherPosterPath));
        
        relatedVideos.push({
          slug: otherSlug,
          title: otherData.title || otherSlug,
          date: (otherData.date instanceof Date ? otherData.date.toISOString() : otherData.date) as string,
          poster: otherPosterExists ? `${siteUrl}${otherPosterPath}` : defaultPoster,
        });
      }
    }
    
    return {
      props: {
        slug,
        title: `${data.title} - Video`,
        description: data.description || `Video content for ${data.title}`,
        date: (data.date instanceof Date ? data.date.toISOString() : data.date) as string,
        author: Array.isArray(data.author) ? data.author : [data.author],
        videoSrc: `${siteUrl}${videoPath}`,
        poster: posterExists ? `${siteUrl}${posterPath}` : defaultPoster,
        width: 1920, // Default HD
        height: 1080,
        articleSlug: slug,
        relatedVideos,
      },
    };
  } catch (error) {
    console.error('Error generating video page:', error);
    return { notFound: true };
  }
};

export default VideoPage;
