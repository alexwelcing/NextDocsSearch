import { useEffect } from 'react'
import type { ArticleChunk } from '../types'

const SITE_URL = 'https://alexwelcing.com'

interface SeoProps {
  title: string
  description: string
  path: string
  article?: ArticleChunk
}

export function Seo({ title, description, path, article }: SeoProps) {
  const canonical = `${SITE_URL}${path}`
  const ogImage = article?.ogImage ? `${SITE_URL}${article.ogImage}` : `${SITE_URL}/social-preview.png`

  useEffect(() => {
    const articleSchema = article
      ? {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          datePublished: article.date,
          dateModified: article.date,
          author: article.author.map((name) => ({ '@type': 'Person', name })),
          description,
          image: ogImage,
          mainEntityOfPage: canonical,
        }
      : null

    const breadcrumbSchema = article
      ? {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            { '@type': 'ListItem', position: 2, name: 'Articles', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 3, name: article.title, item: canonical },
          ],
        }
      : null

    document.title = title
    const upsertMeta = (keyAttr: 'name' | 'property', key: string, value: string) => {
      let el = document.head.querySelector(`meta[${keyAttr}="${key}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(keyAttr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', value)
    }

    const upsertCanonical = (value: string) => {
      let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.rel = 'canonical'
        document.head.appendChild(link)
      }
      link.href = value
    }

    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', 'index,follow')
    upsertCanonical(canonical)
    upsertMeta('property', 'og:title', title)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:type', article ? 'article' : 'website')
    upsertMeta('property', 'og:image', ogImage)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', title)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', ogImage)

    const scripts = document.head.querySelectorAll('script[data-pretext-jsonld="true"]')
    scripts.forEach((script) => script.remove())
    const payloads = [articleSchema, breadcrumbSchema].filter(Boolean)
    payloads.forEach((payload) => {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.dataset.pretextJsonld = 'true'
      script.textContent = JSON.stringify(payload)
      document.head.appendChild(script)
    })
  }, [article, canonical, description, ogImage, title])

  return null
}
