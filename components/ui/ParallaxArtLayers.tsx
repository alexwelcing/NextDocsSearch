import React, { useEffect, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import type { MultiArtOption } from '@/lib/article-images';

/* -----------------------------------------------------------------------
   Color sampling utilities

   Instead of stretching a blurred copy of the image, we sample dominant
   colors from key regions and render pure CSS radial gradients. This is
   lighter weight, avoids the stretched-image look, and gives a cleaner
   color bleed.
   ----------------------------------------------------------------------- */

interface SampledColors {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  center: string;
  /** Overall dominant color (average of all samples) */
  dominant: string;
}

const DEFAULT_COLORS: SampledColors = {
  topLeft: '#0a0a1a',
  topRight: '#0a0a1a',
  bottomLeft: '#0a0a1a',
  bottomRight: '#0a0a1a',
  center: '#0a0a1a',
  dominant: '#0a0a1a',
};

// Cache sampled colors so we don't re-sample on every render
const colorCache = new Map<string, SampledColors>();

function sampleRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): [number, number, number] {
  const data = ctx.getImageData(x, y, size, size).data;
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Skip near-black and near-white pixels for more interesting colors
    const pr = data[i], pg = data[i + 1], pb = data[i + 2];
    const brightness = pr * 0.299 + pg * 0.587 + pb * 0.114;
    if (brightness > 15 && brightness < 240) {
      r += pr;
      g += pg;
      b += pb;
      count++;
    }
  }
  if (count === 0) {
    // Fall back to straight average if no qualifying pixels
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  if (count === 0) return [10, 10, 26];
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

function saturateColor(r: number, g: number, b: number, factor: number): string {
  // Boost saturation by pushing channels away from the average
  const avg = (r + g + b) / 3;
  const sr = Math.min(255, Math.max(0, Math.round(avg + (r - avg) * factor)));
  const sg = Math.min(255, Math.max(0, Math.round(avg + (g - avg) * factor)));
  const sb = Math.min(255, Math.max(0, Math.round(avg + (b - avg) * factor)));
  return `rgb(${sr}, ${sg}, ${sb})`;
}

function extractColors(imageSrc: string): Promise<SampledColors> {
  if (colorCache.has(imageSrc)) {
    return Promise.resolve(colorCache.get(imageSrc)!);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Draw to a small canvas for fast sampling
      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(DEFAULT_COLORS); return; }

      ctx.drawImage(img, 0, 0, size, size);

      const regionSize = 12;
      const edge = size - regionSize;

      const tl = sampleRegion(ctx, 0, 0, regionSize);
      const tr = sampleRegion(ctx, edge, 0, regionSize);
      const bl = sampleRegion(ctx, 0, edge, regionSize);
      const br = sampleRegion(ctx, edge, edge, regionSize);
      const ct = sampleRegion(ctx, (size - regionSize) / 2, (size - regionSize) / 2, regionSize);

      const satFactor = 1.8;

      const colors: SampledColors = {
        topLeft: saturateColor(...tl, satFactor),
        topRight: saturateColor(...tr, satFactor),
        bottomLeft: saturateColor(...bl, satFactor),
        bottomRight: saturateColor(...br, satFactor),
        center: saturateColor(...ct, satFactor),
        dominant: saturateColor(
          Math.round((tl[0] + tr[0] + bl[0] + br[0] + ct[0]) / 5),
          Math.round((tl[1] + tr[1] + bl[1] + br[1] + ct[1]) / 5),
          Math.round((tl[2] + tr[2] + bl[2] + br[2] + ct[2]) / 5),
          satFactor,
        ),
      };

      colorCache.set(imageSrc, colors);
      resolve(colors);
    };
    img.onerror = () => resolve(DEFAULT_COLORS);
    img.src = imageSrc;
  });
}

/** Hook that returns sampled colors from an image */
function useImageColors(imageSrc: string | undefined): SampledColors {
  const [colors, setColors] = useState<SampledColors>(
    imageSrc && colorCache.has(imageSrc) ? colorCache.get(imageSrc)! : DEFAULT_COLORS,
  );

  useEffect(() => {
    if (!imageSrc) return;
    let cancelled = false;
    extractColors(imageSrc).then((c) => {
      if (!cancelled) setColors(c);
    });
    return () => { cancelled = true; };
  }, [imageSrc]);

  return colors;
}

/* -----------------------------------------------------------------------
   ParallaxBand – with sampled-color glow
   ----------------------------------------------------------------------- */

interface ParallaxBandProps {
  image: MultiArtOption;
  height?: string;
  mobileHeight?: string;
  glowSpread?: number;
  glowIntensity?: number;
}

const glowPulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.85; transform: scale(1.02); }
`;

const BandContainer = styled.div<{ $glowSpread: number }>`
  position: relative;
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

/** Color glow layer built from sampled radial gradients */
const ColorGlowLayer = styled.div<{
  $intensity: number;
  $glowSpread: number;
}>`
  position: absolute;
  top: ${props => -props.$glowSpread * 0.5}px;
  left: -10%;
  right: -10%;
  bottom: ${props => -props.$glowSpread * 0.5}px;
  opacity: ${props => props.$intensity};
  animation: ${glowPulse} 12s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;

  @media (max-width: 768px) {
    opacity: ${props => props.$intensity * 0.8};
  }
`;

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

function buildRadialGlow(colors: SampledColors): string {
  return [
    `radial-gradient(ellipse at 10% 10%, ${colors.topLeft} 0%, transparent 60%)`,
    `radial-gradient(ellipse at 90% 10%, ${colors.topRight} 0%, transparent 60%)`,
    `radial-gradient(ellipse at 10% 90%, ${colors.bottomLeft} 0%, transparent 60%)`,
    `radial-gradient(ellipse at 90% 90%, ${colors.bottomRight} 0%, transparent 60%)`,
    `radial-gradient(ellipse at 50% 50%, ${colors.center} 0%, transparent 70%)`,
  ].join(', ');
}

export function ParallaxBand({
  image,
  height = '400px',
  mobileHeight = '250px',
  glowSpread = 150,
  glowIntensity = 0.5,
}: ParallaxBandProps) {
  const modelName = image.model.replace(/-/g, ' ');
  const colors = useImageColors(image.path);

  return (
    <BandContainer $glowSpread={glowSpread}>
      <ColorGlowLayer
        $intensity={glowIntensity}
        $glowSpread={glowSpread}
        style={{ background: buildRadialGlow(colors) }}
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
   ----------------------------------------------------------------------- */

interface EditorialSectionProps {
  image: MultiArtOption;
  imagePosition: 'left' | 'right';
  children: React.ReactNode;
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

const EditorialImage = styled.div<{ $bgImage: string; $imagePos: 'left' | 'right' }>`
  position: absolute;
  inset: 0;
  background-image: url(${props => props.$bgImage});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: transform 0.6s ease-out;

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

/** Sampled color glow behind each editorial image */
const EditorialColorGlow = styled.div`
  position: absolute;
  inset: -40%;
  opacity: 0.45;
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

function buildEditorialGlow(colors: SampledColors, imagePos: 'left' | 'right'): string {
  // Bias the glow toward the image side so color bleeds into the text area
  const imgSide = imagePos === 'left' ? '20%' : '80%';
  const farSide = imagePos === 'left' ? '80%' : '20%';
  return [
    `radial-gradient(ellipse at ${imgSide} 30%, ${colors.topLeft} 0%, transparent 65%)`,
    `radial-gradient(ellipse at ${imgSide} 70%, ${colors.bottomLeft} 0%, transparent 65%)`,
    `radial-gradient(ellipse at ${farSide} 50%, ${colors.center} 0%, transparent 70%)`,
    `radial-gradient(ellipse at 50% 50%, ${colors.dominant} 0%, transparent 80%)`,
  ].join(', ');
}

export function EditorialSection({
  image,
  imagePosition,
  children,
}: EditorialSectionProps) {
  const modelName = image.model.replace(/-/g, ' ');
  const colors = useImageColors(image.path);

  return (
    <EditorialRow $imagePos={imagePosition}>
      <EditorialImageCol $imagePos={imagePosition}>
        <EditorialColorGlow
          style={{ background: buildEditorialGlow(colors, imagePosition) }}
        />
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
   GlowingContentSection – Color-sampled ambient glow
   ----------------------------------------------------------------------- */

interface GlowingContentSectionProps {
  image?: MultiArtOption;
  children: React.ReactNode;
  glowPosition?: 'top' | 'bottom' | 'both';
}

const GlowContentWrap = styled.div`
  position: relative;
  z-index: 1;
  background: #030308;
`;

const ContentColorGlow = styled.div<{
  $position: 'top' | 'bottom' | 'both';
}>`
  position: absolute;
  left: 0;
  right: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.4;

  ${props => {
    if (props.$position === 'top') return css`
      top: 0; height: 500px;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%);
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 100%);
    `;
    if (props.$position === 'bottom') return css`
      bottom: 0; height: 500px;
      mask-image: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%);
      -webkit-mask-image: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%);
    `;
    return css`
      top: 0; bottom: 0;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.8) 100%);
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.8) 100%);
    `;
  }}
`;

const ContentInner = styled.div`
  position: relative;
  z-index: 1;
`;

function buildContentGlow(colors: SampledColors, position: 'top' | 'bottom' | 'both'): string {
  if (position === 'top') {
    return [
      `radial-gradient(ellipse at 20% 0%, ${colors.topLeft} 0%, transparent 55%)`,
      `radial-gradient(ellipse at 80% 0%, ${colors.topRight} 0%, transparent 55%)`,
      `radial-gradient(ellipse at 50% 20%, ${colors.center} 0%, transparent 65%)`,
    ].join(', ');
  }
  if (position === 'bottom') {
    return [
      `radial-gradient(ellipse at 20% 100%, ${colors.bottomLeft} 0%, transparent 55%)`,
      `radial-gradient(ellipse at 80% 100%, ${colors.bottomRight} 0%, transparent 55%)`,
      `radial-gradient(ellipse at 50% 80%, ${colors.center} 0%, transparent 65%)`,
    ].join(', ');
  }
  // 'both'
  return [
    `radial-gradient(ellipse at 20% 0%, ${colors.topLeft} 0%, transparent 45%)`,
    `radial-gradient(ellipse at 80% 0%, ${colors.topRight} 0%, transparent 45%)`,
    `radial-gradient(ellipse at 20% 100%, ${colors.bottomLeft} 0%, transparent 45%)`,
    `radial-gradient(ellipse at 80% 100%, ${colors.bottomRight} 0%, transparent 45%)`,
    `radial-gradient(ellipse at 50% 50%, ${colors.dominant} 0%, transparent 70%)`,
  ].join(', ');
}

export function GlowingContentSection({
  image,
  children,
  glowPosition = 'both',
}: GlowingContentSectionProps) {
  const colors = useImageColors(image?.path);

  return (
    <GlowContentWrap>
      {image && (
        <ContentColorGlow
          $position={glowPosition}
          style={{ background: buildContentGlow(colors, glowPosition) }}
        />
      )}
      <ContentInner>{children}</ContentInner>
    </GlowContentWrap>
  );
}

export default ParallaxBand;
