// Article front matter + image manifest → lib/generated/article-manifest.json.
import { tsx } from '../lib'

export default function articleManifest() {
  return tsx('scripts/generate-article-manifest.ts')
}
