// Article MDX → public/arc/records/<slug>.json (the in-scene reader and the SSG pages).
import { tsx } from '../lib'

export default function articleBodies() {
  return tsx('scripts/generate-article-bodies.ts')
}
