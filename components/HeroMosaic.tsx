/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HERO MOSAIC — Interactive image tile wall with glass-break physics
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A grid of curated AI artwork tiles that:
 * 1. Start completely dark/invisible
 * 2. Reveal progressively over ~6s after load (the "descent")
 * 3. React to mouse movement with parallax + spotlight saturation
 * 4. Are masked with a center vignette so hero text stays readable
 * 5. Can be SHATTERED like glass panes by a throwable ball
 * 6. Broken tiles are replaced with fresh images after a few seconds
 *
 * The descent stages:
 *   0-1s:  Black void
 *   1-2s:  Faint grid lines appear (structure)
 *   2-4s:  Tiles fade in as dark, desaturated shapes
 *   4-6s:  Tiles gain saturation and brightness
 *   6s+:   Mouse interaction drives local color reveals + ball becomes active
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import GlassBreakEffect from './GlassBreakEffect';
import ThrowBall from './ThrowBall';

// ─── Curated tiles — chosen for color diversity and visual impact ─────────

const INITIAL_TILES = [
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
];

// ─── Replacement image pool — cycled through when tiles shatter ───────────

const REPLACEMENT_POOL = [
  { src: '/images/multi-art/asteroid-mining-ai-rebellion-2036/option-1-fast-sdxl.png', alt: 'Asteroid rebellion' },
  { src: '/images/multi-art/atmospheric-processor-malfunction-2034/option-1-fast-sdxl.png', alt: 'Atmospheric processor' },
  { src: '/images/multi-art/autonomous-factory-incident-2031/option-1-fast-sdxl.png', alt: 'Factory incident' },
  { src: '/images/multi-art/ai-kill-switch-postmortem/option-3-kolors.png', alt: 'Kill switch' },
  { src: '/images/multi-art/time-dilation-computing-error-2039/option-1-fast-sdxl.png', alt: 'Time dilation' },
  { src: '/images/multi-art/terraforming-mars-disaster-2056/option-1-fast-sdxl.png', alt: 'Mars terraforming' },
  { src: '/images/multi-art/vr-addiction-pandemic-2054/option-1-fast-sdxl.png', alt: 'VR pandemic' },
  { src: '/images/multi-art/backstory-07-fusion-nanotech-2027-09/option-3-kolors.png', alt: 'Fusion nanotech' },
  { src: '/images/multi-art/backstory-10-alien-code-2028-05/option-3-kolors.png', alt: 'Alien code' },
  { src: '/images/multi-art/backstory-11-quantum-crypto-break-2028-08/option-3-kolors.png', alt: 'Quantum break' },
  { src: '/images/multi-art/agi-alignment-failure-2057/option-1-fast-sdxl.png', alt: 'Alignment failure' },
  { src: '/images/multi-art/thoughtcrime-enforcement-system-2041/option-1-fast-sdxl.png', alt: 'Thought enforcement' },
  { src: '/images/multi-art/backstory-03-neural-interface-2026-05/option-3-kolors.png', alt: 'Neural interface early' },
  { src: '/images/multi-art/backstory-06-ai-awakening-2027-05/option-3-kolors.png', alt: 'AI awakening' },
  { src: '/images/multi-art/autonomous-vehicle-cartel-2055/option-1-fast-sdxl.png', alt: 'Vehicle cartel' },
  { src: '/images/multi-art/timestamp-collapse/option-3-kolors.png', alt: 'Timestamp collapse' },
];

// ─── Types ───────────────────────────────────────────────────────────────

type DescentPhase = 'void' | 'grid' | 'shapes' | 'color' | 'alive';

interface TileState {
  src: string;
  alt: string;
  breaking: boolean;      // currently shattering
  impactX: number;        // normalized impact point
  impactY: number;
  impactForce: number;
  replacing: boolean;     // fading in new image
  nextSrc: string | null; // queued replacement image
  nextAlt: string | null;
}

const PHASE_TIMING: Record<DescentPhase, number> = {
  void: 0,
  grid: 800,
  shapes: 2000,
  color: 4000,
  alive: 6000,
};

const GRID_COLS = 4;
const GRID_ROWS = 3;
const REPLACE_DELAY = 2500; // ms after break before new image fades in

// ─── Component ────────────────────────────────────────────────────────────

export default function HeroMosaic() {
  const [phase, setPhase] = useState<DescentPhase>('void');
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const replacementIndexRef = useRef(0);

  // Tile state — tracks breaking/replacing per tile
  const [tiles, setTiles] = useState<TileState[]>(
    INITIAL_TILES.map(t => ({
      ...t,
      breaking: false,
      impactX: 0.5,
      impactY: 0.5,
      impactForce: 3,
      replacing: false,
      nextSrc: null,
      nextAlt: null,
    }))
  );

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

  // ─── Get next replacement image (cycles through pool) ──────────────

  const getNextReplacement = useCallback(() => {
    const idx = replacementIndexRef.current % REPLACEMENT_POOL.length;
    replacementIndexRef.current++;
    return REPLACEMENT_POOL[idx];
  }, []);

  // ─── Ball impact handler — find which tile was hit ─────────────────

  const handleBallImpact = useCallback((viewportX: number, viewportY: number, force: number) => {
    // Find which tile the ball hit
    let hitIndex = -1;
    let bestDist = Infinity;
    let localImpactX = 0.5;
    let localImpactY = 0.5;

    tileRefs.current.forEach((el, i) => {
      if (!el || tiles[i].breaking) return;
      const rect = el.getBoundingClientRect();
      // Check if impact point is within this tile
      if (
        viewportX >= rect.left && viewportX <= rect.right &&
        viewportY >= rect.top && viewportY <= rect.bottom
      ) {
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((viewportX - cx) ** 2 + (viewportY - cy) ** 2);
        if (dist < bestDist) {
          bestDist = dist;
          hitIndex = i;
          localImpactX = (viewportX - rect.left) / rect.width;
          localImpactY = (viewportY - rect.top) / rect.height;
        }
      }
    });

    // If no direct hit, find nearest tile
    if (hitIndex === -1) {
      tileRefs.current.forEach((el, i) => {
        if (!el || tiles[i].breaking) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((viewportX - cx) ** 2 + (viewportY - cy) ** 2);
        if (dist < bestDist) {
          bestDist = dist;
          hitIndex = i;
          localImpactX = Math.max(0, Math.min(1, (viewportX - rect.left) / rect.width));
          localImpactY = Math.max(0, Math.min(1, (viewportY - rect.top) / rect.height));
        }
      });
    }

    if (hitIndex === -1) return;

    const replacement = getNextReplacement();

    // Trigger break on this tile
    setTiles(prev => prev.map((t, i) => {
      if (i !== hitIndex) return t;
      return {
        ...t,
        breaking: true,
        impactX: localImpactX,
        impactY: localImpactY,
        impactForce: 2 + force * 2,
        nextSrc: replacement.src,
        nextAlt: replacement.alt,
      };
    }));
  }, [tiles, getNextReplacement]);

  // ─── Glass break complete — start replacement ──────────────────────

  const handleBreakComplete = useCallback((tileIndex: number) => {
    // After a delay, fade in the replacement image
    setTimeout(() => {
      setTiles(prev => prev.map((t, i) => {
        if (i !== tileIndex) return t;
        return {
          ...t,
          breaking: false,
          replacing: true,
          src: t.nextSrc || t.src,
          alt: t.nextAlt || t.alt,
          nextSrc: null,
          nextAlt: null,
        };
      }));

      // After fade-in completes, clear the replacing flag
      setTimeout(() => {
        setTiles(prev => prev.map((t, i) => {
          if (i !== tileIndex) return t;
          return { ...t, replacing: false };
        }));
      }, 1200);
    }, REPLACE_DELAY);
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

  const isAlive = phase === 'alive';
  const anyBreaking = tiles.some(t => t.breaking);

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
          backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
          pointerEvents: 'none',
        }}
      />

      {/* Tile grid */}
      <div
        style={{
          position: 'absolute',
          inset: '-5%',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: '2px',
          opacity: gridOpacity,
          filter: gridFilter,
          transition: 'opacity 2s ease, filter 2.5s ease',
          willChange: 'opacity, filter',
          // Subtle parallax shift on mouse move
          transform: `translate(${(mouse.x - 0.5) * -12}px, ${(mouse.y - 0.5) * -12}px)`,
        }}
      >
        {tiles.map((tile, i) => {
          // Calculate distance from mouse to this tile's center
          const col = i % GRID_COLS;
          const row = Math.floor(i / GRID_COLS);
          const tileCenterX = (col + 0.5) / GRID_COLS;
          const tileCenterY = (row + 0.5) / GRID_ROWS;
          const dx = mouse.x - tileCenterX;
          const dy = mouse.y - tileCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Mouse proximity boost — closer tiles get brighter and more saturated
          const proximityBoost = isAlive ? Math.max(0, 1 - dist * 2.2) : 0;

          // Staggered reveal delay for each tile
          const stagger = (row * GRID_COLS + col) * 120;

          return (
            <div
              key={`tile-${i}`}
              ref={el => { tileRefs.current[i] = el; }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                // Per-tile brightness/saturation from mouse proximity
                filter: isAlive && !tile.breaking
                  ? `brightness(${1 + proximityBoost * 0.8}) saturate(${1 + proximityBoost * 1.2})`
                  : 'none',
                transition: `filter 0.4s ease, transform 0.6s ease`,
                transitionDelay: phase === 'shapes' ? `${stagger}ms` : '0ms',
                transform: isAlive && !tile.breaking
                  ? `scale(${1 + proximityBoost * 0.04})`
                  : 'none',
              }}
            >
              {/* Image — hidden during break, fades in during replace */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: tile.breaking ? 0 : tile.replacing ? 0 : 1,
                  transition: 'opacity 0.15s ease',
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

              {/* Replacement image — fades in after shatter */}
              {tile.replacing && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    animation: 'tileReplaceIn 1.2s ease forwards',
                  }}
                >
                  <Image
                    src={tile.src}
                    alt={tile.alt}
                    fill
                    style={{ objectFit: 'cover' }}
                    sizes="25vw"
                  />
                </div>
              )}

              {/* Glass break canvas overlay */}
              {tile.breaking && (
                <GlassBreakEffect
                  imageSrc={tile.src}
                  width={tileRefs.current[i]?.offsetWidth ?? 300}
                  height={tileRefs.current[i]?.offsetHeight ?? 250}
                  impactX={tile.impactX}
                  impactY={tile.impactY}
                  impactForce={tile.impactForce}
                  onComplete={() => handleBreakComplete(i)}
                />
              )}

              {/* Crack overlay flash on impact */}
              {tile.breaking && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at ' +
                      `${tile.impactX * 100}% ${tile.impactY * 100}%, ` +
                      'rgba(200, 230, 255, 0.4) 0%, transparent 60%)',
                    opacity: 0,
                    animation: 'impactFlash 0.3s ease-out forwards',
                    pointerEvents: 'none',
                    zIndex: 11,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mouse spotlight — a radial light that follows the cursor */}
      {isAlive && (
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

      {/* Throwable ball — appears once alive phase is reached */}
      {isAlive && (
        <ThrowBall
          onImpact={handleBallImpact}
          disabled={anyBreaking}
          containerRef={containerRef}
        />
      )}

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes impactFlash {
          0% { opacity: 0.8; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.5); }
        }
        @keyframes tileReplaceIn {
          0% {
            opacity: 0;
            transform: scale(1.08);
            filter: brightness(1.5) blur(4px);
          }
          60% {
            opacity: 1;
            filter: brightness(1.2) blur(1px);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: brightness(1) blur(0px);
          }
        }
      `}</style>
    </div>
  );
}
