/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GLASS BREAK EFFECT — Canvas-based glass shattering simulation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Renders a tile-sized canvas that:
 * 1. Captures the tile's appearance via an image snapshot
 * 2. Generates Voronoi-like glass shards on impact
 * 3. Simulates physics: gravity, rotation, velocity, and fade
 * 4. Each shard is a clipped portion of the original image
 *
 * Props:
 *   imageSrc  — the tile image URL to shatter
 *   impactX/Y — normalized (0–1) impact point within the tile
 *   onComplete — fires once when all shards have fallen off-screen
 */

import React, { useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

interface Shard {
  vertices: { x: number; y: number }[];
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  texOffsetX: number;
  texOffsetY: number;
  opacity: number;
  delay: number;
  active: boolean;
  scale: number;
}

interface GlassBreakEffectProps {
  imageSrc: string;
  width: number;
  height: number;
  impactX: number;
  impactY: number;
  impactForce?: number;
  onComplete: () => void;
}

// ─── Shard generation ────────────────────────────────────────────────────

function generateShards(
  w: number,
  h: number,
  impactX: number,
  impactY: number,
  impactForce: number
): Shard[] {
  const shards: Shard[] = [];
  const ix = impactX * w;
  const iy = impactY * h;

  const cols = 5 + Math.floor(Math.random() * 2);
  const rows = 4 + Math.floor(Math.random() * 2);
  const cellW = w / cols;
  const cellH = h / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseX = c * cellW;
      const baseY = r * cellH;
      const jitter = () => (Math.random() - 0.5) * Math.min(cellW, cellH) * 0.35;

      const midX = baseX + cellW * (0.35 + Math.random() * 0.3);
      const midY = baseY + cellH * (0.35 + Math.random() * 0.3);

      const corners = [
        { x: baseX + jitter(), y: baseY + jitter() },
        { x: baseX + cellW + jitter(), y: baseY + jitter() },
        { x: baseX + cellW + jitter(), y: baseY + cellH + jitter() },
        { x: baseX + jitter(), y: baseY + cellH + jitter() },
      ];

      const triangles = [
        [corners[0], corners[1], { x: midX, y: midY }],
        [corners[1], corners[2], { x: midX, y: midY }],
        [corners[2], corners[3], { x: midX, y: midY }],
        [corners[3], corners[0], { x: midX, y: midY }],
      ];

      const usedTriangles = Math.random() < 0.3
        ? [
            [corners[0], corners[1], corners[2], { x: midX, y: midY }],
            [corners[2], corners[3], corners[0], { x: midX, y: midY }],
          ]
        : triangles;

      for (const tri of usedTriangles) {
        const cx = tri.reduce((s, p) => s + p.x, 0) / tri.length;
        const cy = tri.reduce((s, p) => s + p.y, 0) / tri.length;
        const dx = cx - ix;
        const dy = cy - iy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt(w * w + h * h);
        const normalizedDist = dist / maxDist;
        const angle = Math.atan2(dy, dx);
        // Punchier dispersal: shards closest to impact launch hardest, with a
        // stronger outward kick so the wall blows apart instead of sagging.
        const speed = impactForce * (2.4 - normalizedDist) * (0.7 + Math.random() * 0.9);

        const relativeVerts = tri.map(p => ({ x: p.x - cx, y: p.y - cy }));

        shards.push({
          vertices: relativeVerts,
          cx: Math.max(0, Math.min(w, cx)),
          cy: Math.max(0, Math.min(h, cy)),
          vx: Math.cos(angle) * speed * (2.6 + Math.random()) + (Math.random() - 0.5) * 2.5,
          vy:
            Math.sin(angle) * speed * (1.9 + Math.random()) -
            Math.random() * impactForce * 1.8,
          angle: 0,
          angularVel: (Math.random() - 0.5) * 0.42 * impactForce,
          texOffsetX: cx,
          texOffsetY: cy,
          opacity: 1,
          // Tight stagger — the shatter reads as one decisive burst rather than
          // a slow domino, which is what made the old break feel mushy.
          delay: normalizedDist * 55,
          active: false,
          scale: 1 + (1 - normalizedDist) * 0.18,
        });
      }
    }
  }

  return shards;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function GlassBreakEffect({
  imageSrc,
  width,
  height,
  impactX,
  impactY,
  impactForce = 3,
  onComplete,
}: GlassBreakEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const shardsRef = useRef<Shard[]>([]);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const completedRef = useRef(false);

  // *** FIX: Store onComplete in a ref so it doesn't cause re-renders ***
  // The old code had onComplete in useCallback deps → animate recreated →
  // useEffect restarted → shatter looped infinitely.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // img may be null if the source failed to load — the shatter still plays
    // using a frosted-glass fill so the break always completes and the page can
    // advance into the 360 scene.
    const img = imageRef.current;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Paint one clipped shard with either the source texture or a glass fill.
    const paintShard = (s: Shard) => {
      if (img) {
        ctx.drawImage(img, -s.texOffsetX, -s.texOffsetY, width, height);
      } else {
        ctx.fillStyle = 'rgba(150, 200, 235, 0.5)';
        ctx.fillRect(-s.texOffsetX, -s.texOffsetY, width, height);
      }
    };

    // ── Impact burst: a bright flash + expanding shockwave ring for the first
    // ~160ms sells the moment of contact before the shards scatter.
    const ix = impactX * width;
    const iy = impactY * height;
    const burstT = elapsed / 160;
    if (burstT < 1) {
      const flash = Math.pow(1 - burstT, 2);
      const flashRadius = Math.max(width, height) * (0.12 + burstT * 0.55);
      const grad = ctx.createRadialGradient(ix, iy, 0, ix, iy, flashRadius);
      grad.addColorStop(0, `rgba(255, 252, 235, ${0.85 * flash})`);
      grad.addColorStop(0.4, `rgba(190, 230, 255, ${0.4 * flash})`);
      grad.addColorStop(1, 'rgba(190, 230, 255, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      // Shockwave ring travelling outward from the impact point.
      const ringR = Math.max(width, height) * burstT * 0.9;
      ctx.beginPath();
      ctx.arc(ix, iy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * flash})`;
      ctx.lineWidth = 2 + 4 * flash;
      ctx.stroke();
      ctx.restore();
    }

    const gravity = 0.35;
    let allDone = true;

    for (const shard of shardsRef.current) {
      if (!shard.active) {
        if (elapsed > shard.delay) {
          shard.active = true;
        } else {
          allDone = false;
          ctx.save();
          ctx.translate(shard.cx, shard.cy);
          ctx.beginPath();
          shard.vertices.forEach((v, i) => {
            if (i === 0) ctx.moveTo(v.x, v.y);
            else ctx.lineTo(v.x, v.y);
          });
          ctx.closePath();
          ctx.clip();
          paintShard(shard);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.restore();
          continue;
        }
      }

      shard.vy += gravity;
      shard.cx += shard.vx;
      shard.cy += shard.vy;
      shard.angle += shard.angularVel;
      shard.scale = Math.max(0.3, shard.scale - 0.003);

      if (shard.cy > height * 0.5) {
        shard.opacity = Math.max(0, shard.opacity - 0.025);
      }

      if (shard.opacity <= 0 || shard.cy > height * 2.5 || shard.cx < -width || shard.cx > width * 2) {
        continue;
      }

      allDone = false;

      ctx.save();
      ctx.globalAlpha = shard.opacity;
      ctx.translate(shard.cx, shard.cy);
      ctx.rotate(shard.angle);
      ctx.scale(shard.scale, shard.scale);

      ctx.beginPath();
      shard.vertices.forEach((v, i) => {
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.clip();

      paintShard(shard);

      const gradient = ctx.createLinearGradient(-30, -30, 30, 30);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.strokeStyle = `rgba(200, 230, 255, ${0.3 * shard.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    if (allDone && !completedRef.current) {
      completedRef.current = true;
      onCompleteRef.current();
      return;
    }

    animationRef.current = requestAnimationFrame(animate);
    // onComplete is intentionally excluded (read via ref) to avoid restart loops;
    // impactX/impactY are stable for a given break instance.
  }, [width, height, impactX, impactY]);

  useEffect(() => {
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      shardsRef.current = generateShards(width, height, impactX, impactY, impactForce);
      startTimeRef.current = performance.now();
      completedRef.current = false;
      animationRef.current = requestAnimationFrame(animate);
    };

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      start();
    };
    // Never let a missing texture strand the shatter — start anyway so the
    // pane still breaks and the completion handler fires.
    img.onerror = () => start();
    img.src = imageSrc;

    // Safety net for caches/decoders that resolve without firing onload.
    const fallbackTimer = window.setTimeout(start, 220);

    return () => {
      window.clearTimeout(fallbackTimer);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [imageSrc, width, height, impactX, impactY, impactForce, animate]);

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
        zIndex: 10,
      }}
    />
  );
}
