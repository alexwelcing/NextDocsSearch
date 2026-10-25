// Manifests → public/sitemap.xml + video-sitemap.xml, then the crawl assertion over the prerendered
// HTML (scripts/generate-sitemaps.ts). Needs the next build output.
import { verifyPrerendered, writeSitemaps } from '../../generate-sitemaps'

export default function sitemaps() {
  verifyPrerendered(process.cwd(), writeSitemaps())
}
