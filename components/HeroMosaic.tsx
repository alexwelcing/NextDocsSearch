/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HERO MOSAIC — Interactive image tile wall with glass-break reveal
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A 4×3 grid of 12 randomly-selected AI artwork tiles. Tiles are fully
 * opaque so they obscure the H1/subtitle in the page layer behind.
 * Breaking a tile with the ball permanently removes it, revealing the
 * text underneath. There is no replacement — every break uncovers more.
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
const TILE_FILL_COLOR = '#030308';

// ─── Image pool ──────────────────────────────────────────────────────────
// Dynamic images are fetched from /api/tile-images at mount and merged
// with the fallback list. The combined, deduped pool is shuffled and
// 12 random entries are selected for this pageload.

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

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function dedupeBySrc<T extends { src: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    if (seen.has(item.src)) return false;
    seen.add(item.src);
    return true;
  });
}

// ─── Types ───────────────────────────────────────────────────────────────

interface TileState {
  src: string;
  alt: string;
  hits: number;                             // 0-3
  crackImpacts: { x: number; y: number }[]; // impact points for cracks (up to 2)
  breaking: boolean;                        // true during final shatter animation
  shattered: boolean;                       // true after shatter completes — cell is now empty
  impactX: number;                          // last impact point (for shatter)
  impactY: number;
  impactForce: number;
  flashKey: number;                         // increment to restart impact flash
}

function makeTileState(t: { src: string; alt: string }): TileState {
  return {
    ...t,
    hits: 0,
    crackImpacts: [],
    breaking: false,
    shattered: false,
    impactX: 0.5,
    impactY: 0.5,
    impactForce: 3,
    flashKey: 0,
  };
}

// ─── Component ────────────────────────────────────────────────────────────

export default function HeroMosaic() {
  const [mounted, setMounted] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);
  const initialSelectionDoneRef = useRef(false);

  // SSR-safe initial: first 12 fallback tiles. Client reshuffles on mount,
  // and that shuffle stays locked for the rest of the session so mid-game
  // reshuffles don't wipe out user progress.
  const [tiles, setTiles] = useState<TileState[]>(
    () => FALLBACK_TILES.slice(0, TILE_COUNT).map(makeTileState)
  );

  // Pick the 12 random tiles for this pageload (once).
  useEffect(() => {
    let cancelled = false;

    const selectInitial = (pool: { src: string; alt: string }[]) => {
      if (cancelled || initialSelectionDoneRef.current) return;
      initialSelectionDoneRef.current = true;
      const chosen = shuffle(dedupeBySrc(pool)).slice(0, TILE_COUNT);
      setTiles(chosen.map(makeTileState));
    };

    // If the API is slow, fall back to the local shuffle quickly so tiles
    // never look "frozen" in their SSR positions.
    const timeoutId = setTimeout(() => selectInitial(FALLBACK_TILES), 400);

    fetch('/api/tile-images')
      .then(res => res.ok ? res.json() : Promise.reject(res.status))
      .then((images: { src: string; alt: string }[]) => {
        clearTimeout(timeoutId);
        const pool = images.length > 0
          ? [...images, ...FALLBACK_TILES]
          : FALLBACK_TILES;
        selectInitial(pool);
      })
      .catch(() => {
        clearTimeout(timeoutId);
        selectInitial(FALLBACK_TILES);
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  // Flip mounted after hydration so window-dependent children (ThrowBall)
  // only render client-side.
  useEffect(() => { setMounted(true); }, []);

  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMouse({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
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
      // Skip tiles that are already shattering or fully gone
      if (tile.breaking || tile.shattered) return prev;

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

  // ─── Shatter complete → mark tile as permanently gone ────────────

  const handleBreakComplete = useCallback((tileIndex: number) => {
    setTiles(prev => prev.map((t, i) =>
      i === tileIndex ? { ...t, breaking: false, shattered: true } : t
    ));
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        // zIndex: 1 sits above the text layer (z: 0) on pages/index.tsx
        // so intact tiles fully obscure the hero H1 + subtitle.
        zIndex: 1,
        // Transparent so shattered tiles reveal the text layer behind.
        background: 'transparent',
      }}
    >
      {/* Grid lines — subtle at rest */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          opacity: 0.06,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
          pointerEvents: 'none',
        }}
      />

      {/* Tile grid — no container background; each tile fills its own cell */}
      <div
        style={{
          position: 'absolute',
          inset: '-5%',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 0,
          filter: 'grayscale(0) saturate(1.3)',
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
          const proximityBoost = !tile.shattered && !tile.breaking
            ? Math.max(0, 1 - dist * 2.2)
            : 0;

          // Shattered tile: empty cell. The text layer behind shows through.
          if (tile.shattered) {
            return (
              <div
                key={`tile-${i}`}
                ref={el => { tileRefs.current[i] = el; }}
                style={{ position: 'relative' }}
                aria-hidden="true"
              />
            );
          }

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
                // Each intact tile carries its own opaque background so no
                // text leaks through image transparency or image loading.
                backgroundColor: tile.breaking ? 'transparent' : TILE_FILL_COLOR,
                filter: !tile.breaking
                  ? `brightness(${1 + proximityBoost * 0.8}) saturate(${1 + proximityBoost * 1.2}) ${crackTint}`
                  : 'none',
                transition: 'filter 0.4s ease, transform 0.6s ease, background-color 0.15s ease',
                transform: !tile.breaking
                  ? `scale(${1 + proximityBoost * 0.04})`
                  : 'none',
              }}
            >
              {/* Image — hidden during shatter */}
              {!tile.breaking && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
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
              )}

              {/* Crack overlay — visible for hits 1 and 2 */}
              {tile.hits > 0 && tile.hits < 3 && !tile.breaking && (
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
              {tile.hits > 0 && (
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

      {/* Throwable ball — client-only (ThrowBall touches window at render) */}
      {mounted && (
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
      `}</style>
    </div>
  );
}
