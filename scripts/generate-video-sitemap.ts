/**
 * Generate a video sitemap (video-sitemap.xml) for Google Video indexing.
 * Reads article_media from Supabase and outputs a sitemap with <video:video>
 * entries conforming to https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
 *
 * Run: tsx scripts/generate-video-sitemap.ts
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import matter from 'gray-matter'
import { createClient } from '@supabase/supabase-js'

import { discoverArticleImages } from '../lib/article-images'
import { SITE_URL } from '../lib/site-url'
import { STORAGE_CONFIG } from '../types/article-media'

dotenv.config({ path: '.env.local' })
dotenv.config()

const siteUrl = SITE_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

interface VideoRow {
  id: number
  article_slug: string
  storage_path: string
  thumbnail_path: string | null
  title: string | null
  caption: string | null
  duration_seconds: number | null
  created_at: string
  status: string
}

interface SitemapVideoEntry {
  articleSlug: string
  contentUrl: string
  thumbnailUrl: string
  title: string
  description: string
  publicationDate: string
  durationSeconds?: number | null
}

function getLocalVideoEntries(siteUrl: string): SitemapVideoEntry[] {
  const videosDir = path.join(process.cwd(), 'public', 'images', 'article-videos')
  const articlesDir = path.join(process.cwd(), 'pages', 'docs', 'articles')

  if (!fs.existsSync(videosDir) || !fs.existsSync(articlesDir)) {
    return []
  }

  const entries: SitemapVideoEntry[] = []
  const files = fs.readdirSync(videosDir).filter((file) => file.endsWith('.mp4'))

  for (const file of files) {
    const slug = file.replace(/\.mp4$/, '')
    const articlePath = path.join(articlesDir, `${slug}.mdx`)

    if (!fs.existsSync(articlePath)) {
      continue
    }

    const { data } = matter(fs.readFileSync(articlePath, 'utf-8'))
    const images = discoverArticleImages(slug)
    const thumbnailPath = images.heroImage || images.ogImage || images.thumbnail || '/og-default.png'
    const publicationDate =
      typeof data.date === 'string'
        ? data.date
        : data.date instanceof Date
          ? data.date.toISOString()
          : new Date().toISOString()

    entries.push({
      articleSlug: slug,
      contentUrl: `${siteUrl}/images/article-videos/${file}`,
      thumbnailUrl: thumbnailPath.startsWith('http') ? thumbnailPath : `${siteUrl}${thumbnailPath}`,
      title: (data.title as string) || `${slug} video`,
      description: (data.description as string) || `Video for article ${slug}`,
      publicationDate,
    })
  }

  return entries
}

async function generateVideoSitemap() {
  const localEntries = getLocalVideoEntries(siteUrl)

  if (!supabaseUrl || !supabaseKey) {
    console.log('⏭ No Supabase credentials — generating sitemap from local article videos only')
    writeSitemap(localEntries)
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Fetch all ready video media
  const { data: videos, error } = await supabase
    .from('article_media')
    .select(
      'id, article_slug, storage_path, thumbnail_path, title, caption, duration_seconds, created_at, status'
    )
    .eq('media_type', 'video')
    .eq('status', 'ready')
    .order('article_slug')

  if (error) {
    console.error('Error fetching video media:', error)
    writeSitemap(localEntries)
    return
  }

  const remoteEntries: SitemapVideoEntry[] = []
  const remoteSlugs = new Set<string>()

  if (videos && videos.length > 0) {
    const bySlug = new Map<string, VideoRow[]>()
    for (const video of videos as VideoRow[]) {
      const existing = bySlug.get(video.article_slug) || []
      existing.push(video)
      bySlug.set(video.article_slug, existing)
    }

    for (const [slug, slugVideos] of bySlug) {
      remoteSlugs.add(slug)

      for (const v of slugVideos) {
        const contentUrl = supabase.storage
          .from(STORAGE_CONFIG.buckets.videos)
          .getPublicUrl(v.storage_path).data.publicUrl

        let thumbnailUrl = `${siteUrl}/og-default.png`
        if (v.thumbnail_path) {
          thumbnailUrl = supabase.storage
            .from(STORAGE_CONFIG.buckets.images)
            .getPublicUrl(v.thumbnail_path).data.publicUrl
        }

        remoteEntries.push({
          articleSlug: slug,
          contentUrl,
          thumbnailUrl,
          title: v.title || `${slug} video`,
          description: v.caption || v.title || `Video for article ${slug}`,
          publicationDate: v.created_at,
          durationSeconds: v.duration_seconds,
        })
      }
    }
  }

  const combinedEntries = [
    ...remoteEntries,
    ...localEntries.filter((entry) => !remoteSlugs.has(entry.articleSlug)),
  ]

  if (combinedEntries.length === 0) {
    console.log('⏭ No local or remote videos found — writing empty video sitemap')
    writeEmptySitemap()
    return
  }

  writeSitemap(combinedEntries)
}

function writeSitemap(entriesInput: SitemapVideoEntry[]) {
  const bySlug = new Map<string, SitemapVideoEntry[]>()
  for (const entry of entriesInput) {
    const existing = bySlug.get(entry.articleSlug) || []
    existing.push(entry)
    bySlug.set(entry.articleSlug, existing)
  }

  const entries: string[] = []
  for (const [slug, slugVideos] of bySlug) {
    const articleUrl = `${siteUrl}/articles/${slug}`

    const videoEntries = slugVideos
      .map((v) => {
        const videoTitle = escapeXml(v.title || `${slug} video`)
        const videoDesc = escapeXml(v.description || `Video for article ${slug}`)
        const duration = v.durationSeconds
          ? `\n      <video:duration>${v.durationSeconds}</video:duration>`
          : ''

        return `    <video:video>
      <video:thumbnail_loc>${escapeXml(v.thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${videoTitle}</video:title>
      <video:description>${videoDesc}</video:description>
      <video:content_loc>${escapeXml(v.contentUrl)}</video:content_loc>
      <video:publication_date>${v.publicationDate}</video:publication_date>${duration}
      <video:family_friendly>yes</video:family_friendly>
    </video:video>`
      })
      .join('\n')

    entries.push(`  <url>
    <loc>${articleUrl}</loc>
${videoEntries}
  </url>`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries.join('\n')}
</urlset>
`

  const outPath = path.join(process.cwd(), 'public', 'video-sitemap.xml')
  fs.writeFileSync(outPath, xml, 'utf-8')
  const videoCount = entriesInput.length
  console.log(`✅ Video sitemap written to ${outPath} (${entries.length} articles, ${videoCount} videos)`)
}

function writeEmptySitemap() {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
</urlset>
`
  const outPath = path.join(process.cwd(), 'public', 'video-sitemap.xml')
  fs.writeFileSync(outPath, xml, 'utf-8')
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

generateVideoSitemap().catch((err) => {
  console.error('Video sitemap generation failed:', err)
  writeEmptySitemap()
})
