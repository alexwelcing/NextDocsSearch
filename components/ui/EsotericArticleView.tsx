import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Image from 'next/image';
import styled, { css } from 'styled-components';
import type { MultiArtOption } from '@/lib/article-images';
import type { ArticleChunk, TextBlockVariant } from './EsotericLayout';

interface EsotericArticleViewProps {
  title: string;
  date: string;
  author: string[];
  content: string;
  heroImage: string | null;
  multiArtImages: MultiArtOption[];
  slug: string;
}

const Root = styled.article`
  --color-ink: #e8e4dc;
  --color-ink-dim: #a09890;
  --color-accent: #00d4ff;
  --color-gold: #c9a227;
  --color-bg: #030308;

  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-prose, 'Georgia', serif);
  line-height: 1.75;
`;

const HeroFigure = styled.figure`
  margin: 0;
  position: relative;
  width: 100%;
  height: 60vh;
  min-height: 380px;
  max-height: 680px;
  overflow: hidden;

  img {
    object-fit: cover;
    object-position: center;
  }
`;

const HeroCaption = styled.figcaption`
  position: absolute;
  bottom: 16px;
  right: 20px;
  font-family: var(--font-mono, monospace);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.4);
  z-index: 2;
`;

const ArticleHeader = styled.header`
  max-width: 1200px;
  margin: 0 auto;
  padding: 72px 24px 56px;
`;

const ArticleTitle = styled.h1`
  font-family: var(--font-display, 'Helvetica Neue', sans-serif);
  font-size: clamp(2.2rem, 6vw, 4.8rem);
  font-weight: 900;
  line-height: 1.0;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: #fff;
  margin: 0 0 28px;
  max-width: 20ch;
`;

const TitleRule = styled.div`
  width: 72px;
  height: 4px;
  background: var(--color-gold);
  margin-bottom: 24px;
`;

const MetaBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-family: var(--font-mono, monospace);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-ink-dim);

  & > span:not(:first-child)::before {
    content: '//';
    margin-right: 16px;
    color: var(--color-accent);
  }
`;

const ContentBody = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px 80px;
`;

const SectionBlock = styled.section<{ $variant: TextBlockVariant }>`
  position: relative;
  margin-bottom: 64px;

  ${p => p.$variant === 'offset-left' && css`
    margin-left: -5%;
    padding-left: 5%;

    @media (min-width: 1024px) {
      margin-left: -12%;
      padding-left: 12%;
    }
  `}

  ${p => p.$variant === 'offset-right' && css`
    margin-right: -5%;
    padding-right: 5%;
    margin-left: 30%;

    @media (min-width: 1024px) {
      margin-right: -15%;
      margin-left: 40%;
      padding-right: 15%;
    }
  `}

  ${p => p.$variant === 'inset-left' && css`
    padding-left: 1.5rem;
    border-left: 3px solid var(--color-accent);

    @media (min-width: 1024px) {
      margin-left: -4%;
      padding-left: 4%;
    }
  `}

  ${p => p.$variant === 'inset-right' && css`
    padding-right: 1.5rem;
    border-right: 3px solid var(--color-gold);
    text-align: right;
    margin-left: 20%;

    @media (min-width: 1024px) {
      margin-right: -4%;
      padding-right: 4%;
      margin-left: 25%;
    }
  `}
`;

const ProseBlock = styled.div`
  font-size: 1.1rem;
  line-height: 1.85;
  max-width: 72ch;

  h2 {
    font-family: var(--font-display, sans-serif);
    font-size: 1.5rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #fff;
    margin: 2.5rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  h3 {
    font-family: var(--font-mono, monospace);
    font-size: 0.95rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-accent);
    margin: 2rem 0 0.75rem;
  }

  p {
    margin-bottom: 1.4rem;
  }

  strong { color: #fff; font-weight: 700; }
  em { font-style: italic; }

  a {
    color: var(--color-accent);
    text-decoration: none;
    border-bottom: 1px solid rgba(0, 212, 255, 0.3);
    &:hover { border-bottom-color: var(--color-accent); }
  }

  ul, ol {
    margin: 1.2rem 0;
    padding-left: 1.5rem;
  }

  li { margin-bottom: 0.5rem; }

  blockquote {
    margin: 2rem 0;
    padding: 1rem 1.5rem;
    border-left: 4px solid var(--color-gold);
    background: rgba(201, 162, 39, 0.04);
    font-style: italic;
    color: var(--color-ink-dim);
  }

  code {
    font-family: var(--font-mono, monospace);
    font-size: 0.88em;
    background: rgba(255, 255, 255, 0.04);
    padding: 2px 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  pre {
    background: transparent;
    border: none;
    padding: 0;
    margin: 1.5rem 0;
    overflow-x: visible;
    code { background: none; border: none; padding: 0; }
  }
`;

const MediaAside = styled.aside<{ $float: 'left' | 'right' | 'none' }>`
  display: ${p => p.$float === 'none' ? 'block' : 'none'};
  margin: 1.5rem 0;

  @media (min-width: 768px) {
    display: block;
    ${p => p.$float === 'left' && css`
      float: left;
      width: 40%;
      margin: 0.5rem 2rem 1rem 0;
    `}
    ${p => p.$float === 'right' && css`
      float: right;
      width: 40%;
      margin: 0.5rem 0 1rem 2rem;
    `}
  }
`;

const MediaFigure = styled.figure<{ $depth: number }>`
  margin: 0;
  position: relative;
  border: ${p => p.$depth >= 2 ? '2px solid rgba(0, 212, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.08)'};

  img {
    filter: ${p => {
      switch (p.$depth) {
        case 0: return 'grayscale(1) contrast(1.15)';
        case 1: return 'grayscale(0.5) contrast(1.1)';
        case 2: return 'grayscale(0.1) saturate(1.1)';
        case 3: return 'none';
        default: return 'grayscale(0.3)';
      }
    }};
  }
`;

const MediaCaption = styled.figcaption`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 5px 10px;
  font-family: var(--font-mono, monospace);
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.35);
  background: rgba(3, 3, 8, 0.8);
`;

const PullQuote = styled.aside`
  margin: 2.5rem 0;
  padding: 1.5rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  @media (min-width: 1024px) {
    margin-left: -10%;
    margin-right: 20%;
  }
`;

const PullQuoteGlyph = styled.div`
  font-family: var(--font-display, serif);
  font-size: 3.5rem;
  line-height: 0.8;
  color: var(--color-gold);
  opacity: 0.35;
  margin-bottom: 0.25rem;
`;

const PullQuoteText = styled.div`
  font-family: var(--font-display, serif);
  font-size: 1.4rem;
  font-style: italic;
  line-height: 1.45;
  color: #fff;
`;

const ClearFix = styled.div`
  clear: both;
`;

const SectionRule = styled.hr`
  border: none;
  margin: 0;
  padding: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
`;

function parseContentToChunks(content: string, multiArtImages: MultiArtOption[]): ArticleChunk[] {
  const lines = content.split('\n');
  const chunks: ArticleChunk[] = [];
  let currentLines: string[] = [];
  let sectionIndex = 0;

  const variants: TextBlockVariant[] = ['standard', 'offset-left', 'offset-right', 'inset-left', 'inset-right', 'wide'];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentLines.length > 0) {
        chunks.push({
          id: `section-${sectionIndex}`,
          content: currentLines.join('\n').trim(),
          variant: variants[sectionIndex % variants.length],
          mediaAnchor: multiArtImages[sectionIndex] || undefined,
        });
        sectionIndex++;
        currentLines = [];
      }
      currentLines.push(line);
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    chunks.push({
      id: `section-${sectionIndex}`,
      content: currentLines.join('\n').trim(),
      variant: variants[Math.min(sectionIndex, variants.length - 1)],
      mediaAnchor: multiArtImages[sectionIndex] || undefined,
    });
  }

  return chunks;
}

const mdComponents = {
  img: ({ src, alt }: { src?: string | Blob | undefined; alt?: string }) => {
    if (!src || typeof src !== 'string') return null;
    return (
      <figure style={{ margin: '1.5rem 0' }}>
        <Image src={src} alt={alt || ''} width={800} height={450} style={{ width: '100%', height: 'auto' }} />
      </figure>
    );
  },
};

export default function EsotericArticleView({
  title,
  date,
  author,
  content,
  heroImage,
  multiArtImages,
  slug,
}: EsotericArticleViewProps) {
  const chunks = useMemo(() => parseContentToChunks(content, multiArtImages), [content, multiArtImages]);

  return (
    <Root>
      {heroImage && (
        <HeroFigure>
          <Image src={heroImage} alt={title} fill priority sizes="(max-width: 768px) 100vw, 1400px" style={{ objectFit: 'cover' }} />
          <HeroCaption>{title}</HeroCaption>
        </HeroFigure>
      )}

      <ArticleHeader>
        <ArticleTitle>{title}</ArticleTitle>
        <TitleRule />
        <MetaBar>
          <span>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          <span>{author.join(', ')}</span>
        </MetaBar>
      </ArticleHeader>

      <ContentBody>
        {chunks.map((chunk, idx) => {
          const hasMediaFloat = chunk.mediaAnchor && chunk.variant !== 'wide';

          return (
            <SectionBlock key={chunk.id} $variant={chunk.variant}>
              {chunk.mediaAnchor && chunk.variant === 'wide' && (
                <MediaAside $float="none">
                  <MediaFigure $depth={idx % 4}>
                    <Image
                      src={chunk.mediaAnchor.path}
                      alt={chunk.mediaAnchor.model}
                      width={800}
                      height={500}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                    <MediaCaption>{chunk.mediaAnchor.model.replace(/-/g, ' ')}</MediaCaption>
                  </MediaFigure>
                </MediaAside>
              )}

              {chunk.mediaAnchor && hasMediaFloat && (
                <MediaAside $float={idx % 2 === 0 ? 'left' : 'right'}>
                  <MediaFigure $depth={idx % 4}>
                    <Image
                      src={chunk.mediaAnchor.path}
                      alt={chunk.mediaAnchor.model}
                      width={400}
                      height={280}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                    <MediaCaption>{chunk.mediaAnchor.model.replace(/-/g, ' ')}</MediaCaption>
                  </MediaFigure>
                </MediaAside>
              )}

              <ProseBlock>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {chunk.content}
                </ReactMarkdown>
              </ProseBlock>

              <ClearFix />

              {idx < chunks.length - 1 && <SectionRule />}
            </SectionBlock>
          );
        })}
      </ContentBody>
    </Root>
  );
}