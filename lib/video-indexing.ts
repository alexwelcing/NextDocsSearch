import { SITE_URL, normalizeSiteUrl } from '@/lib/site-url'

export interface ArticleVideoReference {
  name: string
  description: string
  thumbnailUrl: string
  watchPagePath: string
  watchPageUrl: string
  uploadDate: string
  contentUrl?: string
  embedUrl?: string
  mimeType?: string
  durationSeconds?: number
  width?: number
  height?: number
}

interface BuildArticleVideoReferenceArgs {
  siteUrl?: string
  slug: string
  title: string
  description?: string
  articleVideo?: string | null
  videoURL?: string | null
  thumbnailUrl: string
  uploadDate: string
  durationSeconds?: number
  width?: number
  height?: number
}

export function getVideoWatchPagePath(slug: string): string {
  return `/videos/${slug}`
}

export function getVideoWatchPageUrl(siteUrl: string, slug: string): string {
  return `${normalizeSiteUrl(siteUrl)}${getVideoWatchPagePath(slug)}`
}

export function getVideoEmbedUrl(videoUrl: string): string {
  try {
    const parsed = new URL(videoUrl)

    if (parsed.hostname === 'youtu.be') {
      const id = parsed.pathname.replace(/^\/+/, '')
      return id ? `https://www.youtube.com/embed/${id}` : videoUrl
    }

    if (parsed.hostname.endsWith('youtube.com')) {
      if (parsed.pathname === '/watch') {
        const id = parsed.searchParams.get('v')
        return id ? `https://www.youtube.com/embed/${id}` : videoUrl
      }

      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2]
        return id ? `https://www.youtube.com/embed/${id}` : videoUrl
      }

      if (parsed.pathname.startsWith('/embed/')) {
        return videoUrl
      }
    }

    return videoUrl
  } catch {
    return videoUrl
  }
}

export function buildArticleVideoReference({
  siteUrl = SITE_URL,
  slug,
  title,
  description,
  articleVideo,
  videoURL,
  thumbnailUrl,
  uploadDate,
  durationSeconds,
  width,
  height,
}: BuildArticleVideoReferenceArgs): ArticleVideoReference | null {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl)
  const watchPagePath = getVideoWatchPagePath(slug)
  const watchPageUrl = getVideoWatchPageUrl(normalizedSiteUrl, slug)
  const name = `${title} — Video`
  const resolvedDescription = description || title

  if (articleVideo) {
    const contentUrl = articleVideo.startsWith('http')
      ? articleVideo
      : `${normalizedSiteUrl}${articleVideo}`

    return {
      name,
      description: resolvedDescription,
      thumbnailUrl,
      watchPagePath,
      watchPageUrl,
      uploadDate,
      contentUrl,
      embedUrl: watchPageUrl,
      mimeType: 'video/mp4',
      durationSeconds,
      width,
      height,
    }
  }

  if (videoURL) {
    return {
      name,
      description: resolvedDescription,
      thumbnailUrl,
      watchPagePath,
      watchPageUrl,
      uploadDate,
      embedUrl: getVideoEmbedUrl(videoURL),
      durationSeconds,
      width,
      height,
    }
  }

  return null
}
