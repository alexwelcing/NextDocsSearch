/**
 * Shared types for the vector-space visualization layer.
 */

export interface VectorArticle {
  id: string
  title: string
  polarity?: number
  horizon?: string
  category?: string
  mechanics?: string[]
}

export interface SearchHit {
  slug: string
  score: number
  heading?: string | null
}

export interface VectorSpaceExplorerProps {
  articles: VectorArticle[]
  searchResults?: SearchHit[]
  recommendations?: Record<string, { similar: { slug: string; score: number }[] }>
  onArticleSelect?: (article: VectorArticle) => void
  selectedArticleId?: string | null
  cameraTarget?: [number, number, number] | null
  isSearching?: boolean
}
