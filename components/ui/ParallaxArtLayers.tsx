import React, { useRef, useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import type { MultiArtOption } from '@/lib/article-images';

/* -----------------------------------------------------------------------
   ParallaxBand – Enhanced with light-leak color bleed

   Each band now has:
   1. The parallax image itself (CSS background-attachment: fixed)
   2. A "light leak" glow layer — the same image, massively blurred and
      saturated, that bleeds color into surrounding content sections
   3. Gradient fades at top/bottom edges for smooth blending
   ----------------------------------------------------------------------- */

interface ParallaxBandProps {
  image: MultiArtOption;
  height?: string;
  mobileHeight?: string;
  /** How far the glow extends above/below the band (px) */
  glowSpread?: number;
  /** Glow opacity 0–1 */
  glowIntensity?: number;
}

/* Subtle drift animation for the glow layer */
const glowDrift = keyframes`
  0%, 100% { transform: scale(1.35) translateY(0); }
  50% { transform: scale(1.4) translateY(-8px); }
`;

const BandContainer = styled.div<{ $glowSpread: number }>`
  position: relative;
  /* Extend overflow to allow glow to bleed into adjacent sections */
  margin-top: ${props => -props.$glowSpread}px;
  margin-bottom: ${props => -props.$glowSpread}px;
  padding-top: ${props => props.$glowSpread}px;
  padding-bottom: ${props => props.$glowSpread}px;
  z-index: 0;
  overflow: visible;
`;

const Band = styled.div<{ $bgImage: string; $height: string; $mobileHeight: string }>`
  position: relative;
  min-height: ${props => props.$height};
  background-image: url(${props => props.$bgImage});
  background-attachment: fixed;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  z-index: 1;

  @media (max-width: 768px) {
    min-height: ${props => props.$mobileHeight};
    background-attachment: scroll;
  }
`;

/* Light-leak: same image, blown up, mega-blurred, saturated */
const GlowLayer = styled.div<{
  $bgImage: string;
  $intensity: number;
  $glowSpread: number;
}>`
  position: absolute;
  top: ${props => -props.$glowSpread * 0.3}px;
  left: -15%;
  right: -15%;
  bottom: ${props => -props.$glowSpread * 0.3}px;
  background-image: url(${props => props.$bgImage});
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  filter: blur(90px) saturate(2.5) brightness(0.7);
  opacity: ${props => props.$intensity};
  animation: ${glowDrift} 12s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;

  @media (max-width: 768px) {
    filter: blur(60px) saturate(2) brightness(0.6);
    opacity: ${props => props.$intensity * 0.7};
  }
`;

/* Gradient fades for smooth blending at top and bottom */
const EdgeFade = styled.div<{ $position: 'top' | 'bottom'; $height: number }>`
  position: absolute;
  left: 0;
  right: 0;
  height: ${props => props.$height}px;
  z-index: 2;
  pointer-events: none;

  ${props => props.$position === 'top' ? css`
    top: 0;
    background: linear-gradient(to bottom, #030308 0%, transparent 100%);
  ` : css`
    bottom: 0;
    background: linear-gradient(to top, #030308 0%, transparent 100%);
  `}
`;

const Caption = styled.div`
  position: absolute;
  bottom: 24px;
  right: 24px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.7);
  border: 2px solid var(--color-gold-highlight, #ffd700);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.7rem;
  color: var(--color-gold-highlight, #ffd700);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  pointer-events: none;
  z-index: 3;
`;

export function ParallaxBand({
  image,
  height = '400px',
  mobileHeight = '250px',
  glowSpread = 120,
  glowIntensity = 0.35,
}: ParallaxBandProps) {
  const modelName = image.model.replace(/-/g, ' ');

  return (
    <BandContainer $glowSpread={glowSpread}>
      <GlowLayer
        $bgImage={image.path}
        $intensity={glowIntensity}
        $glowSpread={glowSpread}
      />
      <Band $bgImage={image.path} $height={height} $mobileHeight={mobileHeight}>
        <EdgeFade $position="top" $height={60} />
        <EdgeFade $position="bottom" $height={60} />
        <Caption>{modelName}</Caption>
      </Band>
    </BandContainer>
  );
}

/* -----------------------------------------------------------------------
   EditorialSection – Alternating left/right content + image layout

   Used to break up article text with feature images that slide in from
   alternating sides, creating a magazine-style editorial feel.
   ----------------------------------------------------------------------- */

interface EditorialSectionProps {
  image: MultiArtOption;
  /** 'left' = image on left, text on right. 'right' = opposite. */
  imagePosition: 'left' | 'right';
  children: React.ReactNode;
  /** Optional dominant color for accent tinting */
  accentColor?: string;
}

const EditorialRow = styled.div<{ $imagePos: 'left' | 'right' }>`
  display: grid;
  grid-template-columns: ${props => props.$imagePos === 'left' ? '1fr 1.2fr' : '1.2fr 1fr'};
  gap: 0;
  min-height: 500px;
  position: relative;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    min-height: auto;
  }
`;

const EditorialImageCol = styled.div<{ $imagePos: 'left' | 'right' }>`
  position: relative;
  min-height: 450px;
  overflow: hidden;
  order: ${props => props.$imagePos === 'left' ? 0 : 1};

  @media (max-width: 900px) {
    order: 0;
    min-height: 300px;
  }
`;

/* The actual image inside the editorial column */
const EditorialImage = styled.div<{ $bgImage: string; $imagePos: 'left' | 'right' }>`
  position: absolute;
  inset: 0;
  background-image: url(${props => props.$bgImage});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: transform 0.6s ease-out;

  /* Gradient mask that fades toward the text side */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: ${props => props.$imagePos === 'left'
      ? 'linear-gradient(to right, transparent 60%, #030308 100%)'
      : 'linear-gradient(to left, transparent 60%, #030308 100%)'
    };

    @media (max-width: 900px) {
      background: linear-gradient(to bottom, transparent 50%, #030308 100%);
    }
  }
`;

/* Light-leak glow behind each editorial image */
const EditorialGlow = styled.div<{ $bgImage: string; $imagePos: 'left' | 'right' }>`
  position: absolute;
  inset: -30%;
  background-image: url(${props => props.$bgImage});
  background-size: cover;
  background-position: center;
  filter: blur(80px) saturate(2.5) brightness(0.5);
  opacity: 0.25;
  z-index: -1;
  pointer-events: none;
`;

const EditorialTextCol = styled.div<{ $imagePos: 'left' | 'right' }>`
  padding: 60px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  order: ${props => props.$imagePos === 'left' ? 1 : 0};
  position: relative;
  z-index: 1;

  @media (max-width: 900px) {
    order: 1;
    padding: 32px 20px;
  }
`;

const EditorialCaption = styled.div`
  position: absolute;
  bottom: 16px;
  left: 16px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid var(--color-gold-highlight, #ffd700);
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.65rem;
  color: var(--color-gold-highlight, #ffd700);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  pointer-events: none;
  z-index: 3;
`;

export function EditorialSection({
  image,
  imagePosition,
  children,
}: EditorialSectionProps) {
  const modelName = image.model.replace(/-/g, ' ');

  return (
    <EditorialRow $imagePos={imagePosition}>
      <EditorialImageCol $imagePos={imagePosition}>
        <EditorialGlow $bgImage={image.path} $imagePos={imagePosition} />
        <EditorialImage $bgImage={image.path} $imagePos={imagePosition} />
        <EditorialCaption>{modelName}</EditorialCaption>
      </EditorialImageCol>
      <EditorialTextCol $imagePos={imagePosition}>
        {children}
      </EditorialTextCol>
    </EditorialRow>
  );
}

/* -----------------------------------------------------------------------
   GlowingContentSection – Replaces flat opaque ContentSection

   A content section whose background picks up color from an adjacent
   parallax image, creating continuity instead of stark black.
   ----------------------------------------------------------------------- */

interface GlowingContentSectionProps {
  image?: MultiArtOption;
  children: React.ReactNode;
  /** Which edge the glow comes from */
  glowPosition?: 'top' | 'bottom' | 'both';
}

const GlowContentWrap = styled.div`
  position: relative;
  z-index: 1;
  background: #030308;
`;

const ContentGlowLayer = styled.div<{
  $bgImage: string;
  $position: 'top' | 'bottom' | 'both';
}>`
  position: absolute;
  left: -10%;
  right: -10%;
  pointer-events: none;
  z-index: 0;
  background-image: url(${props => props.$bgImage});
  background-size: cover;
  background-position: center;
  filter: blur(100px) saturate(2) brightness(0.4);
  opacity: 0.2;

  ${props => {
    if (props.$position === 'top') return css`
      top: 0; height: 400px;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%);
    `;
    if (props.$position === 'bottom') return css`
      bottom: 0; height: 400px;
      mask-image: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
      -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
    `;
    return css`
      top: 0; bottom: 0;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%);
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%);
    `;
  }}
`;

const ContentInner = styled.div`
  position: relative;
  z-index: 1;
`;

export function GlowingContentSection({
  image,
  children,
  glowPosition = 'both',
}: GlowingContentSectionProps) {
  return (
    <GlowContentWrap>
      {image && (
        <ContentGlowLayer
          $bgImage={image.path}
          $position={glowPosition}
        />
      )}
      <ContentInner>{children}</ContentInner>
    </GlowContentWrap>
  );
}

export default ParallaxBand;
