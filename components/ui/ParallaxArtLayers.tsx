import React from 'react';
import Image from 'next/image';
import styled from 'styled-components';
import { motion, useScroll, useTransform, useSpring, MotionValue } from 'framer-motion';
import { useResponsive, usePrefersReducedMotion } from '@/hooks/useResponsive';
import type { MultiArtOption } from '@/lib/article-images';

interface ParallaxArtLayersProps {
  images: MultiArtOption[];
}

const LAYER_CONFIG = [
  { speed: 150, opacity: 0.15, scale: 1.2, blur: 0, zIndex: 1 },
  { speed: 300, opacity: 0.12, scale: 1.15, blur: 2, zIndex: 2 },
  { speed: 500, opacity: 0.08, scale: 1.1, blur: 0, zIndex: 3 },
];

const StaticBg = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.12;
`;

interface LayerProps {
  image: MultiArtOption;
  config: typeof LAYER_CONFIG[number];
  scrollY: MotionValue<number>;
}

function ParallaxLayer({ image, config, scrollY }: LayerProps) {
  const rawY = useTransform(scrollY, [0, 3000], [0, -config.speed]);
  const y = useSpring(rawY, { stiffness: 50, damping: 30 });

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: config.zIndex,
        y,
        scale: config.scale,
        opacity: config.opacity,
        willChange: 'transform',
        pointerEvents: 'none',
        filter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
      }}
    >
      <Image
        src={image.path}
        alt=""
        fill
        style={{ objectFit: 'cover' }}
        sizes="100vw"
        quality={60}
        priority={config.zIndex === 1}
      />
    </motion.div>
  );
}

export default function ParallaxArtLayers({ images }: ParallaxArtLayersProps) {
  const { scrollY } = useScroll();
  const { isMobile, isTablet, performanceTier } = useResponsive();
  const prefersReducedMotion = usePrefersReducedMotion();

  if (images.length === 0) return null;

  // Static fallback: mobile, reduced motion, or low-performance device
  if (isMobile || prefersReducedMotion || performanceTier === 'low') {
    return (
      <StaticBg>
        <Image
          src={images[0].path}
          alt=""
          fill
          style={{ objectFit: 'cover' }}
          sizes="100vw"
          quality={50}
        />
      </StaticBg>
    );
  }

  // Tablet: max 2 layers with reduced speed
  const maxLayers = isTablet ? 2 : 3;
  const layerImages = images.slice(0, maxLayers);
  const configs = isTablet
    ? LAYER_CONFIG.map(c => ({ ...c, speed: Math.round(c.speed * 0.6) }))
    : LAYER_CONFIG;

  return (
    <>
      {layerImages.map((image, index) => (
        <ParallaxLayer
          key={image.path}
          image={image}
          config={configs[index]}
          scrollY={scrollY}
        />
      ))}
    </>
  );
}
