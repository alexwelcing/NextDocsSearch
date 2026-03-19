/**
 * New Article Layout - Confident Editorial Design
 * 
 * Key improvements:
 * - Text flows around images (magazine-style)
 * - Images integrated with content, not separate blocks
 * - Better visual hierarchy with pull quotes
 * - Asymmetric layouts that feel intentional
 * - Deeper scroll experience with parallax-lite
 */

import React, { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import styled, { css } from 'styled-components';
import type { MultiArtOption } from '@/lib/article-images';

export type DepthStage = 0 | 1 | 2 | 3;

/* -----------------------------------------------------------------------
   Main Container - Fluid with max-width that breathes
   ----------------------------------------------------------------------- */

export const ArticleContainer = styled.article`
  min-height: 100vh;
  background: #030308;
  color: #e0e0e0;
  font-size: 1.125rem;
  line-height: 1.75;
  overflow-x: hidden;

  /* Smooth scroll behavior */
  scroll-behavior: smooth;
`;

/* -----------------------------------------------------------------------
   Hero Section - Bold, cinematic opening
   ----------------------------------------------------------------------- */

interface HeroProps {
  $hasImage?: boolean;
}

export const HeroSection = styled.header<HeroProps>`
  position: relative;
  min-height: ${p => p.$hasImage ? '85vh' : '60vh'};
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 48px 24px 64px;
  margin-bottom: 48px;

  @media (min-width: 768px) {
    padding: 64px 48px 80px;
  }

  @media (min-width: 1200px) {
    padding: 80px 8vw 96px;
  }
`;

export const HeroBackground = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      transparent 0%,
      rgba(3, 3, 8, 0.4) 50%,
      rgba(3, 3, 8, 0.95) 100%
    );
  }

  img {
    object-fit: cover;
    width: 100%;
    height: 100%;
  }
`;

export const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 900px;
`;

export const ArticleTitle = styled.h1`
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin: 0 0 24px;
  text-transform: uppercase;

  /* Editorial underline */
  &::after {
    content: '';
    display: block;
    width: 120px;
    height: 4px;
    background: linear-gradient(90deg, #00d4ff, #ffd700);
    margin-top: 24px;
  }
`;

export const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  font-size: 0.85rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.6);

  span {
    display: flex;
    align-items: center;
    gap: 8px;

    &::before {
      content: '//';
      color: rgba(255, 255, 255, 0.3);
    }
  }
`;

/* -----------------------------------------------------------------------
   Body Content - Editorial flow with better typography
   ----------------------------------------------------------------------- */

export const BodyContainer = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px;

  @media (min-width: 768px) {
    padding: 0 48px;
  }

  @media (min-width: 1400px) {
    max-width: 800px;
  }

  /* Typography scale */
  h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    font-weight: 800;
    margin: 64px 0 24px;
    padding-left: 20px;
    border-left: 4px solid #00d4ff;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: #ffffff;
  }

  h3 {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 40px 0 16px;
    color: #00d4ff;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  p {
    margin-bottom: 1.6rem;
    color: #c8c8c8;
  }

  /* First paragraph - lead style */
  > p:first-of-type {
    font-size: 1.25rem;
    line-height: 1.7;
    color: #e8e8e8;
    font-weight: 400;
  }

  a {
    color: #00d4ff;
    text-decoration: none;
    border-bottom: 1px solid rgba(0, 212, 255, 0.3);
    transition: all 0.2s;

    &:hover {
      color: #ffd700;
      border-bottom-color: #ffd700;
    }
  }

  ul, ol {
    margin: 1.5rem 0;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.75rem;
    color: #c8c8c8;
  }

  blockquote {
    margin: 40px 0;
    padding: 24px 32px;
    background: rgba(0, 212, 255, 0.03);
    border-left: 4px solid #ffd700;
    font-style: italic;
    font-size: 1.15rem;
    color: #d0d0d0;
    position: relative;

    &::before {
      content: '"';
      position: absolute;
      top: 8px;
      left: 12px;
      font-size: 4rem;
      color: rgba(0, 212, 255, 0.1);
      font-family: Georgia, serif;
      line-height: 1;
    }
  }

  code {
    background: rgba(0, 212, 255, 0.08);
    border: 1px solid rgba(0, 212, 255, 0.15);
    padding: 2px 8px;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    font-size: 0.9em;
    color: #00d4ff;
  }

  pre {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 24px;
    overflow-x: auto;
    margin: 24px 0;

    code {
      background: none;
      border: none;
      padding: 0;
    }
  }
`;

/* -----------------------------------------------------------------------
   Inline Image - Text wraps around images
   ----------------------------------------------------------------------- */

interface InlineImageProps {
  $float?: 'left' | 'right';
  $width?: string;
}

export const InlineImageWrapper = styled.figure<InlineImageProps>`
  margin: 32px 0;
  
  ${p => p.$float === 'left' && css`
    float: left;
    margin-right: 32px;
    margin-left: calc(-1 * max(0px, (100vw - 720px) / 4));
    max-width: 45%;

    @media (max-width: 900px) {
      margin-left: 0;
      max-width: 50%;
    }

    @media (max-width: 640px) {
      float: none;
      margin: 32px 0;
      max-width: 100%;
    }
  `}

  ${p => p.$float === 'right' && css`
    float: right;
    margin-left: 32px;
    margin-right: calc(-1 * max(0px, (100vw - 720px) / 4));
    max-width: 45%;

    @media (max-width: 900px) {
      margin-right: 0;
      max-width: 50%;
    }

    @media (max-width: 640px) {
      float: none;
      margin: 32px 0;
      max-width: 100%;
    }
  `}

  ${p => !p.$float && css`
    width: 100%;
  `}

  img {
    width: 100%;
    height: auto;
    display: block;
  }
`;

export const InlineImageCaption = styled.figcaption`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 12px;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &::before {
    content: '↑ ';
    color: #00d4ff;
  }
`;

interface InlineImageComponentProps {
  image: MultiArtOption;
  float?: 'left' | 'right';
  caption?: string;
}

export function InlineImage({ image, float, caption }: InlineImageComponentProps) {
  return (
    <InlineImageWrapper $float={float}>
      <Image
        src={image.path}
        alt={caption || `${image.model} artwork`}
        width={600}
        height={400}
        style={{ width: '100%', height: 'auto' }}
      />
      {caption && (
        <InlineImageCaption>
          {image.model.replace(/-/g, ' ')} — {caption}
        </InlineImageCaption>
      )}
    </InlineImageWrapper>
  );
}

/* -----------------------------------------------------------------------
   Full Bleed Image - Breaks out of container
   ----------------------------------------------------------------------- */

export const FullBleedImage = styled.figure`
  margin: 64px calc(-50vw + 50%);
  width: 100vw;
  position: relative;
  left: 50%;
  right: 50%;
  transform: translateX(-50%);

  @media (min-width: 1200px) {
    margin: 80px calc(-50vw + 50% + 8vw);
  }

  img {
    width: 100%;
    height: auto;
    max-height: 80vh;
    object-fit: cover;
  }
`;

export const FullBleedCaption = styled.figcaption`
  text-align: center;
  padding: 16px 24px;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

/* -----------------------------------------------------------------------
   Side Panel - For asides, notes, tangential content
   ----------------------------------------------------------------------- */

interface SidePanelProps {
  $side?: 'left' | 'right';
}

export const SidePanel = styled.aside<SidePanelProps>`
  position: relative;
  margin: 40px 0;
  padding: 24px;
  background: rgba(0, 212, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.1);
  font-size: 0.95rem;

  @media (min-width: 1100px) {
    position: absolute;
    ${p => p.$side === 'left' ? 'right: 100%;' : 'left: 100%;'}
    ${p => p.$side === 'left' ? 'margin-right: 32px;' : 'margin-left: 32px;'}
    width: 280px;
    margin-top: 0;
  }

  h4 {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: #00d4ff;
    margin: 0 0 12px;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  }

  p {
    margin: 0;
    color: #a0a0a0;
  }
`;

/* -----------------------------------------------------------------------
   Section Divider - Visual break between major sections
   ----------------------------------------------------------------------- */

export const SectionDivider = styled.hr`
  border: none;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 212, 255, 0.3) 20%,
    rgba(255, 215, 0, 0.4) 50%,
    rgba(0, 212, 255, 0.3) 80%,
    transparent 100%
  );
  margin: 80px auto;
  max-width: 600px;
  position: relative;

  &::before {
    content: '◆';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: #030308;
    padding: 0 16px;
    color: rgba(255, 215, 0, 0.5);
    font-size: 0.75rem;
  }
`;

/* -----------------------------------------------------------------------
   Pull Quote - Standout quote block
   ----------------------------------------------------------------------- */

interface PullQuoteProps {
  $size?: 'small' | 'large';
}

export const PullQuote = styled.blockquote<PullQuoteProps>`
  margin: 48px 0;
  padding: 32px 40px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.05) 0%, rgba(255, 215, 0, 0.03) 100%);
  border: none;
  border-left: 4px solid #ffd700;
  position: relative;
  font-size: ${p => p.$size === 'large' ? '1.5rem' : '1.25rem'};
  line-height: 1.6;
  color: #e8e8e8;
  font-weight: 500;
  font-style: italic;

  @media (min-width: 900px) {
    margin: 64px calc(-1 * max(0px, (100vw - 720px) / 6));
    padding: 40px 48px;
  }

  &::before {
    content: '"';
    position: absolute;
    top: -10px;
    left: 20px;
    font-size: 6rem;
    color: rgba(0, 212, 255, 0.1);
    font-family: Georgia, serif;
    line-height: 1;
  }

  cite {
    display: block;
    margin-top: 16px;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    font-style: normal;
    font-weight: 400;

    &::before {
      content: '— ';
    }
  }
`;

/* -----------------------------------------------------------------------
   Gallery Grid - Multiple images in a grid
   ----------------------------------------------------------------------- */

export const GalleryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin: 48px calc(-50vw + 50%);
  width: 100vw;
  padding: 0 24px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
    padding: 0 48px;
  }

  @media (min-width: 1200px) {
    margin: 64px calc(-50vw + 50% + 8vw);
    gap: 24px;
  }

  img {
    width: 100%;
    height: 200px;
    object-fit: cover;

    @media (min-width: 768px) {
      height: 280px;
    }
  }
`;

/* -----------------------------------------------------------------------
   Footer Section - Author, share, related
   ----------------------------------------------------------------------- */

export const ArticleFooter = styled.footer`
  max-width: 720px;
  margin: 80px auto 0;
  padding: 48px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);

  @media (min-width: 768px) {
    padding: 64px 48px;
  }
`;

export const AuthorCard = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 40px;

  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00d4ff, #3b82f6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 24px;
    color: white;
    flex-shrink: 0;
  }

  .info {
    flex: 1;

    .name {
      font-weight: 600;
      color: #fff;
      font-size: 1.1rem;
      margin-bottom: 4px;
    }

    .title {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.9rem;
    }
  }

  .cta {
    padding: 10px 20px;
    background: transparent;
    border: 1px solid rgba(0, 212, 255, 0.3);
    color: #00d4ff;
    font-size: 0.85rem;
    text-decoration: none;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all 0.2s;
    white-space: nowrap;

    &:hover {
      background: rgba(0, 212, 255, 0.1);
      border-color: #00d4ff;
    }
  }

  @media (max-width: 600px) {
    flex-wrap: wrap;

    .cta {
      width: 100%;
      margin-top: 16px;
      text-align: center;
    }
  }
`;
