import React from 'react';
import Image from 'next/image';
import styled, { css } from 'styled-components';
import type { MultiArtOption } from '@/lib/article-images';

/* ---------------------------------------------------------------------------
   ESOTERIC LAYOUT SYSTEM
   Atypographic article layout embracing asymmetry, offset text blocks,
   semantic media placement, and editorial-grade typography.

   Core principles:
   - No animation/motion effects (pure CSS)
   - Media anchored to relevant content sections
   - Off-axis paragraph alignment
   - Mixed column widths
   - Pull quotes, marginalia, drop caps where appropriate
   --------------------------------------------------------------------------- */

export type TextBlockVariant =
  | 'standard'      // Normal flowing text
  | 'inset-left'    // Indented left (text "steps in" from left margin)
  | 'inset-right'    // Indented right (text "steps in" from right margin)
  | 'offset-left'    // Offset into left margin (text bleeds into gutter)
  | 'offset-right'   // Offset into right margin (text bleeds into gutter)
  | 'wide'           // Breaks column width
  | 'full-bleed';    // Spans entire viewport

export interface ArticleChunk {
  id: string;
  content: string;
  variant: TextBlockVariant;
  mediaAnchor?: MultiArtOption;
  pullQuote?: string;
  marginalia?: string;
}

interface EsotericLayoutProps {
  chunks: ArticleChunk[];
  articleTitle: string;
  heroImage?: string | null;
}

/* ---------------------------------------------------------------------------
   Layout Grid — CSS Grid with named areas for flexible placement
   --------------------------------------------------------------------------- */

const LayoutRoot = styled.article`
  --color-ink: #e8e4dc;
  --color-ink-dim: #a09890;
  --color-accent: #00d4ff;
  --color-gold: #c9a227;
  --color-bg: #030308;
  --color-paper: #0c0c10;

  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: auto;
  gap: 0;
  background: var(--color-bg);
  color: var(--color-ink);
  font-family: var(--font-prose, 'Georgia', serif);
  line-height: 1.75;

  @media (min-width: 768px) {
    grid-template-columns: 1fr min(680px, 100%) 1fr;
  }
`;

/* ---------------------------------------------------------------------------
   Hero Image — Full-width cinematic opener
   --------------------------------------------------------------------------- */

const HeroWrapper = styled.div`
  grid-column: 1 / -1;
  position: relative;
  width: 100%;
  height: 55vh;
  min-height: 360px;
  max-height: 700px;
  overflow: hidden;

  img {
    object-fit: cover;
    object-position: center;
  }
`;

const HeroCaption = styled.figcaption`
  position: absolute;
  bottom: 12px;
  right: 16px;
  font-family: var(--font-mono, monospace);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.45);
  z-index: 2;
`;

/* ---------------------------------------------------------------------------
   Article Header — Title + meta with offset positioning
   --------------------------------------------------------------------------- */

const ArticleHeader = styled.header`
  grid-column: 1 / -1;
  padding: 64px 24px 48px;
  position: relative;

  @media (min-width: 768px) {
    padding: 80px 0 64px;
    grid-column: 2;
  }
`;

const ArticleTitle = styled.h1`
  font-family: var(--font-display, 'Helvetica Neue', sans-serif);
  font-size: clamp(2.4rem, 7vw, 5rem);
  font-weight: 900;
  line-height: 1.0;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  color: #fff;
  margin: 0 0 24px;
  max-width: 18ch;
`;

const TitleAccent = styled.span`
  display: block;
  width: 80px;
  height: 4px;
  background: var(--color-gold);
  margin-top: 20px;
`;

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-ink-dim);
  margin-top: 28px;
`;

const MetaDivider = styled.span`
  color: var(--color-accent);
  font-weight: 700;
`;

/* ---------------------------------------------------------------------------
   Content Sections — Each major topic gets a section
   --------------------------------------------------------------------------- */

const ContentSection = styled.section<{ $variant: TextBlockVariant }>`
  grid-column: 1 / -1;
  padding: 0 24px 56px;
  position: relative;

  @media (min-width: 768px) {
    grid-column: 2;
    padding: 0 0 64px;
  }

  ${p => p.$variant === 'wide' && css`
    @media (min-width: 768px) {
      grid-column: 1 / -1;
      padding: 0 48px 56px;
    }
  `}
`;

/* ---------------------------------------------------------------------------
   Text Block — Core prose with variant-driven offset styling
   --------------------------------------------------------------------------- */

const TextBlock = styled.div<{
  $variant: TextBlockVariant;
  $hasMediaLeft: boolean;
  $hasMediaRight: boolean;
}>`
  font-size: 1.1rem;
  line-height: 1.8;

  ${p => p.$variant === 'inset-left' && css`
    padding-left: 2rem;
    border-left: 3px solid var(--color-accent);
    margin-left: 0;

    @media (min-width: 768px) {
      margin-left: -3rem;
      padding-left: 3rem;
    }
  `}

  ${p => p.$variant === 'inset-right' && css`
    padding-right: 2rem;
    border-right: 3px solid var(--color-gold);
    margin-right: 0;
    text-align: right;

    @media (min-width: 768px) {
      margin-right: -3rem;
      padding-right: 3rem;
    }
  `}

  ${p => p.$variant === 'offset-left' && css`
    margin-left: -8%;

    @media (min-width: 768px) {
      margin-left: -12%;
    }
  `}

  ${p => p.$variant === 'offset-right' && css`
    margin-left: auto;
    max-width: 85%;

    @media (min-width: 768px) {
      margin-left: auto;
      margin-right: -8%;
      max-width: 75%;
    }
  `}

  ${p => p.$variant === 'wide' && css`
    @media (min-width: 768px) {
      margin-left: -12%;
      margin-right: -12%;
    }
  `}

  ${p => p.$variant === 'standard' && p.$hasMediaLeft && css`
    @media (min-width: 768px) {
      grid-column: 2;
    }
  `}

  /* Prose elements */
  h2 {
    font-family: var(--font-display, sans-serif);
    font-size: 1.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #fff;
    margin: 3rem 0 1.2rem;
    padding-bottom: 0.6rem;
    border-bottom: 2px solid rgba(255, 255, 255, 0.08);
  }

  h3 {
    font-family: var(--font-mono, monospace);
    font-size: 1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-accent);
    margin: 2rem 0 0.8rem;
  }

  p {
    margin-bottom: 1.5rem;
    hanging-punctuation: first last;
  }

  strong {
    font-weight: 700;
    color: #fff;
  }

  em {
    font-style: italic;
  }

  a {
    color: var(--color-accent);
    text-decoration: none;
    border-bottom: 1px solid rgba(0, 212, 255, 0.3);

    &:hover {
      border-bottom-color: var(--color-accent);
    }
  }

  ul, ol {
    margin: 1.2rem 0;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
  }

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

    code {
      background: none;
      border: none;
      padding: 0;
    }
  }
`;

/* ---------------------------------------------------------------------------
   Media Column — Floats next to relevant text
   --------------------------------------------------------------------------- */

const MediaColumn = styled.div<{
  $position: 'left' | 'right' | 'above' | 'below';
  $depth: number;
}>`
  position: relative;
  margin: 1.5rem 0;

  @media (min-width: 768px) {
    ${p => p.$position === 'left' && css`
      float: left;
      width: 42%;
      margin: 0.5rem 2rem 1rem 0;
    `}

    ${p => p.$position === 'right' && css`
      float: right;
      width: 42%;
      margin: 0.5rem 0 1rem 2rem;
    `}
  }

  /* Depth-based filter */
  ${p => p.$depth === 0 && css`
    filter: grayscale(1) contrast(1.15);
  `}
  ${p => p.$depth === 1 && css`
    filter: grayscale(0.5) contrast(1.1);
  `}
  ${p => p.$depth === 2 && css`
    filter: grayscale(0.15) saturate(1.1);
  `}
`;

const MediaFrame = styled.figure<{ $depth: number }>`
  margin: 0;
  padding: 0;
  position: relative;

  border: ${p => p.$depth >= 2 ? '2px solid rgba(0, 212, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)'};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    box-shadow: ${p => p.$depth >= 2
      ? 'inset 0 0 30px rgba(0, 0, 0, 0.4)'
      : 'inset 0 0 20px rgba(0, 0, 0, 0.6)'};
    pointer-events: none;
  }
`;

const MediaCaption = styled.figcaption<{ $depth: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 10px;
  font-family: var(--font-mono, monospace);
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${p => p.$depth >= 2 ? 'rgba(0, 212, 255, 0.7)' : 'rgba(255, 255, 255, 0.35)'};
  background: rgba(3, 3, 8, 0.75);
`;

/* ---------------------------------------------------------------------------
   Pull Quote — Large-offset quotations
   --------------------------------------------------------------------------- */

const PullQuoteWrapper = styled.aside<{ $alignment: 'left' | 'right' | 'center' }>`
  margin: 2.5rem 0;
  padding: 2rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  text-align: ${p => p.$alignment};

  @media (min-width: 768px) {
    margin: ${p => p.$alignment === 'center' ? '3rem -15%' : '3rem 0'};
    padding: ${p => p.$alignment === 'center' ? '2rem 15%' : '2rem 0'};
    text-align: ${p => p.$alignment};

    ${p => p.$alignment === 'left' && css`
      margin-left: -18%;
      margin-right: 15%;
    `}

    ${p => p.$alignment === 'right' && css`
      margin-left: 15%;
      margin-right: -18%;
    `}
  }
`;

const PullQuoteMark = styled.div`
  font-family: var(--font-display, serif);
  font-size: 4rem;
  line-height: 0.5;
  color: var(--color-gold);
  opacity: 0.4;
  margin-bottom: 0.5rem;
`;

const PullQuoteText = styled.div`
  font-family: var(--font-display, serif);
  font-size: 1.5rem;
  font-weight: 400;
  font-style: italic;
  line-height: 1.4;
  color: #fff;
  margin: 0;
`;

const PullQuoteAttribution = styled.cite`
  display: block;
  margin-top: 1rem;
  font-family: var(--font-mono, monospace);
  font-size: 0.72rem;
  font-style: normal;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--color-ink-dim);
`;

/* ---------------------------------------------------------------------------
   Marginalia — Side annotations
   --------------------------------------------------------------------------- */

const MarginaliaWrapper = styled.aside<{ $side: 'left' | 'right' }>`
  display: none;
  position: relative;

  @media (min-width: 1024px) {
    display: block;
    width: 120px;
    flex-shrink: 0;
    padding: 0 16px;
    font-family: var(--font-mono, monospace);
    font-size: 0.65rem;
    line-height: 1.5;
    color: var(--color-ink-dim);
    opacity: 0.7;

    ${p => p.$side === 'left' && css`
      order: -1;
      text-align: right;
      border-right: 1px solid rgba(255, 255, 255, 0.06);
    `}

    ${p => p.$side === 'right' && css`
      order: 1;
      text-align: left;
      border-left: 1px solid rgba(255, 255, 255, 0.06);
    `}
  }
`;

const MarginaliaLabel = styled.div`
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-accent);
  margin-bottom: 4px;
`;

/* ---------------------------------------------------------------------------
   Section Wrapper — Groups chunk + optional media/marginalia
   --------------------------------------------------------------------------- */

const SectionRow = styled.div<{ $hasMarginalia: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0;

  @media (min-width: 1024px) {
    flex-direction: row;
    align-items: flex-start;
    gap: 0;
  }
`;

const SectionContent = styled.div<{ $variant: TextBlockVariant }>`
  flex: 1;
  min-width: 0;

  /* Variant-based offset transforms */
  ${p => p.$variant === 'offset-left' && css`
    @media (min-width: 1024px) {
      margin-left: -8%;
    }
  `}

  ${p => p.$variant === 'offset-right' && css`
    @media (min-width: 1024px) {
      margin-right: -8%;
      margin-left: auto;
    }
  `}
`;

/* ---------------------------------------------------------------------------
   ClearFloat — Prevent media floats from breaking layout
   --------------------------------------------------------------------------- */

const ClearFloat = styled.div`
  clear: both;
`;

/* ---------------------------------------------------------------------------
   Section Divider — Visual break between major sections
   --------------------------------------------------------------------------- */

const SectionDivider = styled.hr<{ $depth: number }>`
  border: none;
  margin: 0 0 48px;
  padding: 0;
  height: 1px;
  background: ${p => {
    switch (p.$depth) {
      case 0: return 'rgba(255, 255, 255, 0.04)';
      case 1: return 'rgba(255, 255, 255, 0.08)';
      case 2: return 'linear-gradient(to right, transparent, rgba(0, 212, 255, 0.2), transparent)';
      case 3: return 'linear-gradient(to right, transparent, rgba(201, 162, 39, 0.3) 30%, rgba(0, 212, 255, 0.3) 70%, transparent)';
      default: return 'rgba(255, 255, 255, 0.04)';
    }
  }};

  ${p => p.$depth === 3 && css`
    height: 2px;
  `}
`;

/* ---------------------------------------------------------------------------
   Image size map — keeps Next/Image happy
   --------------------------------------------------------------------------- */

const imageSizes: Record<string, string> = {
  hero: '(max-width: 768px) 100vw, 1400px',
  media: '(max-width: 768px) 100vw, 400px',
  thumbnail: '(max-width: 768px) 50vw, 150px',
};

/* ---------------------------------------------------------------------------
   Main EsotericLayout Component
   --------------------------------------------------------------------------- */

export default function EsotericLayout({ chunks, articleTitle, heroImage }: EsotericLayoutProps) {
  let mediaDepth = 0;

  return (
    <LayoutRoot>
      {/* Hero Image */}
      {heroImage && (
        <HeroWrapper>
          <Image
            src={heroImage}
            alt={articleTitle}
            fill
            priority
            sizes={imageSizes.hero}
            style={{ objectFit: 'cover' }}
          />
          <HeroCaption>{articleTitle}</HeroCaption>
        </HeroWrapper>
      )}

      {/* Article Header */}
      <ArticleHeader>
        <ArticleTitle>{articleTitle}</ArticleTitle>
        <TitleAccent />
        <ArticleMeta>
          <span>2025-04-14</span>
          <MetaDivider>{'//'}</MetaDivider>
          <span>Alex Welcing</span>
          <MetaDivider>{'//'}</MetaDivider>
          <span>8 min read</span>
        </ArticleMeta>
      </ArticleHeader>

      {/* Content Chunks */}
      {chunks.map((chunk, idx) => {
        const isWide = chunk.variant === 'wide' || chunk.variant === 'full-bleed';
        const hasMediaLeft = chunk.mediaAnchor && !isWide;
        const hasMediaRight = chunk.mediaAnchor && !isWide;

        return (
          <ContentSection key={chunk.id} $variant={chunk.variant}>
            <SectionRow $hasMarginalia={!!chunk.marginalia}>
              {/* Left Marginalia */}
              {chunk.marginalia && (
                <MarginaliaWrapper $side="left">
                  <MarginaliaLabel>Note</MarginaliaLabel>
                  {chunk.marginalia}
                </MarginaliaWrapper>
              )}

              {/* Main Content */}
              <SectionContent $variant={chunk.variant}>
                {/* Media above/below text */}
                {chunk.mediaAnchor && (
                  <MediaColumn $position="above" $depth={mediaDepth}>
                    <MediaFrame $depth={mediaDepth}>
                      <Image
                        src={chunk.mediaAnchor.path}
                        alt={chunk.mediaAnchor.model}
                        fill
                        sizes={imageSizes.media}
                        style={{ objectFit: 'cover' }}
                      />
                      <MediaCaption $depth={mediaDepth}>
                        {chunk.mediaAnchor.model.replace(/-/g, ' ')}
                      </MediaCaption>
                    </MediaFrame>
                  </MediaColumn>
                )}

                {/* Pull Quote */}
                {chunk.pullQuote && (
                  <PullQuoteWrapper $alignment={chunk.variant === 'offset-right' ? 'right' : chunk.variant === 'offset-left' ? 'left' : 'left'}>
                    <PullQuoteMark>{'\u201C'}</PullQuoteMark>
                    <PullQuoteText>{chunk.pullQuote}</PullQuoteText>
                  </PullQuoteWrapper>
                )}

                {/* Prose Block */}
                <TextBlock
                  $variant={chunk.variant}
                  $hasMediaLeft={!!hasMediaLeft}
                  $hasMediaRight={!!hasMediaRight}
                  dangerouslySetInnerHTML={{ __html: chunk.content }}
                />

                <ClearFloat />
              </SectionContent>

              {/* Right Marginalia */}
              {chunk.marginalia && (
                <MarginaliaWrapper $side="right">
                  <MarginaliaLabel>Ref</MarginaliaLabel>
                  {chunk.marginalia}
                </MarginaliaWrapper>
              )}
            </SectionRow>

            {/* Section Divider */}
            {idx < chunks.length - 1 && (
              <SectionDivider $depth={Math.min(mediaDepth, 3)} />
            )}
          </ContentSection>
        );
      })}
    </LayoutRoot>
  );
}

