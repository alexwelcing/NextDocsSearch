// Manifests + records → public/sitemap.xml + video-sitemap.xml. Must run after 50-article-manifest,
// and before next build, which collects public/ (see scripts/generate-sitemaps.ts).
import { writeSitemaps } from '../../generate-sitemaps'

export default function sitemaps() {
  writeSitemaps()
}
