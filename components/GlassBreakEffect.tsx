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
        const speed = impactForce * (1.8 - normalizedDist) * (0.6 + Math.random() * 0.8);

        const relativeVerts = tri.map(p => ({ x: p.x - cx, y: p.y - cy }));

        shards.push({
          vertices: relativeVerts,
          cx: Math.max(0, Math.min(w, cx)),
          cy: Math.max(0, Math.min(h, cy)),
          vx: Math.cos(angle) * speed * (2 + Math.random()) + (Math.random() - 0.5) * 2,
          vy: Math.sin(angle) * speed * (1.5 + Math.random()) - Math.random() * impactForce * 1.5,
          angle: 0,
          angularVel: (Math.random() - 0.5) * 0.3 * impactForce,
          texOffsetX: cx,
          texOffsetY: cy,
          opacity: 1,
          delay: normalizedDist * 120,
          active: false,
          scale: 1 + (1 - normalizedDist) * 0.15,
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
    const img = imageRef.current;
    if (!canvas || !ctx || !img) return;

    const now = performance.now();
    const elapsed = now - startTimeRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
          ctx.drawImage(img, -shard.texOffsetX, -shard.texOffsetY, width, height);
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

      ctx.drawImage(img, -shard.texOffsetX, -shard.texOffsetY, width, height);

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
  }, [width, height]); // *** FIX: no onComplete in deps ***

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;

    img.onload = () => {
      imageRef.current = img;
      shardsRef.current = generateShards(width, height, impactX, impactY, impactForce);
      startTimeRef.current = performance.now();
      completedRef.current = false;
      animationRef.current = requestAnimationFrame(animate);
    };

    return () => {
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
