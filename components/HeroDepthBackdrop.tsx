/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HERO DEPTH BACKDROP — Time-driven wonderland descent behind the hero
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Four curated artwork layers fade in sequentially after page load,
 * progressing from brutalist void → full-color wonderland:
 *
 *   0  SURFACE    (0s)  — Nothing. Pure black.
 *   1  CRACKS     (~2s) — Greyscale architectural void fades in.
 *   2  AWAKENING  (~4s) — Desaturated tech imagery, structure emerges.
 *   3  WONDERLAND (~6s) — Full-color, warm, alive.
 *
 * Layers use mix-blend-mode: screen so they merge with the WebGL shader
 * rather than fighting it. Each layer is masked with a radial vignette
 * to keep the center clean for the hero text.
 */

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

// Curated artwork — chosen for the visual descent narrative
const DEPTH_IMAGES = [
  // Depth 1: The white architectural void — brutalist, lonely, monochrome
  '/images/multi-art/gravitational-wave-communication-breach-2040/option-2-stable-diffusion-v35-large.png',
  // Depth 2: Cyan/red server room — structure emerges, first hints of color
  '/images/multi-art/backstory-10-alien-code-2028-05/option-3-v2.png',
  // Depth 3: Neural face — blue/orange, consciousness, awakening
  '/images/multi-art/consciousness-transfer-catastrophe-2042/option-3-kolors.png',
  // Depth 4: Gold/blue command center — full wonderland
  '/images/multi-art/recursive-ai-awakening-2033/option-2-kolors.png',
] as const;

// Timing for each layer reveal (ms after mount)
const REVEAL_DELAYS = [1500, 3500, 5500, 8000] as const;

// Target opacity for each layer (later layers are more visible)
const TARGET_OPACITIES = [0.12, 0.15, 0.18, 0.22] as const;

// Filter per depth stage — progressively more saturated
const LAYER_FILTERS = [
  'grayscale(1) contrast(1.3) brightness(0.8)',
  'grayscale(0.6) contrast(1.1) brightness(0.7)',
  'grayscale(0.15) saturate(1.3) brightness(0.6)',
  'grayscale(0) saturate(1.5) brightness(0.55)',
] as const;

export default function HeroDepthBackdrop() {
  const [revealedLayers, setRevealedLayers] = useState<boolean[]>([false, false, false, false]);

  useEffect(() => {
    const timers = REVEAL_DELAYS.map((delay, i) =>
      setTimeout(() => {
        setRevealedLayers(prev => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        // Radial mask: keep center dark/clean for hero text,
        // let images bleed in from the edges
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 20%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 20%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 80%)',
      }}
    >
      {DEPTH_IMAGES.map((src, i) => (
        <div
          key={src}
          style={{
            position: 'absolute',
            inset: '-10%',
            opacity: revealedLayers[i] ? TARGET_OPACITIES[i] : 0,
            filter: LAYER_FILTERS[i],
            mixBlendMode: 'screen',
            transition: `opacity ${1.8 + i * 0.4}s ease-in`,
            willChange: 'opacity',
          }}
        >
          <Image
            src={src}
            alt=""
            fill
            style={{ objectFit: 'cover' }}
            sizes="100vw"
            priority={i === 0}
          />
        </div>
      ))}
    </div>
  );
}
