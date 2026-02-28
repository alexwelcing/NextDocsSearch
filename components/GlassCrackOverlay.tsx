/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GLASS CRACK OVERLAY — Canvas-rendered progressive crack patterns
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renders an accumulating crack pattern on a tile after each ball impact.
 *   Hit 1: Hairline cracks — thin, short radial lines from impact
 *   Hit 2: Major cracks — thicker, longer lines with branches + stress arcs
 *
 * Cracks spread outward from the impact point with a brief reveal animation.
 * Old cracks persist when new ones are added.
 */

import React, { useEffect, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

interface CrackImpact {
  x: number; // 0-1 normalized
  y: number;
}

interface GlassCrackOverlayProps {
  width: number;
  height: number;
  impacts: CrackImpact[];
}

interface CrackPath {
  points: { x: number; y: number }[];
  width: number;
  opacity: number;
}

// ─── Seeded random for deterministic crack shapes ────────────────────────

function seededRandom(seed: number) {
  let s = Math.abs(Math.round(seed)) || 1;
  return () => {
    s = (s * 16807 + 11) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Crack generation ────────────────────────────────────────────────────

function generateCracksForImpact(
  w: number,
  h: number,
  impact: CrackImpact,
  level: 1 | 2,
  seed: number
): CrackPath[] {
  const rand = seededRandom(seed);
  const cracks: CrackPath[] = [];
  const ix = impact.x * w;
  const iy = impact.y * h;
  const diag = Math.sqrt(w * w + h * h);

  // Level 1: sparse hairline cracks
  // Level 2: dense, thick, branching cracks
  const numRays = level === 1
    ? 5 + Math.floor(rand() * 4)
    : 9 + Math.floor(rand() * 6);
  const maxLen = level === 1 ? diag * 0.28 : diag * 0.55;
  const baseWidth = level === 1 ? 0.7 : 1.6;

  for (let r = 0; r < numRays; r++) {
    const baseAngle = (r / numRays) * Math.PI * 2;
    const angle = baseAngle + (rand() - 0.5) * (Math.PI * 2 / numRays) * 0.6;
    const length = maxLen * (0.35 + rand() * 0.65);
    const segments = 4 + Math.floor(rand() * 5);

    // Build jagged line from impact outward
    const points: { x: number; y: number }[] = [{ x: ix, y: iy }];
    let cx = ix, cy = iy;
    let curAngle = angle;

    for (let s = 0; s < segments; s++) {
      const segLen = length / segments;
      curAngle += (rand() - 0.5) * 0.55;
      cx += Math.cos(curAngle) * segLen;
      cy += Math.sin(curAngle) * segLen;
      points.push({ x: cx, y: cy });
    }

    cracks.push({
      points,
      width: baseWidth * (0.5 + rand() * 0.8),
      opacity: 0.5 + rand() * 0.5,
    });

    // Branches (level 2 only)
    if (level === 2 && rand() < 0.55) {
      const branchIdx = 1 + Math.floor(rand() * Math.max(1, segments - 1));
      const bp = points[Math.min(branchIdx, points.length - 1)];
      const branchAngle = curAngle + (rand() < 0.5 ? 1 : -1) * (0.4 + rand() * 0.9);
      const branchLen = length * 0.35 * (0.4 + rand() * 0.6);
      const branchSegs = 2 + Math.floor(rand() * 3);

      const bPoints: { x: number; y: number }[] = [{ x: bp.x, y: bp.y }];
      let bx = bp.x, by = bp.y;
      let bAngle = branchAngle;

      for (let s = 0; s < branchSegs; s++) {
        bAngle += (rand() - 0.5) * 0.4;
        bx += Math.cos(bAngle) * (branchLen / branchSegs);
        by += Math.sin(bAngle) * (branchLen / branchSegs);
        bPoints.push({ x: bx, y: by });
      }

      cracks.push({
        points: bPoints,
        width: baseWidth * 0.4,
        opacity: 0.3 + rand() * 0.3,
      });
    }
  }

  // Concentric stress arcs (level 2 only)
  if (level === 2) {
    for (let ring = 0; ring < 3; ring++) {
      const radius = diag * (0.04 + ring * 0.04);
      const arcSegs = 4 + Math.floor(rand() * 4);
      const startAngle = rand() * Math.PI * 2;
      const arcSpan = Math.PI * (0.25 + rand() * 0.4);

      const points: { x: number; y: number }[] = [];
      for (let s = 0; s <= arcSegs; s++) {
        const a = startAngle + (s / arcSegs) * arcSpan;
        const jitR = radius + (rand() - 0.5) * radius * 0.25;
        points.push({
          x: ix + Math.cos(a) * jitR,
          y: iy + Math.sin(a) * jitR,
        });
      }

      cracks.push({ points, width: 0.5, opacity: 0.2 + rand() * 0.2 });
    }
  }

  return cracks;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function GlassCrackOverlay({ width, height, impacts }: GlassCrackOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cachedRef = useRef<CrackPath[][]>([]);
  const animRef = useRef<number>(0);
  const lastCountRef = useRef(0);

  // Keep impacts accessible without adding to effect deps
  const impactsRef = useRef(impacts);
  impactsRef.current = impacts;

  useEffect(() => {
    const currentImpacts = impactsRef.current;

    // Generate cracks for any new impacts
    while (cachedRef.current.length < currentImpacts.length) {
      const idx = cachedRef.current.length;
      const level = Math.min(idx + 1, 2) as 1 | 2;
      const imp = currentImpacts[idx];
      const seed = Math.round(imp.x * 13731 + imp.y * 7919 + idx * 3571);
      cachedRef.current.push(generateCracksForImpact(width, height, imp, level, seed));
    }

    // Reveal animation for the latest crack set
    const isNewImpact = currentImpacts.length > lastCountRef.current;
    lastCountRef.current = currentImpacts.length;

    const revealDuration = 350;
    const latestIdx = currentImpacts.length - 1;
    const startTime = performance.now();

    const draw = (now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const elapsed = now - startTime;
      const revealT = isNewImpact ? Math.min(1, elapsed / revealDuration) : 1;

      ctx.clearRect(0, 0, width, height);

      cachedRef.current.forEach((crackSet, setIdx) => {
        const imp = currentImpacts[setIdx];
        if (!imp) return;

        // For the latest set, use reveal radius; others are fully revealed
        const isLatest = setIdx === latestIdx && isNewImpact;
        const maxRadius = isLatest
          ? Math.sqrt(width * width + height * height) * revealT
          : Infinity;
        const ix = imp.x * width;
        const iy = imp.y * height;

        for (const crack of crackSet) {
          ctx.save();

          // Main crack line
          ctx.strokeStyle = `rgba(200, 230, 255, ${crack.opacity})`;
          ctx.lineWidth = crack.width;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          let started = false;
          for (const pt of crack.points) {
            const dist = Math.sqrt((pt.x - ix) ** 2 + (pt.y - iy) ** 2);
            if (dist <= maxRadius) {
              if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
              else ctx.lineTo(pt.x, pt.y);
            }
          }
          if (started) ctx.stroke();

          // Glow halo
          ctx.globalAlpha = crack.opacity * 0.25;
          ctx.lineWidth = crack.width + 3;
          ctx.strokeStyle = 'rgba(180, 220, 255, 0.25)';
          if (started) ctx.stroke();

          ctx.restore();
        }
      });

      if (isNewImpact && revealT < 1) {
        animRef.current = requestAnimationFrame(draw);
      }
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [impacts.length, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}
