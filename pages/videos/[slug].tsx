import { GetStaticPaths, GetStaticProps, NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import styled from 'styled-components'
import { createClient } from '@supabase/supabase-js'

import StructuredData, { createVideoSchema } from '@/components/StructuredData'
import VideoComponent from '@/components/VideoComponent'
import { discoverArticleImages } from '@/lib/article-images'
import { SITE_URL } from '@/lib/site-url'
import { buildArticleVideoReference } from '@/lib/video-indexing'
import { STORAGE_CONFIG } from '@/types/article-media'

interface VideoPageProps {
  slug: string
  title: string
  description?: string
  date: string
  author: string[]
  ogImage?: string
  heroImage: string | null
  articleVideo?: string
  videoURL?: string
  remoteVideo?: {
    publicUrl: string
    thumbnailUrl?: string
    durationSeconds?: number
    width?: number
    height?: number
  } | null
}

const Page = styled.main`
  min-height: 100vh;
  background: #030308;
  color: #f5f5f5;
  padding: 32px 24px 80px;
`

const Shell = styled.div`
  max-width: 1080px;
  margin: 0 auto;
`

const Eyebrow = styled.p`
  margin: 0 0 16px;
  font-size: 0.8rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
`

const Heading = styled.h1`
  margin: 0 0 16px;
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.05;
  letter-spacing: -0.03em;
`

const Description = styled.p`
  max-width: 760px;
  margin: 0 0 24px;
  font-size: 1.05rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.8);
`

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
`

const Frame = styled.section`
  margin: 0 0 24px;
`

const EmbedWrapper = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  margin: 2rem auto;
  border: 1px solid rgba(255, 255, 255, 0.08);

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }
`

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
`

const ActionLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #fff;
  text-decoration: none;
  transition: border-color 0.2s ease, background 0.2s ease;

  &:hover {
    border-color: rgba(0, 212, 255, 0.6);
    background: rgba(0, 212, 255, 0.08);
  }
`

const ActionAnchor = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #fff;
  text-decoration: none;
  transition: border-color 0.2s ease, background 0.2s ease;

  &:hover {
    border-color: rgba(0, 212, 255, 0.6);
    background: rgba(0, 212, 255, 0.08);
  }
`

const VideoPage: NextPage<VideoPageProps> = ({
  slug,
  title,
  description,
  date,
  author,
  ogImage,
  heroImage,
  articleVideo,
  videoURL,
  remoteVideo,
}) => {
  const resolvedHeroImage = heroImage
    ? heroImage.startsWith('http')
      ? heroImage
      : `${SITE_URL}${heroImage}`
    : null
  const resolvedOgImage = ogImage
    ? ogImage.startsWith('http')
      ? ogImage
      : `${SITE_URL}${ogImage}`
    : null
  const thumbnailUrl = remoteVideo?.thumbnailUrl || resolvedHeroImage || resolvedOgImage || `${SITE_URL}/og-default.png`

  const articleUrl = `${SITE_URL}/articles/${slug}`
  const seoVideo = buildArticleVideoReference({
    siteUrl: SITE_URL,
    slug,
    title,
    description,
    articleVideo: remoteVideo?.publicUrl || articleVideo,
    videoURL,
    thumbnailUrl,
    uploadDate: date,
    durationSeconds: remoteVideo?.durationSeconds,
    width: remoteVideo?.width,
    height: remoteVideo?.height,
  })

  if (!seoVideo) {
    return null
  }

  return (
    <Page>
      <Head>
        <title>{`${title} Video | Alex Welcing`}</title>
        <meta name="description" content={seoVideo.description} />
        <meta name="robots" content="index,follow,max-image-preview:large,max-video-preview:-1" />
        <link rel="canonical" href={seoVideo.watchPageUrl} />

        <meta property="og:type" content="video.other" />
        <meta property="og:title" content={`${title} Video`} />
        <meta property="og:description" content={seoVideo.description} />
        <meta property="og:url" content={seoVideo.watchPageUrl} />
        <meta property="og:image" content={seoVideo.thumbnailUrl} />
        {(seoVideo.contentUrl || seoVideo.embedUrl) && (
          <meta property="og:video" content={seoVideo.contentUrl || seoVideo.embedUrl} />
        )}
        {seoVideo.mimeType && <meta property="og:video:type" content={seoVideo.mimeType} />}

        <meta name="twitter:card" content={seoVideo.embedUrl ? 'player' : 'summary_large_image'} />
        <meta name="twitter:title" content={`${title} Video`} />
        <meta name="twitter:description" content={seoVideo.description} />
        <meta name="twitter:image" content={seoVideo.thumbnailUrl} />
        {seoVideo.embedUrl && (
          <>
            <meta name="twitter:player" content={seoVideo.embedUrl} />
            <meta name="twitter:player:width" content={String(seoVideo.width || 1280)} />
            <meta name="twitter:player:height" content={String(seoVideo.height || 720)} />
          </>
        )}
      </Head>

      <StructuredData
        type="VideoObject"
        data={createVideoSchema({
          name: seoVideo.name,
          description: seoVideo.description,
          thumbnailUrl: seoVideo.thumbnailUrl,
          contentUrl: seoVideo.contentUrl,
          embedUrl: seoVideo.embedUrl,
          uploadDate: seoVideo.uploadDate,
          duration: seoVideo.durationSeconds,
          watchPageUrl: seoVideo.watchPageUrl,
          articleUrl,
        })}
      />

      <Shell>
        <Eyebrow>Video watch page</Eyebrow>
        <Heading>{title}</Heading>
        <Description>{seoVideo.description}</Description>
        <Meta>
          <span>{new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</span>
          <span>{author.join(', ')}</span>
        </Meta>

        <Frame>
          {remoteVideo?.publicUrl || articleVideo ? (
            <VideoComponent
              videoSrc={seoVideo.contentUrl || remoteVideo?.publicUrl || `${SITE_URL}${articleVideo}`}
              poster={seoVideo.thumbnailUrl}
              title={seoVideo.name}
              description={seoVideo.description}
              width={seoVideo.width}
              height={seoVideo.height}
            />
          ) : (
            <EmbedWrapper>
              <iframe
                src={seoVideo.embedUrl}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={seoVideo.name}
              />
            </EmbedWrapper>
          )}
        </Frame>

        <Actions>
          <ActionLink href={articleUrl}>Read the full article</ActionLink>
          {seoVideo.contentUrl && (
            <ActionAnchor href={seoVideo.contentUrl} target="_blank" rel="noopener noreferrer">
              Open source video file
            </ActionAnchor>
          )}
        </Actions>
      </Shell>
    </Page>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const filenames = fs.readdirSync(articleFolderPath).filter((filename) => filename.endsWith('.mdx'))

  const paths = filenames
    .map((filename) => {
      const slug = filename.replace('.mdx', '')
      const articlePath = path.join(articleFolderPath, filename)
      const { data } = matter(fs.readFileSync(articlePath, 'utf8'))
      const videoPath = `/images/article-videos/${slug}.mp4`
      const hasLocalVideo = fs.existsSync(path.join(process.cwd(), 'public', videoPath))

      if (!hasLocalVideo && !data.videoURL) {
        return null
      }

      return { params: { slug } }
    })
    .filter(Boolean)

  return { paths: paths as Array<{ params: { slug: string } }>, fallback: 'blocking' }
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string }
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles')
  const articleFilePath = path.join(articleFolderPath, `${slug}.mdx`)

  if (!fs.existsSync(articleFilePath)) {
    return { notFound: true }
  }

  const fileContents = fs.readFileSync(articleFilePath, 'utf8')
  const { data } = matter(fileContents)
  const images = discoverArticleImages(slug)
  const videoPath = `/images/article-videos/${slug}.mp4`
  const hasLocalVideo = fs.existsSync(path.join(process.cwd(), 'public', videoPath))
  let remoteVideo: VideoPageProps['remoteVideo'] = null

  if (!hasLocalVideo && !data.videoURL) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { data: videoRows } = await supabase
        .from('article_media')
        .select(
          'storage_path, thumbnail_path, duration_seconds, width, height, status, media_type, display_order'
        )
        .eq('article_slug', slug)
        .eq('media_type', 'video')
        .eq('status', 'ready')
        .order('display_order')
        .limit(1)

      const remote = videoRows?.[0]
      if (remote?.storage_path) {
        const publicUrl = supabase.storage
          .from(STORAGE_CONFIG.buckets.videos)
          .getPublicUrl(remote.storage_path).data.publicUrl

        const thumbnailUrl = remote.thumbnail_path
          ? supabase.storage.from(STORAGE_CONFIG.buckets.images).getPublicUrl(remote.thumbnail_path)
              .data.publicUrl
          : undefined

        remoteVideo = {
          publicUrl,
          thumbnailUrl,
          durationSeconds: remote.duration_seconds || undefined,
          width: remote.width || undefined,
          height: remote.height || undefined,
        }
      }
    }
  }

  if (!hasLocalVideo && !data.videoURL && !remoteVideo) {
    return { notFound: true }
  }

  return {
    props: {
      slug,
      title: data.title as string,
      description: (data.description as string) || '',
      date: (data.date instanceof Date ? data.date.toISOString() : data.date) as string,
      author: Array.isArray(data.author) ? (data.author as string[]) : ([data.author] as string[]),
      ogImage: (images.ogImage || '') as string,
      heroImage: images.heroImage,
      articleVideo: hasLocalVideo ? videoPath : '',
      videoURL: (data.videoURL || '') as string,
      remoteVideo,
    },
  }
}

export default VideoPage
