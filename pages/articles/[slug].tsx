import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import StructuredData from '../../components/StructuredData';
import ArticleClassification, { inferClassificationFromSlug } from '@/components/ArticleClassification';
import CircleNav from '@/components/ui/CircleNav';
import styled, { css } from 'styled-components';
import { escapeMdxContent } from '@/lib/utils';
import MarkdownImage from '@/components/ui/MarkdownImage';
import { useArticleDiscovery } from '@/components/ArticleDiscoveryProvider';
import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Star, ArrowRight, Wand2 } from 'lucide-react';
import type { ArticleMediaWithUrl } from '@/types/article-media';
import VideoComponent from '@/components/VideoComponent';
import { createVideoSchema } from '@/components/StructuredData';
import HandwrittenNote from '@/components/ui/HandwrittenNote';
import { BottomCarousel } from '@/components/ArticleRecommendations';
import ArticleFooterPanels from '@/components/ArticleFooterPanels';
import { discoverArticleImages } from '@/lib/article-images';
import { SITE_URL } from '@/lib/site-url';
import type { MultiArtOption } from '@/lib/article-images';
import { useSupabaseData } from '@/components/contexts/SupabaseDataContext';
import { buildStoryCompanion } from '@/lib/articles/storyCompanion';
import StoryConstellationPreview from '@/components/articles/StoryConstellationPreview';
import { getRelatedArticles } from '@/lib/articles/cache';

interface ArticleProps {
  title: string;
  date: string;
  author: string[];
  content: string;
  articleType: 'fiction' | 'research';
  description?: string;
  keywords?: string[];
  ogImage?: string;
  heroImage: string | null;
  multiArtImages: MultiArtOption[];
  videoURL?: string;
  articleVideo?: string;
  readingTime: number;
  relatedArticles: Array<{
    slug: string;
    title: string;
    description: string;
    ogImage?: string;
    heroImage: string | null;
  }>;
  slug: string;
}

// =============================================================================
// EXCITING EDITORIAL LAYOUT - Dynamic, asymmetric, multiple art pieces
// =============================================================================

const ArticleLayout = styled.div`
  min-height: 100vh;
  background: #030308;
  overflow-x: hidden;
`;

// Hero Section - Bold cinematic opening with multiple art hint
const HeroSection = styled.header<{ $hasImage: boolean }>`
  position: relative;
  min-height: ${p => p.$hasImage ? '90vh' : '60vh'};
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 48px 24px 64px;
  margin-bottom: 0;

  @media (min-width: 768px) {
    padding: 64px 48px 80px;
  }

  @media (min-width: 1200px) {
    padding: 80px 8vw 96px;
  }
`;

const HeroBackground = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      rgba(3, 3, 8, 0.3) 0%,
      rgba(3, 3, 8, 0.5) 30%,
      rgba(3, 3, 8, 0.7) 50%,
      rgba(3, 3, 8, 0.9) 70%,
      #030308 100%
    );
  }

  img {
    object-fit: cover;
    width: 100%;
    height: 100%;
  }
`;

const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 900px;
`;

const ArticleTitle = styled.h1`
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.04em;
  color: #ffffff;
  margin: 0 0 24px;
  text-transform: uppercase;

  &::after {
    content: '';
    display: block;
    width: 120px;
    height: 4px;
    background: linear-gradient(90deg, #00d4ff, #ffd700, #ff006e);
    margin-top: 24px;
  }
`;

const ArticleMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  font-size: 0.8rem;
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

// ============================================================================
// ART GALLERY SECTION - Multiple pieces displayed dramatically
// ============================================================================

const ArtGallerySection = styled.section`
  padding: 48px 24px 64px;
  background: linear-gradient(180deg, #030308 0%, #0a0a14 50%, #030308 100%);
  
  @media (min-width: 768px) {
    padding: 64px 48px 80px;
  }
  
  @media (min-width: 1200px) {
    padding: 80px 8vw 96px;
  }
`;

const GalleryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: rgba(255, 255, 255, 0.4);
  
  svg {
    width: 16px;
    height: 16px;
    color: #ffd700;
  }
`;

// Asymmetric mosaic grid for art pieces
const ArtMosaic = styled.div<{ $count: number }>`
  display: grid;
  gap: 16px;
  
  ${p => {
    if (p.$count <= 2) return css`
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    `;
    if (p.$count === 3) return css`
      grid-template-columns: 2fr 1fr;
      grid-template-rows: 1fr 1fr;
      
      > *:first-child {
        grid-row: 1 / -1;
      }
      
      @media (max-width: 900px) {
        grid-template-columns: 1fr;
        grid-template-rows: auto;
        > *:first-child { grid-row: auto; }
      }
    `;
    if (p.$count === 4) return css`
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: 2fr 1fr;
      
      > *:nth-child(1) { grid-column: 1; grid-row: 1; }
      > *:nth-child(2) { grid-column: 2; grid-row: 1; }
      > *:nth-child(3) { grid-column: 1; grid-row: 2; }
      > *:nth-child(4) { grid-column: 2; grid-row: 2; }
      
      @media (max-width: 900px) {
        grid-template-columns: 1fr;
        grid-template-rows: repeat(4, 200px);
        > * { grid-column: auto !important; grid-row: auto !important; }
      }
    `;
    return css`
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: 2fr 1fr;
      
      > *:nth-child(1) { grid-column: 1 / 3; grid-row: 1; }
      > *:nth-child(2) { grid-column: 3; grid-row: 1; }
      > *:nth-child(3) { grid-column: 1; grid-row: 2; }
      > *:nth-child(4) { grid-column: 2; grid-row: 2; }
      > *:nth-child(5) { grid-column: 3; grid-row: 2; }
      
      @media (max-width: 900px) {
        grid-template-columns: repeat(2, 1fr);
        grid-template-rows: repeat(3, 180px);
        > *:nth-child(1) { grid-column: 1 / -1; grid-row: 1; }
        > *:nth-child(2) { grid-column: 1; grid-row: 2; }
        > *:nth-child(3) { grid-column: 2; grid-row: 2; }
        > *:nth-child(4) { grid-column: 1; grid-row: 3; }
        > *:nth-child(5) { grid-column: 2; grid-row: 3; }
      }
      
      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        grid-template-rows: repeat(5, 200px);
        > * { grid-column: 1 !important; }
      }
    `;
  }}
`;

const ArtPiece = styled.div<{ $path: string; $index: number }>`
  position: relative;
  min-height: ${p => p.$index === 0 ? '400px' : '200px'};
  border-radius: 4px;
  overflow: hidden;
  background-image: url(${p => p.$path});
  background-size: cover;
  background-position: center;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(3, 3, 8, 0.8) 0%,
      transparent 40%
    );
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  &:hover {
    transform: scale(1.02) translateY(-4px);
    border-color: rgba(0, 212, 255, 0.3);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    
    &::after { opacity: 1; }
  }
  
  .art-label {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255, 255, 255, 0.7);
    z-index: 1;
    transform: translateY(20px);
    opacity: 0;
    transition: all 0.3s;
  }
  
  &:hover .art-label {
    transform: translateY(0);
    opacity: 1;
  }
`;

// ============================================================================
// BODY CONTENT - Editorial typography with exciting interruptions
// ============================================================================

const BodyContainer = styled.div`
  max-width: 680px;
  margin: 0 auto;
  padding: 48px 24px 0;
  font-size: 1.125rem;
  line-height: 1.75;
  color: #c8c8c8;

  @media (min-width: 768px) {
    padding: 64px 48px 0;
  }

  @media (min-width: 1400px) {
    max-width: 720px;
  }

  h2 {
    font-size: clamp(1.5rem, 3.5vw, 2.25rem);
    font-weight: 800;
    margin: 64px 0 24px;
    padding-left: 20px;
    border-left: 4px solid #00d4ff;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: #ffffff;
  }

  h3 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 40px 0 16px;
    color: #ffd700;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  p {
    margin-bottom: 1.5rem;
  }

  > p:first-of-type {
    font-size: 1.35rem;
    line-height: 1.6;
    color: #e8e8e8;
    font-weight: 400;
    
    &::first-letter {
      font-size: 4rem;
      float: left;
      line-height: 1;
      margin-right: 12px;
      margin-top: -8px;
      font-weight: 900;
      background: linear-gradient(135deg, #00d4ff, #ffd700);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
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
  }

  blockquote {
    margin: 48px -24px;
    padding: 32px 36px;
    background: linear-gradient(135deg, rgba(0, 212, 255, 0.05) 0%, rgba(255, 215, 0, 0.03) 100%);
    border-left: 4px solid #ffd700;
    font-style: italic;
    font-size: 1.2rem;
    color: #e0e0e0;
    position: relative;
    
    @media (max-width: 768px) {
      margin: 48px -16px;
      padding: 24px;
    }

    &::before {
      content: '"';
      position: absolute;
      top: -10px;
      left: 20px;
      font-size: 6rem;
      color: rgba(255, 215, 0, 0.1);
      font-family: Georgia, serif;
      line-height: 1;
    }

    p:last-child {
      margin-bottom: 0;
    }
  }

  code {
    background: rgba(0, 212, 255, 0.08);
    border: 1px solid rgba(0, 212, 255, 0.15);
    padding: 2px 6px;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    font-size: 0.88em;
    color: #00d4ff;
  }

  pre {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 20px;
    overflow-x: auto;
    margin: 24px 0;
    font-size: 0.9rem;

    code {
      background: none;
      border: none;
      padding: 0;
    }
  }
`;

// Navigation pills
const NavPills = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 48px;
  padding-bottom: 32px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const NavPill = styled(Link)`
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.75rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-decoration: none;
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.4);
    color: #00d4ff;
  }
`;

// ============================================================================
// EXCITING IMAGE LAYOUTS - Breaking the grid
// ============================================================================

// Full-bleed cinematic image
const CinematicImage = styled.figure`
  margin: 64px calc(-50vw + 50%);
  width: 100vw;
  position: relative;
  
  @media (min-width: 1200px) {
    margin: 80px calc(-50vw + 50% + 8vw);
    width: calc(100vw - 16vw);
  }

  img {
    width: 100%;
    height: auto;
    max-height: 80vh;
    object-fit: cover;
    display: block;
  }
`;

// Offset image - breaks right
const OffsetImageRight = styled.figure`
  margin: 48px -48px 48px 24px;
  position: relative;
  
  @media (max-width: 768px) {
    margin: 48px -24px;
  }
  
  img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 4px;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 16px;
    left: -16px;
    right: 16px;
    bottom: -16px;
    border: 2px solid rgba(0, 212, 255, 0.2);
    border-radius: 4px;
    z-index: -1;
  }
`;

// Offset image - breaks left  
const OffsetImageLeft = styled.figure`
  margin: 48px 24px 48px -48px;
  position: relative;
  
  @media (max-width: 768px) {
    margin: 48px -24px;
  }
  
  img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 4px;
  }
  
  &::before {
    content: '';
    position: absolute;
    top: 16px;
    left: 16px;
    right: -16px;
    bottom: -16px;
    border: 2px solid rgba(255, 215, 0, 0.2);
    border-radius: 4px;
    z-index: -1;
  }
`;

// Floating image with text wrap
const FloatingImage = styled.figure<{ $side: 'left' | 'right' }>`
  float: ${p => p.$side};
  margin: 8px ${p => p.$side === 'left' ? '24px' : '0'} 16px ${p => p.$side === 'left' ? '0' : '24px'};
  width: 45%;
  
  @media (max-width: 600px) {
    float: none;
    width: 100%;
    margin: 32px -24px;
  }
  
  img {
    width: 100%;
    height: auto;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
`;

// Side-by-side comparison
const DuoImage = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 48px -24px;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    margin: 48px -16px;
  }
  
  img {
    width: 100%;
    height: 250px;
    object-fit: cover;
    border-radius: 4px;
  }
`;

// Triptych
const Triptych = styled.div`
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
  margin: 48px -48px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 200px 150px;
    margin: 48px -24px;
  }
  
  @media (max-width: 500px) {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(3, 180px);
  }
  
  > *:first-child {
    grid-row: 1 / -1;
    
    @media (max-width: 500px) {
      grid-row: auto;
    }
  }
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 4px;
  }
`;

const ImageCaption = styled.figcaption`
  text-align: center;
  padding: 16px 24px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

// Section divider with animation
const SectionDivider = styled.hr`
  border: none;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    #00d4ff 20%,
    #ffd700 50%,
    #ff006e 80%,
    transparent 100%
  );
  margin: 80px auto;
  max-width: 200px;
  position: relative;
  
  &::before {
    content: '◆';
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: #030308;
    padding: 0 16px;
    color: #ffd700;
    font-size: 0.8rem;
  }
`;

// Pull quote - dramatic interruption
const PullQuote = styled.blockquote`
  margin: 56px -48px;
  padding: 40px 48px;
  background: linear-gradient(135deg, rgba(255, 0, 110, 0.08) 0%, rgba(0, 212, 255, 0.05) 100%);
  border: 1px solid rgba(255, 0, 110, 0.2);
  border-radius: 4px;
  text-align: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.4;
  
  @media (max-width: 768px) {
    margin: 56px -24px;
    padding: 32px 24px;
    font-size: 1.2rem;
  }
  
  p { margin: 0; }
`;

// Author card
const AuthorCard = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 28px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin: 56px 0;
  border-radius: 4px;

  .avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #00d4ff, #ff006e);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 24px;
    color: white;
    flex-shrink: 0;
  }

  .info {
    flex: 1;

    .name {
      font-weight: 700;
      color: #fff;
      margin-bottom: 6px;
      font-size: 1.1rem;
    }

    .title {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.9rem;
    }
  }

  .cta {
    padding: 12px 20px;
    background: transparent;
    border: 1px solid rgba(0, 212, 255, 0.4);
    color: #00d4ff;
    font-size: 0.8rem;
    text-decoration: none;
    font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all 0.2s;
    white-space: nowrap;
    border-radius: 4px;

    &:hover {
      background: rgba(0, 212, 255, 0.1);
      border-color: #00d4ff;
    }

    @media (max-width: 600px) {
      display: none;
    }
  }
`;

// Share section
const ShareSection = styled.div`
  display: flex;
  gap: 12px;
  margin: 48px 0;
  padding: 28px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const ShareButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(0, 212, 255, 0.05);
  border: 1px solid rgba(0, 212, 255, 0.2);
  color: rgba(0, 212, 255, 0.9);
  text-decoration: none;
  font-size: 0.8rem;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  transition: all 0.2s;
  border-radius: 4px;

  &:hover {
    background: rgba(0, 212, 255, 0.1);
    border-color: rgba(0, 212, 255, 0.5);
    color: #00d4ff;
    transform: translateY(-2px);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

// Discover section
const DiscoverSection = styled.section`
  margin: 56px 0;
  padding: 36px;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.06) 0%, rgba(255, 0, 110, 0.03) 100%);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 4px;
`;

const DiscoverContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;

  @media (max-width: 600px) {
    flex-direction: column;
    text-align: center;
  }
`;

const DiscoverLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;

  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const DiscoverIcon = styled.div`
  width: 52px;
  height: 52px;
  background: linear-gradient(135deg, #00d4ff 0%, #ffd700 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 4px;

  svg {
    width: 26px;
    height: 26px;
    color: #030308;
  }
`;

const DiscoverText = styled.div`
  h3 {
    font-size: 1.3rem;
    font-weight: 800;
    color: #fff;
    margin: 0 0 6px 0;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  p {
    font-size: 0.95rem;
    color: #9ca3af;
    margin: 0;
  }
`;

const DiscoverButton = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 28px;
  background: linear-gradient(135deg, #00d4ff 0%, #ffd700 100%);
  border: none;
  color: #030308;
  font-size: 0.9rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  border-radius: 4px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 212, 255, 0.3);
  }

  svg {
    width: 18px;
    height: 18px;
  }
`;

// Footer wrapper
const FooterWrapper = styled.div`
  max-width: 720px;
  margin: 0 auto;
  padding: 0 24px 64px;

  @media (min-width: 768px) {
    padding: 0 48px 80px;
  }
`;

// =============================================================================
// PAGE COMPONENT
// =============================================================================

const ArticlePage: NextPage<ArticleProps> = ({
  title,
  date,
  author,
  content,
  description,
  keywords,
  ogImage,
  heroImage,
  multiArtImages,
  videoURL,
  articleVideo,
  readingTime,
  relatedArticles,
  slug,
  articleType,
}) => {
  const siteUrl = SITE_URL;
  const articleUrl = `${siteUrl}/articles/${slug}`;
  const defaultOgImage = `${siteUrl}/og-default.png`;
  const fullOgImage = ogImage ? (ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage}`) : defaultOgImage;

  const { openModal, setCurrentArticle } = useArticleDiscovery();
  const { chatData, sendMessage } = useSupabaseData();

  useEffect(() => {
    setCurrentArticle({
      slug,
      filename: `${slug}.mdx`,
      title,
      date,
      author,
      description,
      keywords,
      ogImage,
      readingTime,
      wordCount: content.split(/\s+/).length,
      articleType,
    });
  }, [slug, title, date, author, description, keywords, ogImage, readingTime, content, articleType, setCurrentArticle]);

  // Fetch article videos
  const [articleVideos, setArticleVideos] = useState<ArticleMediaWithUrl[]>([]);
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(slug)}`);
        const data = await res.json();
        if (data.success && data.media) {
          setArticleVideos(
            data.media.filter((m: ArticleMediaWithUrl) => m.media_type === 'video' && m.status === 'ready')
          );
        }
      } catch {
        // Videos are optional
      }
    };
    fetchVideos();
  }, [slug]);

  const primaryVideo = articleVideos[0] || null;
  const indexedVideo = primaryVideo || (articleVideo
    ? {
        title: `${title} - Video`,
        caption: description || title,
        public_url: `${siteUrl}${articleVideo}`,
        thumbnail_url: heroImage ? `${siteUrl}${heroImage}` : fullOgImage,
        mime_type: 'video/mp4',
        created_at: date,
      }
    : null);

  // Create exciting content sections with varied layouts
  const contentSections = useMemo(() => {
    const parts = content.split(/(?=^## )/m);
    const sections: Array<{
      type: 'content' | 'cinematic' | 'offset-right' | 'offset-left' | 'duo' | 'triptych' | 'pullquote';
      content?: string;
      images?: MultiArtOption[];
    }> = [];
    
    let artIndex = 0;
    
    parts.forEach((part, i) => {
      if (!part.trim()) return;
      
      // First section is always content
      if (i === 0) {
        sections.push({ type: 'content', content: part });
        return;
      }
      
      // Every few sections, insert an exciting image layout
      if (artIndex < multiArtImages.length && i % 3 === 0) {
        const remaining = multiArtImages.length - artIndex;
        
        if (remaining >= 3 && i % 6 === 0) {
          // Triptych for dramatic effect
          sections.push({
            type: 'triptych',
            images: multiArtImages.slice(artIndex, artIndex + 3)
          });
          artIndex += 3;
        } else if (remaining >= 2 && i % 4 === 0) {
          // Duo comparison
          sections.push({
            type: 'duo',
            images: multiArtImages.slice(artIndex, artIndex + 2)
          });
          artIndex += 2;
        } else if (i % 5 === 0) {
          // Offset image alternating sides
          sections.push({
            type: artIndex % 2 === 0 ? 'offset-right' : 'offset-left',
            images: [multiArtImages[artIndex]],
            content: part
          });
          artIndex += 1;
          return; // Skip adding content separately
        } else {
          // Cinematic full-bleed
          sections.push({
            type: 'cinematic',
            images: [multiArtImages[artIndex]]
          });
          artIndex += 1;
        }
      }
      
      // Pull quote every 4th section
      if (i % 4 === 2 && part.length > 200) {
        const lines = part.split('\n');
        const quoteLine = lines.find(l => l.length > 50 && !l.startsWith('#') && !l.startsWith('-'));
        if (quoteLine) {
          sections.push({ type: 'pullquote', content: quoteLine.replace(/^[*\-]\s*/, '') });
        }
      }
      
      sections.push({ type: 'content', content: part });
    });
    
    return sections;
  }, [content, multiArtImages]);

  const mdComponents = useMemo(() => ({
    img: MarkdownImage as any,
    pre: ({ children }: React.HTMLAttributes<HTMLPreElement> & { children?: React.ReactNode }) => (
      <HandwrittenNote>
        {React.isValidElement(children)
          ? (children.props as { children?: React.ReactNode }).children
          : children}
      </HandwrittenNote>
    ),
  }), []);

  const storyCompanion = useMemo(() => {
    if (articleType !== 'fiction') return null;
    return buildStoryCompanion({ title, description, keywords, content });
  }, [articleType, content, description, keywords, title]);

  const articleChatContext = useMemo(() => ({
    slug, title, articleType, description, keywords, content,
  }), [articleType, content, description, keywords, slug, title]);

  return (
    <ArticleLayout>
      <Head>
        <title>{title} | Alex Welcing</title>
        <meta name="title" content={title} />
        <meta name="description" content={description || `Read ${title} and more insights.`} />
        {keywords && <meta name="keywords" content={keywords.join(', ')} />}
        <meta name="author" content={author.join(', ')} />

        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description || `Read ${title}`} />
        <meta property="og:image" content={fullOgImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="article:published_time" content={date} />
        <meta property="article:author" content={author.join(', ')} />

        {indexedVideo && (
          <>
            <meta property="og:video" content={indexedVideo.public_url} />
            <meta property="og:video:type" content={indexedVideo.mime_type || 'video/mp4'} />
            {indexedVideo.width && <meta property="og:video:width" content={String(indexedVideo.width)} />}
            {indexedVideo.height && <meta property="og:video:height" content={String(indexedVideo.height)} />}
          </>
        )}

        <meta name="twitter:card" content={indexedVideo ? "player" : "summary_large_image"} />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description || `Read ${title}`} />
        <meta name="twitter:image" content={indexedVideo?.thumbnail_url || fullOgImage} />

        <meta name="theme-color" content="#030308" />
        {heroImage && <link rel="preload" as="image" href={heroImage} />}
        <link rel="canonical" href={articleUrl} />
      </Head>

      <StructuredData
        type="Article"
        data={{
          headline: title,
          description: description,
          image: fullOgImage,
          datePublished: date,
          dateModified: date,
          url: articleUrl,
          articleSection: 'Speculative AI Research',
          author: author.map(name => ({
            '@type': 'Person',
            name: name,
            url: `${siteUrl}/about`
          })),
          publisher: {
            '@type': 'Organization',
            name: 'Alex Welcing',
            url: siteUrl,
            logo: {
              '@type': 'ImageObject',
              url: `${siteUrl}/logo.png`
            }
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': articleUrl
          }
        }}
      />

      {indexedVideo && (
        <StructuredData
          type="VideoObject"
          data={createVideoSchema({
            name: indexedVideo.title || `${title} — Video`,
            description: indexedVideo.caption || description || title,
            thumbnailUrl: indexedVideo.thumbnail_url || fullOgImage,
            contentUrl: indexedVideo.public_url,
            uploadDate: indexedVideo.created_at || date,
            duration: indexedVideo.duration_seconds,
            articleUrl,
          })}
        />
      )}

      <CircleNav />

      {/* HERO SECTION */}
      <HeroSection $hasImage={!!heroImage}>
        {heroImage && (
          <HeroBackground>
            <Image
              src={heroImage}
              alt={title}
              fill
              style={{ objectFit: 'cover' }}
              priority
              sizes="100vw"
            />
          </HeroBackground>
        )}
        <HeroContent>
          <ArticleClassification {...inferClassificationFromSlug(slug)} />
          <ArticleTitle>{title}</ArticleTitle>
          <ArticleMeta>
            <span>{new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span>{author.join(', ')}</span>
            <span>{readingTime} min read</span>
          </ArticleMeta>
        </HeroContent>
      </HeroSection>

      {/* ART GALLERY - Multiple art pieces displayed dramatically */}
      {multiArtImages.length > 1 && (
        <ArtGallerySection>
          <GalleryHeader>
            <Wand2 />
            Visual Variations
          </GalleryHeader>
          <ArtMosaic $count={Math.min(multiArtImages.length, 5)}>
            {multiArtImages.slice(0, 5).map((art, idx) => (
              <ArtPiece key={idx} $path={art.path} $index={idx}>
                <span className="art-label">{art.model.replace(/-/g, ' ')}</span>
              </ArtPiece>
            ))}
          </ArtMosaic>
        </ArtGallerySection>
      )}

      {/* BODY CONTENT */}
      <BodyContainer>
        <NavPills aria-label="Related navigation">
          <NavPill href="/speculative-ai">Speculative AI Hub</NavPill>
          <NavPill href="/agent-futures">Agent Futures</NavPill>
          <NavPill href="/emergent-intelligence">Emergent Intelligence</NavPill>
          <NavPill href="/about">About</NavPill>
        </NavPills>

        {/* Video if available */}
        {primaryVideo && (
          <VideoComponent
            videoSrc={primaryVideo.public_url}
            poster={primaryVideo.thumbnail_url}
            title={primaryVideo.title || `${title} — Video`}
            description={primaryVideo.caption}
            width={primaryVideo.width}
            height={primaryVideo.height}
          />
        )}

        {articleVideo && !primaryVideo && (
          <video
            src={articleVideo}
            controls
            style={{ width: '100%', margin: '32px 0', borderRadius: 4 }}
          />
        )}

        {videoURL && (
          <div style={{ margin: '32px 0' }}>
            <iframe
              width="100%"
              height="400"
              src={videoURL.replace('watch?v=', 'embed/')}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`${title} — YouTube video`}
              style={{ borderRadius: 4 }}
            />
          </div>
        )}

        {/* Render interleaved content with exciting layouts */}
        {contentSections.map((section, idx) => {
          if (section.type === 'content' && section.content) {
            return (
              <React.Fragment key={idx}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {section.content}
                </ReactMarkdown>
              </React.Fragment>
            );
          }
          
          if (section.type === 'cinematic' && section.images?.[0]) {
            return (
              <CinematicImage key={idx}>
                <Image
                  src={section.images[0].path}
                  alt={`${section.images[0].model} artwork`}
                  width={1600}
                  height={900}
                  style={{ width: '100%', height: 'auto' }}
                />
                <ImageCaption>{section.images[0].model.replace(/-/g, ' ')}</ImageCaption>
              </CinematicImage>
            );
          }
          
          if (section.type === 'offset-right' && section.images?.[0]) {
            return (
              <OffsetImageRight key={idx}>
                <Image
                  src={section.images[0].path}
                  alt={`${section.images[0].model} artwork`}
                  width={800}
                  height={600}
                />
                <ImageCaption>{section.images[0].model.replace(/-/g, ' ')}</ImageCaption>
              </OffsetImageRight>
            );
          }
          
          if (section.type === 'offset-left' && section.images?.[0]) {
            return (
              <OffsetImageLeft key={idx}>
                <Image
                  src={section.images[0].path}
                  alt={`${section.images[0].model} artwork`}
                  width={800}
                  height={600}
                />
                <ImageCaption>{section.images[0].model.replace(/-/g, ' ')}</ImageCaption>
              </OffsetImageLeft>
            );
          }
          
          if (section.type === 'duo' && section.images && section.images.length >= 2) {
            return (
              <DuoImage key={idx}>
                <Image
                  src={section.images[0].path}
                  alt={`${section.images[0].model} artwork`}
                  width={600}
                  height={400}
                />
                <Image
                  src={section.images[1].path}
                  alt={`${section.images[1].model} artwork`}
                  width={600}
                  height={400}
                />
              </DuoImage>
            );
          }
          
          if (section.type === 'triptych' && section.images && section.images.length >= 3) {
            return (
              <Triptych key={idx}>
                <Image
                  src={section.images[0].path}
                  alt={`${section.images[0].model} artwork`}
                  width={800}
                  height={600}
                />
                <Image
                  src={section.images[1].path}
                  alt={`${section.images[1].model} artwork`}
                  width={400}
                  height={300}
                />
                <Image
                  src={section.images[2].path}
                  alt={`${section.images[2].model} artwork`}
                  width={400}
                  height={300}
                />
              </Triptych>
            );
          }
          
          if (section.type === 'pullquote' && section.content) {
            return (
              <PullQuote key={idx}>
                <p>{section.content}</p>
              </PullQuote>
            );
          }

          return null;
        })}

        {/* Author Card */}
        <AuthorCard>
          <div className="avatar">AW</div>
          <div className="info">
            <div className="name">Alex Welcing</div>
            <div className="title">Technical Product Manager</div>
          </div>
          <Link href="/about" className="cta">
            About
          </Link>
        </AuthorCard>
      </BodyContainer>

      {/* FOOTER SECTION */}
      <FooterWrapper>
        <ShareSection>
          <ShareButton
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            Share on X
          </ShareButton>
          <ShareButton
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            Share on LinkedIn
          </ShareButton>
        </ShareSection>

        <SectionDivider />

        <DiscoverSection>
          <DiscoverContent>
            <DiscoverLeft>
              <DiscoverIcon><Compass /></DiscoverIcon>
              <DiscoverText>
                <h3>Discover Related</h3>
                <p>Explore more scenarios and research on similar themes.</p>
              </DiscoverText>
            </DiscoverLeft>
            <DiscoverButton onClick={() => openModal()}>
              <Star />
              Explore
              <ArrowRight />
            </DiscoverButton>
          </DiscoverContent>
        </DiscoverSection>

        <BottomCarousel slug={slug} />
      </FooterWrapper>

      {/* Story companion for fiction */}
      {storyCompanion && (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px 64px' }}>
          <StoryConstellationPreview
            structuredAnswer={chatData.structuredAnswer}
            storyCompanion={storyCompanion}
            onPromptSelect={(prompt) => void sendMessage(prompt, { articleContext: articleChatContext })}
          />
        </div>
      )}

      {/* Footer panels */}
      <ArticleFooterPanels
        articleTitle={title}
        articleSlug={slug}
        articleType={articleType}
        articleDescription={description}
        articleKeywords={keywords}
        articleContent={content}
      />
    </ArticleLayout>
  );
};

// =============================================================================
// STATIC GENERATION
// =============================================================================

export const getStaticPaths: GetStaticPaths = async () => {
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const filenames = fs.readdirSync(articleFolderPath);
  const paths = filenames
    .filter((filename) => filename.endsWith('.mdx'))
    .map((filename) => ({
      params: { slug: filename.replace('.mdx', '') },
    }));
  return { paths, fallback: false };
};

function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const { slug } = params as { slug: string };
  const articleFolderPath = path.join(process.cwd(), 'pages', 'docs', 'articles');
  const articleFilePath = path.join(articleFolderPath, `${slug}.mdx`);
  const fileContents = fs.readFileSync(articleFilePath, 'utf8');
  const { data, content } = matter(fileContents);
  const escapedContent = escapeMdxContent(content);

  // Use cached loader instead of re-reading all files (320x faster!)
  const relatedArticles = getRelatedArticles(slug, 3);

  const images = discoverArticleImages(slug);
  const resolvedOgImage =
    images.ogImage ||
    images.heroImage ||
    images.thumbnail ||
    '';

  const videoPath = `/images/article-videos/${slug}.mp4`;
  const videoExists = fs.existsSync(path.join(process.cwd(), 'public', videoPath));
  const articleType = data.articleType === 'research' ? 'research' : 'fiction';

  return {
    props: {
      title: data.title as string,
      date: (data.date instanceof Date ? data.date.toISOString() : data.date) as string,
      author: Array.isArray(data.author) ? (data.author as string[]) : ([data.author] as string[]),
      articleType,
      description: data.description || '',
      keywords: data.keywords || [],
      ogImage: resolvedOgImage,
      heroImage: images.heroImage,
      multiArtImages: images.multiArt,
      videoURL: data.videoURL || '',
      articleVideo: videoExists ? videoPath : '',
      content: escapedContent,
      readingTime: calculateReadingTime(content),
      relatedArticles,
      slug,
    },
  };
};

export default ArticlePage;
