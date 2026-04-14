import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import type { ArticleChunk, ArticleIndexEntry, ArticleIndexResponse } from './types'
import { OfflineSearch } from './lib/search'
import { Seo } from './components/Seo'
import './styles.css'

function useContentIndex() {
  const [articles, setArticles] = useState<ArticleIndexEntry[]>([])
  useEffect(() => {
    fetch('/data/index.json')
      .then((res) => res.json())
      .then((data: ArticleIndexResponse) => setArticles(data.articles))
      .catch(() => setArticles([]))
  }, [])

  return articles
}

function navigateWithTransition(navigate: ReturnType<typeof useNavigate>, to: string) {
  const maybeTransition = (document as Document & {
    startViewTransition?: (callback: () => void) => void
  }).startViewTransition

  if (maybeTransition) {
    maybeTransition(() => navigate(to))
    return
  }

  navigate(to)
}

function ArticleGrid({ articles }: { articles: ArticleIndexEntry[] }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [engine] = useState(() => new OfflineSearch())

  useEffect(() => {
    fetch('/data/search-docs.json')
      .then((res) => res.json())
      .then((docs) => engine.hydrate(docs))
      .catch(() => undefined)
  }, [engine])

  const filtered = useMemo(() => {
    if (!query.trim()) return articles
    const resultDocs = engine.query(query)
    const slugSet = new Set(resultDocs.map((doc) => doc.slug))
    return articles.filter((article) => slugSet.has(article.slug))
  }, [articles, engine, query])

  return (
    <>
      <Seo
        title="NextDocsSearch Offline Articles"
        description="PreText-inspired offline-first article index with instant local search and cacheable story text."
        path="/"
      />
      <header className="header">
        <h1>NextDocsSearch // Stories</h1>
        <p>Portable, cacheable, text-first reading stack.</p>
        <input
          aria-label="Search stories"
          className="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, tags, and body text"
        />
      </header>

      <section className="masonry" aria-live="polite">
        {filtered.map((article) => (
          <article
            key={article.slug}
            className="card"
            style={{ viewTransitionName: `story-${article.slug}` }}
            onClick={() => navigateWithTransition(navigate, `/articles/${article.slug}`)}
          >
            {article.thumbnail ? (
              <img
                src={article.thumbnail}
                alt=""
                loading="lazy"
                decoding="async"
                className="card-image"
                sizes="(max-width: 900px) 100vw, 33vw"
              />
            ) : null}
            <div className="card-body">
              <p className="eyebrow">{article.articleType.toUpperCase()}</p>
              <h2>{article.title}</h2>
              <p>{article.description || `${article.wordCount} words`}</p>
              <div className="meta">{article.readingTime} min • {article.date}</div>
              <div className="tags">
                {article.keywords.slice(0, 4).map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </>
  )
}

function ArticleView() {
  const { slug } = useParams()
  const [article, setArticle] = useState<ArticleChunk | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/data/articles/${slug}.json`)
      .then((res) => res.json())
      .then((data) => setArticle(data))
      .catch(() => setArticle(null))
  }, [slug])

  if (!article) {
    return <main className="reader"><p>Loading story…</p></main>
  }

  const description = article.description || article.plainText.slice(0, 150)

  return (
    <main className="reader">
      <Seo title={`${article.title} | NextDocsSearch`} description={description} path={`/articles/${article.slug}`} article={article} />
      <Link className="back" to="/">← All stories</Link>
      <article style={{ viewTransitionName: `story-${article.slug}` }}>
        <h1>{article.title}</h1>
        <p className="meta">{article.date} · {article.readingTime} min read · {article.author.join(', ')}</p>
        {article.heroImage ? (
          <img
            className="hero"
            src={article.heroImage}
            alt={article.title}
            loading="lazy"
            decoding="async"
            sizes="(max-width: 980px) 100vw, 980px"
          />
        ) : null}
        {article.articleVideo ? (
          <video className="video" controls preload="none" poster={article.heroImage || undefined}>
            <source src={article.articleVideo} type="video/mp4" />
          </video>
        ) : null}
        <p className="description">{description}</p>
        <pre className="content">{article.content}</pre>
      </article>
    </main>
  )
}

function AppRoutes() {
  const articles = useContentIndex()

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const manifest = await fetch('/data/prefetch-manifest.json').then((res) => res.json())
        await Promise.all((manifest.chunks as string[]).map((chunkPath) => fetch(chunkPath, { cache: 'force-cache' })))
      } catch {
        // noop
      }
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <Routes>
      <Route path="/" element={<ArticleGrid articles={articles} />} />
      <Route path="/articles/:slug" element={<ArticleView />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
