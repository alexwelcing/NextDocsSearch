// public/sitemap*.xml from the prerendered routes (next-sitemap.config.js). Needs the .next output.
import { run } from '../lib'

export default function nextSitemap() {
  return run('next-sitemap')
}
