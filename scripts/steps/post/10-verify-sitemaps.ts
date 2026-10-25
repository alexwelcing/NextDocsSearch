// The crawl assertion (scripts/generate-sitemaps.ts verifyPrerendered): every sitemap URL was
// prerendered, and the noindex pages are exactly the articles the sitemap leaves out.
import { planSitemaps, verifyPrerendered } from '../../generate-sitemaps'

export default function verifySitemaps() {
  verifyPrerendered(process.cwd(), planSitemaps(process.cwd()))
}
