/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HERO MOSAIC — Interactive image tile wall with progressive glass-break
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A grid of curated AI artwork tiles that:
 * 1. Start dark and reveal progressively over ~6s (the "descent")
 * 2. React to mouse with parallax + spotlight
 * 3. Take PROGRESSIVE DAMAGE from a throwable glass ball:
 *      Hit 1 → Hairline cracks (GlassCrackOverlay)
 *      Hit 2 → Major cracks with branches
 *      Hit 3 → Full shatter (GlassBreakEffect)
 * 4. After shatter: column tiles shift down mechanically,
 *    new tile slides in from the top
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import GlassCrackOverlay from './GlassCrackOverlay';
import GlassBreakEffect from './GlassBreakEffect';
import ThrowBall from './ThrowBall';

// ─── Grid constants ──────────────────────────────────────────────────────

const GRID_COLS = 4;
const GRID_ROWS = 3;
const TILE_COUNT = GRID_COLS * GRID_ROWS; // 12
const REPLACE_DELAY = 2000;       // ms after shatter before column shift
const COLUMN_ANIM_DURATION = 700; // ms for the column-shift animation

// ─── Image pools ─────────────────────────────────────────────────────────
// Dynamic images are fetched from /api/tile-images at mount.
// These hardcoded lists serve as instant fallback while the API loads
// (or if it fails), so the mosaic is never empty on first paint.

const FALLBACK_TILES: { src: string; alt: string }[] = [
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

// ─── Types ───────────────────────────────────────────────────────────────

type DescentPhase = 'void' | 'grid' | 'shapes' | 'color' | 'alive';

interface TileState {
  src: string;
  alt: string;
  hits: number;                            // 0-3
  crackImpacts: { x: number; y: number }[]; // impact points for cracks (up to 2)
  breaking: boolean;                        // true during final shatter
  impactX: number;                          // last impact point (for shatter)
  impactY: number;
  impactForce: number;
  dropping: boolean;                        // true during column-shift animation
  dropDelay: number;                        // stagger delay (ms) for cascade
  dropVersion: number;                      // increment to force React remount → restart animation
  flashKey: number;                         // increment to restart impact flash
}

// ─── Component ────────────────────────────────────────────────────────────

function makeTileState(t: { src: string; alt: string }): TileState {
  return {
    ...t,
    hits: 0,
    crackImpacts: [],
    breaking: false,
    impactX: 0.5,
    impactY: 0.5,
    impactForce: 3,
    dropping: false,
    dropDelay: 0,
    dropVersion: 0,
    flashKey: 0,
  };
}

export default function HeroMosaic() {
  const [phase, setPhase] = useState<DescentPhase>('alive');
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const replacementPoolRef = useRef<{ src: string; alt: string }[]>([]);
  const replacementIndexRef = useRef(0);

  // Start with fallback tiles — replaced by API results on mount
  const [tiles, setTiles] = useState<TileState[]>(
    FALLBACK_TILES.slice(0, TILE_COUNT).map(makeTileState)
  );

  // Fetch newest images from both public/images/articles & multi-art
  useEffect(() => {
    let cancelled = false;
    fetch('/api/tile-images')
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then((images: { src: string; alt: string }[]) => {
        if (cancelled || images.length === 0) return;

        // First TILE_COUNT images → initial grid, rest → replacement pool
        const initial = images.slice(0, TILE_COUNT);
        const pool = images.slice(TILE_COUNT);
        replacementPoolRef.current = pool;
        replacementIndexRef.current = 0;

        setTiles(prev => initial.map((img, i) => ({
          ...(prev[i] ?? makeTileState(img)),
          src: img.src,
          alt: img.alt,
        })));
      })
      .catch(() => {
        // API failed — stick with fallback tiles, no replacement pool needed
      });
    return () => { cancelled = true; };
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

  // ─── Replacement pool ────────────────────────────────────────────

  const getNextReplacement = useCallback(() => {
    const pool = replacementPoolRef.current;
    if (pool.length === 0) {
      // No dynamic pool loaded — cycle through fallback tiles
      const idx = replacementIndexRef.current % FALLBACK_TILES.length;
      replacementIndexRef.current++;
      return FALLBACK_TILES[idx];
    }
    const idx = replacementIndexRef.current % pool.length;
    replacementIndexRef.current++;
    return pool[idx];
  }, []);

  // ─── Ball impact — progressive damage ────────────────────────────

  const handleBallImpact = useCallback((viewportX: number, viewportY: number, force: number) => {
    // Find which tile was hit
    let hitIndex = -1;
    let bestDist = Infinity;
    let localX = 0.5;
    let localY = 0.5;

    tileRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
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
          localX = (viewportX - rect.left) / rect.width;
          localY = (viewportY - rect.top) / rect.height;
        }
      }
    });

    // Fallback: nearest tile
    if (hitIndex === -1) {
      tileRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.sqrt((viewportX - cx) ** 2 + (viewportY - cy) ** 2);
        if (dist < bestDist) {
          bestDist = dist;
          hitIndex = i;
          localX = Math.max(0, Math.min(1, (viewportX - rect.left) / rect.width));
          localY = Math.max(0, Math.min(1, (viewportY - rect.top) / rect.height));
        }
      });
    }

    if (hitIndex === -1) return;

    setTiles(prev => {
      const tile = prev[hitIndex];
      // Skip tiles that are already shattering, shifting, or fully broken
      if (tile.breaking || tile.dropping || tile.hits >= 3) return prev;

      return prev.map((t, i) => {
        if (i !== hitIndex) return t;

        const newHits = t.hits + 1;

        if (newHits < 3) {
          // Hit 1 or 2 — add cracks
          return {
            ...t,
            hits: newHits,
            crackImpacts: [...t.crackImpacts, { x: localX, y: localY }],
            impactX: localX,
            impactY: localY,
            flashKey: t.flashKey + 1,
          };
        } else {
          // Hit 3 — SHATTER
          return {
            ...t,
            hits: 3,
            breaking: true,
            impactX: localX,
            impactY: localY,
            impactForce: 2 + force * 2,
            flashKey: t.flashKey + 1,
          };
        }
      });
    });
  }, []);

  // ─── Shatter complete → column shift ─────────────────────────────

  const handleBreakComplete = useCallback((tileIndex: number) => {
    setTimeout(() => {
      const col = tileIndex % GRID_COLS;
      const row = Math.floor(tileIndex / GRID_COLS);

      setTiles(prev => {
        const next = prev.map(t => ({ ...t }));
        const replacement = getNextReplacement();

        // Shift images DOWN within the column: rows [row-1, row-2, ..., 0]
        // Row N gets image from row N-1, row 0 gets a fresh replacement
        for (let r = row; r > 0; r--) {
          const dstIdx = col + r * GRID_COLS;
          const srcIdx = col + (r - 1) * GRID_COLS;
          next[dstIdx].src = prev[srcIdx].src;
          next[dstIdx].alt = prev[srcIdx].alt;
        }

        // Top of column gets new image
        next[col].src = replacement.src;
        next[col].alt = replacement.alt;

        // Reset state + set drop animation for all affected tiles (rows 0..row)
        for (let r = 0; r <= row; r++) {
          const idx = col + r * GRID_COLS;
          next[idx].hits = 0;
          next[idx].crackImpacts = [];
          next[idx].breaking = false;
          next[idx].dropping = true;
          next[idx].dropDelay = r * 90; // cascade from top
          next[idx].dropVersion = prev[idx].dropVersion + 1;
        }

        return next;
      });

      // Clear dropping state after animation completes
      setTimeout(() => {
        setTiles(prev => prev.map(t =>
          t.dropping ? { ...t, dropping: false, dropDelay: 0 } : t
        ));
      }, COLUMN_ANIM_DURATION + 200);
    }, REPLACE_DELAY);
  }, [getNextReplacement]);

  // ─── Computed phase styles ───────────────────────────────────────

  const gridOpacity =
    phase === 'void' ? 0 :
    phase === 'grid' ? 0.15 :
    phase === 'shapes' ? 0.4 :
    phase === 'color' ? 0.7 :
    1.0;

  const gridFilter =
    phase === 'void' ? 'grayscale(1) brightness(0)' :
    phase === 'grid' ? 'grayscale(1) brightness(0.3) contrast(1.5)' :
    phase === 'shapes' ? 'grayscale(0.8) brightness(0.4) contrast(1.2)' :
    phase === 'color' ? 'grayscale(0.3) brightness(0.5) saturate(1.2)' :
    'grayscale(0) saturate(1.3)';

  const isAlive = phase === 'alive';
  // Ball is never globally disabled — handleBallImpact skips
  // tiles that are already breaking/dropping, so the user can
  // rapid-fire throws at different tiles without waiting.

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        // zIndex: 1 sits above the text layer (z: 0) on pages/index.tsx
        // so tiles fully obscure the hero H1 + subtitle until broken.
        zIndex: 1,
        // Transparent so the text layer behind this container becomes
        // visible through any tile cell that has been shattered.
        background: 'transparent',
      }}
    >
      {/* Grid lines */}
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
          gap: 0,
          backgroundColor: '#030308',
          opacity: gridOpacity,
          filter: gridFilter,
          transition: 'opacity 2s ease, filter 2.5s ease',
          willChange: 'opacity, filter',
          transform: `translate(${(mouse.x - 0.5) * -12}px, ${(mouse.y - 0.5) * -12}px)`,
        }}
      >
        {tiles.map((tile, i) => {
          const col = i % GRID_COLS;
          const row = Math.floor(i / GRID_COLS);
          const tileCenterX = (col + 0.5) / GRID_COLS;
          const tileCenterY = (row + 0.5) / GRID_ROWS;
          const dx = mouse.x - tileCenterX;
          const dy = mouse.y - tileCenterY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximityBoost = isAlive ? Math.max(0, 1 - dist * 2.2) : 0;
          const stagger = (row * GRID_COLS + col) * 120;

          // Crack intensity visual — slight red tint as damage increases
          const crackTint = tile.hits > 0 && !tile.breaking
            ? `brightness(${1 - tile.hits * 0.05})`
            : '';

          return (
            <div
              key={`tile-${i}`}
              ref={el => { tileRefs.current[i] = el; }}
              style={{
                position: 'relative',
                overflow: 'hidden',
                filter: isAlive && !tile.breaking
                  ? `brightness(${1 + proximityBoost * 0.8}) saturate(${1 + proximityBoost * 1.2}) ${crackTint}`
                  : crackTint || 'none',
                transition: 'filter 0.4s ease, transform 0.6s ease',
                transitionDelay: phase === 'shapes' ? `${stagger}ms` : '0ms',
                transform: isAlive && !tile.breaking
                  ? `scale(${1 + proximityBoost * 0.04})`
                  : 'none',
              }}
            >
              {/* Image layer — hidden during shatter, animated during column drop */}
              <div
                key={`img-${tile.dropVersion}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: tile.breaking ? 0 : 1,
                  transition: tile.breaking ? 'opacity 0.1s ease' : undefined,
                  // Column drop animation
                  ...(tile.dropping ? {
                    animation: `columnSlotIn 0.55s cubic-bezier(0.22, 1.2, 0.36, 1) ${tile.dropDelay}ms both`,
                  } : {}),
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

              {/* Crack overlay — visible for hits 1 and 2 */}
              {tile.hits > 0 && tile.hits < 3 && !tile.breaking && !tile.dropping && (
                <GlassCrackOverlay
                  width={tileRefs.current[i]?.offsetWidth ?? 300}
                  height={tileRefs.current[i]?.offsetHeight ?? 250}
                  impacts={tile.crackImpacts}
                />
              )}

              {/* Shatter effect — hit 3 */}
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

              {/* Impact flash — on every hit */}
              {tile.hits > 0 && !tile.dropping && (
                <div
                  key={`flash-${tile.flashKey}`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at ${tile.impactX * 100}% ${tile.impactY * 100}%, rgba(200, 230, 255, ${tile.hits >= 3 ? 0.5 : 0.3}) 0%, transparent 60%)`,
                    opacity: 0,
                    animation: 'impactFlash 0.35s ease-out forwards',
                    pointerEvents: 'none',
                    zIndex: 11,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mouse spotlight */}
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

      {/* Center vignette — relaxed so the hero text layer behind this
          container is still legible through broken tiles */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          pointerEvents: 'none',
          background: `radial-gradient(
            ellipse 55% 50% at 50% 50%,
            rgba(3, 3, 8, 0) 0%,
            rgba(3, 3, 8, 0) 35%,
            rgba(3, 3, 8, 0.35) 80%,
            transparent 100%
          )`,
        }}
      />

      {/* Edge fade */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          boxShadow: 'inset 0 0 120px 60px #030308, inset 0 0 250px 100px rgba(3, 3, 8, 0.5)',
        }}
      />

      {/* Throwable ball */}
      {isAlive && (
        <ThrowBall
          onImpact={handleBallImpact}
          disabled={false}
          containerRef={containerRef}
        />
      )}

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes impactFlash {
          0% { opacity: 0.9; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        @keyframes columnSlotIn {
          0% {
            transform: translateY(-90px);
            opacity: 0;
            filter: brightness(1.6) blur(2px);
          }
          35% {
            opacity: 1;
          }
          70% {
            transform: translateY(5px);
            filter: brightness(1.1) blur(0px);
          }
          85% {
            transform: translateY(-2px);
          }
          100% {
            transform: translateY(0);
            opacity: 1;
            filter: brightness(1) blur(0px);
          }
        }
      `}</style>
    </div>
  );
}
