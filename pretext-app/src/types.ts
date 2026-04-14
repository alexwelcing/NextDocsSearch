export interface ArticleIndexEntry {
  slug: string
  title: string
  date: string
  author: string[]
  description: string
  keywords: string[]
  readingTime: number
  wordCount: number
  articleType: 'fiction' | 'research'
  heroImage: string | null
  thumbnail: string | null
  ogImage: string | null
  articleVideo: string | null
  chunkPath: string
}

export interface ArticleChunk extends Omit<ArticleIndexEntry, 'chunkPath'> {
  content: string
  plainText: string
  sections: string[]
}

export interface ArticleIndexResponse {
  generatedAt: string
  total: number
  version: number
  articles: ArticleIndexEntry[]
}
