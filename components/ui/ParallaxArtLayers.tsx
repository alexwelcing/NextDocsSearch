import React from 'react';
import styled from 'styled-components';
import type { MultiArtOption } from '@/lib/article-images';

/**
 * A single parallax image band using CSS background-attachment: fixed.
 * Place these between opaque content sections — as the user scrolls,
 * the fixed background is revealed through the band's "window" then
 * hidden again when the next content section scrolls over it.
 */

interface ParallaxBandProps {
  image: MultiArtOption;
  height?: string;
  mobileHeight?: string;
}

const Band = styled.div<{ $bgImage: string; $height: string; $mobileHeight: string }>`
  position: relative;
  min-height: ${props => props.$height};
  background-image: url(${props => props.$bgImage});
  background-attachment: fixed;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;

  @media (max-width: 768px) {
    min-height: ${props => props.$mobileHeight};
    /* fixed attachment is buggy on most mobile browsers */
    background-attachment: scroll;
  }
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
`;

export function ParallaxBand({ image, height = '400px', mobileHeight = '250px' }: ParallaxBandProps) {
  const modelName = image.model.replace(/-/g, ' ');

  return (
    <Band $bgImage={image.path} $height={height} $mobileHeight={mobileHeight}>
      <Caption>{modelName}</Caption>
    </Band>
  );
}

export default ParallaxBand;
