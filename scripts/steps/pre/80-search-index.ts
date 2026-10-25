// Records + operator panels → public/search/{chunks,bm25}.<hash>.json (FIND's full-text BM25F
// index, git-ignored) and lib/generated/search-manifest.json (committed; names those assets).
// Network-free. After 20-article-bodies and 50-article-manifest, which it reads.
import { tsx } from '../lib'

export default function searchIndex() {
  return tsx('scripts/generate-search-index.ts')
}
