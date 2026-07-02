import type { NextApiRequest, NextApiResponse } from 'next'

const articleManifest = require('../../lib/generated/article-manifest.json') as ManifestArticle[]

export interface ArticleData {
  filename: string
  title: string
  date: string
  author: string[]
  category?: string
  keywords?: string[]
  length?: number
}

export interface ArticlesResponse {
  articles: ArticleData[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

interface ManifestArticle {
  filename: string
  title: string
  date: string
  author?: string[] | string
  category?: string
  keywords?: string[]
  wordCount?: number
  searchText?: string
}

const articles: ArticleData[] = articleManifest.map((article) => ({
  filename: article.filename,
  title: article.title,
  date: article.date,
  author: Array.isArray(article.author)
    ? article.author
    : article.author
      ? [article.author]
      : ['Alex Welcing'],
  category: article.category,
  keywords: article.keywords,
  length: article.wordCount ?? article.searchText?.length ?? 0,
}))

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArticlesResponse | ArticleData[]>
) {
  const { page, perPage, search, author, year, sortBy = 'date', sortOrder = 'desc' } = req.query

  let articlesData = [...articles]

  if (search && typeof search === 'string') {
    const searchLower = search.toLowerCase()
    articlesData = articlesData.filter(
      (article) =>
        article.title.toLowerCase().includes(searchLower) ||
        article.author?.some((a) => a.toLowerCase().includes(searchLower)) ||
        article.keywords?.some((k) => k.toLowerCase().includes(searchLower))
    )
  }

  if (author && typeof author === 'string') {
    articlesData = articlesData.filter((article) => article.author?.includes(author))
  }

  if (year && typeof year === 'string') {
    articlesData = articlesData.filter((article) => {
      if (!article.date) return false
      return new Date(article.date).getFullYear().toString() === year
    })
  }

  articlesData.sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'title':
        comparison = a.title.localeCompare(b.title)
        break
      case 'author':
        comparison = (a.author?.[0] || '').localeCompare(b.author?.[0] || '')
        break
      case 'date':
      default:
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime()
    }

    return sortOrder === 'desc' ? -comparison : comparison
  })

  if (page && perPage) {
    const pageNum = Number.parseInt(page as string, 10)
    const perPageNum = Number.parseInt(perPage as string, 10)
    const startIndex = (pageNum - 1) * perPageNum
    const paginatedArticles = articlesData.slice(startIndex, startIndex + perPageNum)

    res.status(200).json({
      articles: paginatedArticles,
      total: articlesData.length,
      page: pageNum,
      perPage: perPageNum,
      totalPages: Math.ceil(articlesData.length / perPageNum),
    })
    return
  }

  res.status(200).json(articlesData)
}
