import React from 'react';
import Image from 'next/image';
import styled, { css } from 'styled-components';
import type { MultiArtOption } from '@/lib/article-images';

/* -----------------------------------------------------------------------
   Descent System — "Down the rabbit hole"

   The article progresses through 4 visual depth stages as the reader
   scrolls.  Each stage is more complex and colorful than the last:

     0  SURFACE   — Pure brutalist. Black + white. No decoration.
     1  CRACKS    — Faint rules appear, first image (desaturated), hints.
     2  AWAKENING — Color enters. Cyan/gold accents. Images gain life.
     3  WONDERLAND — Full palette. Rich art. Lush typography. Gallery.

   Components accept a `depth` prop (0–3) and style themselves accordingly.
   No glow layers, no canvas tricks — just intentional progressive CSS.
   ----------------------------------------------------------------------- */

export type DepthStage = 0 | 1 | 2 | 3;

/* -----------------------------------------------------------------------
   ArtFrame — An artwork image at the appropriate depth fidelity
   ----------------------------------------------------------------------- */

interface ArtFrameProps {
  image: MultiArtOption;
  depth: DepthStage;
  /** CSS height value */
  height?: string;
  mobileHeight?: string;
  priority?: boolean;
}

const FrameOuter = styled.div<{ $depth: DepthStage; $height: string; $mobileHeight: string }>`
  position: relative;
  width: 100%;
  height: ${p => p.$height};
  overflow: hidden;

  /* Depth 0: no frame, stark */
  /* Depth 1: thin hairline border, slightly desaturated */
  /* Depth 2: thicker frame, color starts */
  /* Depth 3: full expression */

  ${p => p.$depth === 0 && css`
    border: none;
    filter: grayscale(1) contrast(1.2);
  `}

  ${p => p.$depth === 1 && css`
    border: 1px solid rgba(255, 255, 255, 0.12);
    filter: grayscale(0.7) contrast(1.1);
  `}

  ${p => p.$depth === 2 && css`
    border: 2px solid rgba(0, 212, 255, 0.3);
    filter: grayscale(0.2) saturate(1.1);
  `}

  ${p => p.$depth === 3 && css`
    border: 3px solid var(--color-gold-highlight, #ffd700);
    filter: none;
    box-shadow: 0 0 40px rgba(255, 215, 0, 0.08), 0 0 80px rgba(0, 212, 255, 0.05);
  `}

  @media (max-width: 768px) {
    height: ${p => p.$mobileHeight};
  }
`;

const FrameCaption = styled.div<{ $depth: DepthStage }>`
  position: absolute;
  bottom: 16px;
  right: 16px;
  padding: 6px 14px;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  pointer-events: none;
  z-index: 2;
  transition: opacity 0.6s ease;

  ${p => p.$depth <= 1 && css`
    opacity: 0;
  `}

  ${p => p.$depth === 2 && css`
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(0, 212, 255, 0.3);
    color: rgba(0, 212, 255, 0.7);
    opacity: 1;
  `}

  ${p => p.$depth === 3 && css`
    background: rgba(0, 0, 0, 0.7);
    border: 2px solid var(--color-gold-highlight, #ffd700);
    color: var(--color-gold-highlight, #ffd700);
    opacity: 1;
  `}
`;

export function ArtFrame({
  image,
  depth,
  height = '400px',
  mobileHeight = '250px',
  priority = false,
}: ArtFrameProps) {
  const modelName = image.model.replace(/-/g, ' ');

  return (
    <FrameOuter $depth={depth} $height={height} $mobileHeight={mobileHeight}>
      <Image
        src={image.path}
        alt={`${modelName} artwork`}
        fill
        style={{ objectFit: 'cover' }}
        priority={priority}
        sizes="100vw"
      />
      <FrameCaption $depth={depth}>{modelName}</FrameCaption>
    </FrameOuter>
  );
}

/* -----------------------------------------------------------------------
   DepthDivider — Horizontal rule that evolves with depth
   ----------------------------------------------------------------------- */

const Divider = styled.hr<{ $depth: DepthStage }>`
  border: none;
  margin: 0;
  padding: 0;

  ${p => p.$depth === 0 && css`
    height: 0;
    visibility: hidden;
  `}

  ${p => p.$depth === 1 && css`
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 48px 0;
  `}

  ${p => p.$depth === 2 && css`
    height: 2px;
    background: linear-gradient(to right, transparent, rgba(0, 212, 255, 0.25), transparent);
    margin: 64px 0;
  `}

  ${p => p.$depth === 3 && css`
    height: 3px;
    background: linear-gradient(to right,
      transparent,
      rgba(0, 212, 255, 0.4) 20%,
      rgba(255, 215, 0, 0.5) 50%,
      rgba(0, 212, 255, 0.4) 80%,
      transparent
    );
    margin: 72px 0;
  `}
`;

export function DepthDivider({ depth }: { depth: DepthStage }) {
  return <Divider $depth={depth} />;
}

/* -----------------------------------------------------------------------
   DepthSection — Content wrapper that sets the visual tone per stage
   ----------------------------------------------------------------------- */

interface DepthSectionProps {
  depth: DepthStage;
  children: React.ReactNode;
}

const Section = styled.section<{ $depth: DepthStage }>`
  position: relative;
  z-index: 1;

  ${p => p.$depth === 0 && css`
    background: #030308;
  `}

  ${p => p.$depth === 1 && css`
    background: #030308;
    /* Barely-there top edge line */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 10%;
      right: 10%;
      height: 1px;
      background: rgba(255, 255, 255, 0.04);
    }
  `}

  ${p => p.$depth === 2 && css`
    background: linear-gradient(180deg, #030308 0%, #040412 100%);
    /* Subtle side accents */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 2px;
      height: 100%;
      background: linear-gradient(to bottom, transparent, rgba(0, 212, 255, 0.15), transparent);
    }
  `}

  ${p => p.$depth === 3 && css`
    background: linear-gradient(180deg, #040412 0%, #06061a 50%, #040412 100%);
    /* Warm side accent */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 3px;
      height: 100%;
      background: linear-gradient(to bottom,
        transparent,
        rgba(255, 215, 0, 0.2) 30%,
        rgba(0, 212, 255, 0.2) 70%,
        transparent
      );
    }
    &::after {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      width: 3px;
      height: 100%;
      background: linear-gradient(to bottom,
        transparent,
        rgba(0, 212, 255, 0.15) 30%,
        rgba(255, 215, 0, 0.15) 70%,
        transparent
      );
    }
  `}
`;

export function DepthSection({ depth, children }: DepthSectionProps) {
  return <Section $depth={depth}>{children}</Section>;
}

/* -----------------------------------------------------------------------
   EditorialSection — Side-by-side image + text, depth-aware
   ----------------------------------------------------------------------- */

interface EditorialSectionProps {
  image: MultiArtOption;
  imagePosition: 'left' | 'right';
  depth: DepthStage;
  children: React.ReactNode;
}

const EditorialRow = styled.div<{ $imagePos: 'left' | 'right' }>`
  display: grid;
  grid-template-columns: ${p => p.$imagePos === 'left' ? '1fr 1.2fr' : '1.2fr 1fr'};
  gap: 0;
  min-height: 500px;
  position: relative;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    min-height: auto;
  }
`;

const EditorialImageCol = styled.div<{ $imagePos: 'left' | 'right'; $depth: DepthStage }>`
  position: relative;
  min-height: 450px;
  overflow: hidden;
  order: ${p => p.$imagePos === 'left' ? 0 : 1};

  /* Depth-aware desaturation */
  ${p => p.$depth <= 1 && css`
    filter: grayscale(0.6);
  `}
  ${p => p.$depth === 2 && css`
    filter: grayscale(0.15);
  `}
  ${p => p.$depth === 3 && css`
    filter: none;
  `}

  @media (max-width: 900px) {
    order: 0;
    min-height: 300px;
  }
`;

const EditorialImage = styled.div<{ $bgImage: string; $imagePos: 'left' | 'right' }>`
  position: absolute;
  inset: 0;
  background-image: url(${p => p.$bgImage});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: ${p => p.$imagePos === 'left'
      ? 'linear-gradient(to right, transparent 60%, #030308 100%)'
      : 'linear-gradient(to left, transparent 60%, #030308 100%)'
    };

    @media (max-width: 900px) {
      background: linear-gradient(to bottom, transparent 50%, #030308 100%);
    }
  }
`;

const EditorialTextCol = styled.div<{ $imagePos: 'left' | 'right' }>`
  padding: 60px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  order: ${p => p.$imagePos === 'left' ? 1 : 0};
  position: relative;
  z-index: 1;

  @media (max-width: 900px) {
    order: 1;
    padding: 32px 20px;
  }
`;

const EditorialCaption = styled.div<{ $depth: DepthStage }>`
  position: absolute;
  bottom: 16px;
  left: 16px;
  padding: 6px 12px;
  font-family: var(--font-mono, 'Monaco', 'Courier New', monospace);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  pointer-events: none;
  z-index: 3;

  ${p => p.$depth <= 1 && css`
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.4);
  `}
  ${p => p.$depth === 2 && css`
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(0, 212, 255, 0.3);
    color: rgba(0, 212, 255, 0.7);
  `}
  ${p => p.$depth === 3 && css`
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid var(--color-gold-highlight, #ffd700);
    color: var(--color-gold-highlight, #ffd700);
  `}
`;

export function EditorialSection({
  image,
  imagePosition,
  depth,
  children,
}: EditorialSectionProps) {
  const modelName = image.model.replace(/-/g, ' ');

  return (
    <EditorialRow $imagePos={imagePosition}>
      <EditorialImageCol $imagePos={imagePosition} $depth={depth}>
        <EditorialImage $bgImage={image.path} $imagePos={imagePosition} />
        <EditorialCaption $depth={depth}>{modelName}</EditorialCaption>
      </EditorialImageCol>
      <EditorialTextCol $imagePos={imagePosition}>
        {children}
      </EditorialTextCol>
    </EditorialRow>
  );
}

export default ArtFrame;
