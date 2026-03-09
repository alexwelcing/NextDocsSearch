/**
 * Generate a video sitemap (video-sitemap.xml) for Google Video indexing.
 * Reads article_media from Supabase and outputs a sitemap with <video:video>
 * entries conforming to https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
 *
 * Run: tsx scripts/generate-video-sitemap.ts
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alexwelcing.com'
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

async function generateVideoSitemap() {
  if (!supabaseUrl || !supabaseKey) {
    console.log('⏭ Skipping video sitemap — no Supabase credentials')
    // Write an empty sitemap so the build doesn't break
    writeEmptySitemap()
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
    writeEmptySitemap()
    return
  }

  if (!videos || videos.length === 0) {
    console.log('⏭ No ready videos found — writing empty video sitemap')
    writeEmptySitemap()
    return
  }

  // Group videos by article slug
  const bySlug = new Map<string, VideoRow[]>()
  for (const video of videos as VideoRow[]) {
    const existing = bySlug.get(video.article_slug) || []
    existing.push(video)
    bySlug.set(video.article_slug, existing)
  }

  // Build sitemap XML
  const entries: string[] = []
  for (const [slug, slugVideos] of bySlug) {
    const articleUrl = `${siteUrl}/articles/${slug}`

    const videoEntries = slugVideos
      .map((v) => {
        const contentUrl = supabase.storage
          .from('article-videos')
          .getPublicUrl(v.storage_path).data.publicUrl

        let thumbnailUrl = `${siteUrl}/og-default.png`
        if (v.thumbnail_path) {
          thumbnailUrl = supabase.storage
            .from('article-images')
            .getPublicUrl(v.thumbnail_path).data.publicUrl
        }

        const videoTitle = escapeXml(v.title || `${slug} video`)
        const videoDesc = escapeXml(v.caption || v.title || `Video for article ${slug}`)
        const duration = v.duration_seconds
          ? `\n      <video:duration>${v.duration_seconds}</video:duration>`
          : ''

        return `    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${videoTitle}</video:title>
      <video:description>${videoDesc}</video:description>
      <video:content_loc>${escapeXml(contentUrl)}</video:content_loc>
      <video:publication_date>${v.created_at}</video:publication_date>${duration}
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
  console.log(`✅ Video sitemap written to ${outPath} (${entries.length} articles, ${videos.length} videos)`)
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
