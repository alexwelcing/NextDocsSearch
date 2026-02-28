import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import styled from 'styled-components'

interface CollectionArticle {
  slug: string
  title: string
  description?: string
  date?: string
  heroImage?: string
}

interface CollectionShowcaseProps {
  title: string
  description: string
  href: string
  articles: CollectionArticle[]
  accentColor?: string
  variant?: 'hero' | 'compact'
}

const ShowcaseContainer = styled.section<{ $accent: string }>`
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  background: #0a0a14;
  transition: all 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: ${({ $accent }) => $accent};
    opacity: 0.6;
    z-index: 1;
  }

  &:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.4);
  }
`

const ShowcaseHeader = styled.div`
  padding: 32px 32px 24px;
`

const ShowcaseTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px 0;
  font-family: monospace;
  letter-spacing: -0.02em;
`

const ShowcaseDescription = styled.p`
  font-size: 0.9rem;
  color: #888;
  margin: 0 0 16px 0;
  line-height: 1.6;
  max-width: 600px;
`

const ShowcaseMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

const ArticleCount = styled.span`
  font-family: monospace;
  font-size: 0.75rem;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const ViewAllLink = styled(Link)<{ $accent: string }>`
  font-family: monospace;
  font-size: 0.75rem;
  color: ${({ $accent }) => $accent.split(',')[0].replace('linear-gradient(135deg, ', '')};
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`

const ImageStrip = styled.div`
  display: flex;
  gap: 2px;
  overflow-x: auto;
  padding: 0 32px 24px;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

const ImageStripItem = styled(Link)`
  position: relative;
  flex: 0 0 180px;
  height: 120px;
  border-radius: 6px;
  overflow: hidden;
  text-decoration: none;
  transition: all 0.25s ease;

  &:hover {
    transform: scale(1.03);
    z-index: 1;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
  }
`

const ImageOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
  z-index: 1;
`

const ImageTitle = styled.span`
  font-size: 0.65rem;
  color: #ccc;
  font-family: monospace;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const PlaceholderThumb = styled.div<{ $accent: string }>`
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #111 0%, #1a1a2e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: monospace;
  font-size: 0.6rem;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`

/* Compact variant - horizontal card with side image mosaic */
const CompactContainer = styled.section<{ $accent: string }>`
  position: relative;
  display: grid;
  grid-template-columns: 1fr 200px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
  background: #0a0a14;
  transition: all 0.3s ease;
  min-height: 140px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 2px;
    background: ${({ $accent }) => $accent};
    opacity: 0.6;
    z-index: 1;
  }

  &:hover {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }
`

const CompactBody = styled.div`
  padding: 24px 24px 24px 28px;
  display: flex;
  flex-direction: column;
  justify-content: center;
`

const CompactTitle = styled.h3`
  font-size: 1.15rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 6px 0;
  font-family: monospace;
  letter-spacing: -0.02em;
`

const CompactDescription = styled.p`
  font-size: 0.8rem;
  color: #777;
  margin: 0 0 12px 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`

const CompactMosaic = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;

  @media (max-width: 640px) {
    display: none;
  }
`

const MosaicTile = styled.div`
  position: relative;
  overflow: hidden;
  background: #111;
`

const ACCENT_COLORS: Record<string, string> = {
  cyan: 'linear-gradient(135deg, #00d4ff, #0099cc)',
  gold: 'linear-gradient(135deg, #ffd700, #cc9900)',
  purple: 'linear-gradient(135deg, #a855f7, #7c3aed)',
  pink: 'linear-gradient(135deg, #f472b6, #ec4899)',
  green: 'linear-gradient(135deg, #10b981, #059669)',
  blue: 'linear-gradient(135deg, #3b82f6, #2563eb)',
}

export default function CollectionShowcase({
  title,
  description,
  href,
  articles,
  accentColor = 'cyan',
  variant = 'hero',
}: CollectionShowcaseProps) {
  const accent = ACCENT_COLORS[accentColor] || ACCENT_COLORS.cyan

  if (variant === 'compact') {
    const previewArticles = articles.slice(0, 4)
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        <CompactContainer $accent={accent}>
          <CompactBody>
            <CompactTitle>{title}</CompactTitle>
            <CompactDescription>{description}</CompactDescription>
            <ArticleCount>{articles.length} articles</ArticleCount>
          </CompactBody>
          <CompactMosaic>
            {previewArticles.map((article) => (
              <MosaicTile key={article.slug}>
                {article.heroImage ? (
                  <Image
                    src={article.heroImage}
                    alt={article.title}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="100px"
                  />
                ) : (
                  <PlaceholderThumb $accent={accent}>
                    {article.title.split(' ').slice(0, 2).join(' ')}
                  </PlaceholderThumb>
                )}
              </MosaicTile>
            ))}
          </CompactMosaic>
        </CompactContainer>
      </Link>
    )
  }

  return (
    <ShowcaseContainer $accent={accent}>
      <ShowcaseHeader>
        <ShowcaseTitle>{title}</ShowcaseTitle>
        <ShowcaseDescription>{description}</ShowcaseDescription>
        <ShowcaseMeta>
          <ArticleCount>{articles.length} articles</ArticleCount>
          <ViewAllLink href={href} $accent={accent}>
            View collection &rarr;
          </ViewAllLink>
        </ShowcaseMeta>
      </ShowcaseHeader>

      <ImageStrip>
        {articles.map((article) => (
          <ImageStripItem key={article.slug} href={`/articles/${article.slug}`}>
            {article.heroImage ? (
              <Image
                src={article.heroImage}
                alt={article.title}
                fill
                style={{ objectFit: 'cover' }}
                sizes="180px"
              />
            ) : (
              <PlaceholderThumb $accent={accent}>
                {article.title.split(' ').slice(0, 2).join(' ')}
              </PlaceholderThumb>
            )}
            <ImageOverlay>
              <ImageTitle>{article.title}</ImageTitle>
            </ImageOverlay>
          </ImageStripItem>
        ))}
      </ImageStrip>
    </ShowcaseContainer>
  )
}
