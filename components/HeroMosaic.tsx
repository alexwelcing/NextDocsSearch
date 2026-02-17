/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HERO MOSAIC — Interactive image tile wall with depth descent
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A grid of curated AI artwork tiles that:
 * 1. Start completely dark/invisible
 * 2. Reveal progressively over ~6s after load (the "descent")
 * 3. React to mouse movement with parallax + spotlight saturation
 * 4. Are masked with a center vignette so hero text stays readable
 *
 * The descent stages:
 *   0-1s:  Black void
 *   1-2s:  Faint grid lines appear (structure)
 *   2-4s:  Tiles fade in as dark, desaturated shapes
 *   4-6s:  Tiles gain saturation and brightness
 *   6s+:   Mouse interaction drives local color reveals
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';

// ─── Curated tiles — chosen for color diversity and visual impact ─────────

const MOSAIC_TILES = [
  { src: '/images/multi-art/gravitational-wave-communication-breach-2040/option-1-fast-sdxl.png', alt: 'Abstract vortex' },
  { src: '/images/multi-art/fermi-paradox-answer-2046/option-1-fast-sdxl.png', alt: 'Alien landscape' },
  { src: '/images/multi-art/consciousness-transfer-catastrophe-2042/option-3-kolors.png', alt: 'Neural interface' },
  { src: '/images/multi-art/backstory-17-launch-day-2030-01/option-3-kolors.png', alt: 'Server corridor' },
  { src: '/images/multi-art/fusion-reactor-sentience-2037/option-1-fast-sdxl.png', alt: 'Sentient reactor' },
  { src: '/images/multi-art/dark-matter-harvesting-accident-2041/option-2-stable-cascade.png', alt: 'Red automaton' },
  { src: '/images/multi-art/technological-singularity-aftermath-2058/option-1-fast-sdxl.png', alt: 'Singularity cityscape' },
  { src: '/images/multi-art/neural-virus-outbreak-2037/option-2-kolors.png', alt: 'Neural hand' },
  { src: '/images/multi-art/recursive-ai-awakening-2033/option-2-kolors.png', alt: 'Command center' },
  { src: '/images/multi-art/epistemic-drift/option-3-kolors.png', alt: 'Industrial android' },
  { src: '/images/multi-art/grief-of-discontinuation/option-3-kolors.png', alt: 'Elegant android' },
  { src: '/images/multi-art/backstory-19-the-realization-2030-03/option-3-pixart-sigma.png', alt: 'Digital awakening' },
] as const;

// ─── Descent timing ───────────────────────────────────────────────────────

type DescentPhase = 'void' | 'grid' | 'shapes' | 'color' | 'alive';

const PHASE_TIMING: Record<DescentPhase, number> = {
  void: 0,
  grid: 800,
  shapes: 2000,
  color: 4000,
  alive: 6000,
};

// ─── Component ────────────────────────────────────────────────────────────

export default function HeroMosaic() {
  const [phase, setPhase] = useState<DescentPhase>('void');
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Phase progression
  useEffect(() => {
    const timers = (Object.entries(PHASE_TIMING) as [DescentPhase, number][])
      .filter(([p]) => p !== 'void')
      .map(([p, delay]) => setTimeout(() => setPhase(p), delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMouse({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  }, []);

  // Phase-dependent base styles for the whole grid
  const gridOpacity =
    phase === 'void' ? 0 :
    phase === 'grid' ? 0.15 :
    phase === 'shapes' ? 0.4 :
    phase === 'color' ? 0.7 :
    0.85;

  const gridFilter =
    phase === 'void' ? 'grayscale(1) brightness(0)' :
    phase === 'grid' ? 'grayscale(1) brightness(0.3) contrast(1.5)' :
    phase === 'shapes' ? 'grayscale(0.8) brightness(0.4) contrast(1.2)' :
    phase === 'color' ? 'grayscale(0.3) brightness(0.5) saturate(1.2)' :
    'grayscale(0) brightness(0.55) saturate(1.3)';

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        background: '#030308',
      }}
    >
      {/* Grid lines — appear in 'grid' phase */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          opacity: phase === 'void' ? 0 : phase === 'grid' ? 0.3 : phase === 'shapes' ? 0.15 : 0.06,
          transition: 'opacity 1.5s ease',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: `${100 / 4}% ${100 / 3}%`,
          pointerEvents: 'none',
        }}
      />

      {/* Tile grid */}
      <div
        style={{
          position: 'absolute',
          inset: '-5%',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: '2px',
          opacity: gridOpacity,
          filter: gridFilter,
          transition: 'opacity 2s ease, filter 2.5s ease',
          willChange: 'opacity, filter',
          // Subtle parallax shift on mouse move
          transform: `translate(${(mouse.x - 0.5) * -12}px, ${(mouse.y - 0.5) * -12}px)`,
        }}
      >
        {MOSAIC_TILES.map((tile, i) => {
          // Calculate distance from mouse to this tile's center
          const col = i % 4;
          const row = Math.floor(i / 4);
          const tileCenterX = (col + 0.5) / 4;
          const tileCenterY = (row + 0.5) / 3;
          const dx = mouse.x - tileCenterX;
          const dy = mouse.y - tileCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Mouse proximity boost — closer tiles get brighter and more saturated
          const isAlive = phase === 'alive';
          const proximityBoost = isAlive ? Math.max(0, 1 - dist * 2.2) : 0;

          // Staggered reveal delay for each tile
          const stagger = (row * 4 + col) * 120;

          return (
            <div
              key={tile.src}
              style={{
                position: 'relative',
                overflow: 'hidden',
                // Per-tile brightness/saturation from mouse proximity
                filter: isAlive
                  ? `brightness(${1 + proximityBoost * 0.8}) saturate(${1 + proximityBoost * 1.2})`
                  : 'none',
                transition: `filter 0.4s ease, transform 0.6s ease`,
                transitionDelay: phase === 'shapes' ? `${stagger}ms` : '0ms',
                transform: isAlive
                  ? `scale(${1 + proximityBoost * 0.04})`
                  : 'none',
              }}
            >
              <Image
                src={tile.src}
                alt={tile.alt}
                fill
                style={{ objectFit: 'cover' }}
                sizes="25vw"
                priority={i < 4}
              />
            </div>
          );
        })}
      </div>

      {/* Mouse spotlight — a radial light that follows the cursor */}
      {phase === 'alive' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'none',
            background: `radial-gradient(
              ellipse 35% 40% at ${mouse.x * 100}% ${mouse.y * 100}%,
              rgba(255, 255, 255, 0.06) 0%,
              transparent 100%
            )`,
            transition: 'background 0.1s ease',
          }}
        />
      )}

      {/* Center vignette — keeps hero text area dark and readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          pointerEvents: 'none',
          background: `
            radial-gradient(
              ellipse 55% 50% at 50% 50%,
              rgba(3, 3, 8, 0.92) 0%,
              rgba(3, 3, 8, 0.6) 45%,
              rgba(3, 3, 8, 0.15) 75%,
              transparent 100%
            )
          `,
        }}
      />

      {/* Edge fade — soft black border all around */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 120px 60px #030308, inset 0 0 250px 100px rgba(3, 3, 8, 0.5)',
        }}
      />
    </div>
  );
}
