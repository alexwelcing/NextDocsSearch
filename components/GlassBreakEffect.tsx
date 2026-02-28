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
 *   onComplete — fires when all shards have fallen off-screen
 */

import React, { useEffect, useRef, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────

interface Shard {
  // Polygon vertices (relative to shard center)
  vertices: { x: number; y: number }[];
  // Center position
  cx: number;
  cy: number;
  // Velocity
  vx: number;
  vy: number;
  // Rotation
  angle: number;
  angularVel: number;
  // Image sampling offset
  texOffsetX: number;
  texOffsetY: number;
  // Opacity for fade-out
  opacity: number;
  // Delay before shard starts moving (creates ripple from impact)
  delay: number;
  // Whether this shard has started animating
  active: boolean;
  // Scale for 3D-ish pop effect
  scale: number;
}

interface GlassBreakEffectProps {
  imageSrc: string;
  width: number;
  height: number;
  impactX: number; // 0-1 normalized
  impactY: number; // 0-1 normalized
  impactForce?: number; // multiplier for explosion force
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

  // Generate random points for Voronoi-like tessellation
  const numPoints = 28 + Math.floor(Math.random() * 12); // 28-40 shards
  const points: { x: number; y: number }[] = [];

  // Add corner and edge points for complete coverage
  points.push({ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h });
  // Edge midpoints
  points.push({ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 });

  // Random interior points — biased toward impact point
  for (let i = 0; i < numPoints; i++) {
    const bias = Math.random() < 0.4; // 40% chance to cluster near impact
    const px = bias
      ? ix + (Math.random() - 0.5) * w * 0.5
      : Math.random() * w;
    const py = bias
      ? iy + (Math.random() - 0.5) * h * 0.5
      : Math.random() * h;
    points.push({
      x: Math.max(0, Math.min(w, px)),
      y: Math.max(0, Math.min(h, py)),
    });
  }

  // Delaunay-like triangulation using a simple ear-clipping approach
  // We'll use a grid-based approach for reliable shard generation
  const cols = 5 + Math.floor(Math.random() * 2);
  const rows = 4 + Math.floor(Math.random() * 2);
  const cellW = w / cols;
  const cellH = h / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const baseX = c * cellW;
      const baseY = r * cellH;

      // Jitter the cell corners for organic look
      const jitter = () => (Math.random() - 0.5) * Math.min(cellW, cellH) * 0.35;

      // Split each cell into 2 triangles with jittered midpoint
      const midX = baseX + cellW * (0.35 + Math.random() * 0.3);
      const midY = baseY + cellH * (0.35 + Math.random() * 0.3);

      // Create irregular polygon (3-5 vertices) from the cell
      const corners = [
        { x: baseX + jitter(), y: baseY + jitter() },
        { x: baseX + cellW + jitter(), y: baseY + jitter() },
        { x: baseX + cellW + jitter(), y: baseY + cellH + jitter() },
        { x: baseX + jitter(), y: baseY + cellH + jitter() },
      ];

      // Split into two triangles
      const triangles = [
        [corners[0], corners[1], { x: midX, y: midY }],
        [corners[1], corners[2], { x: midX, y: midY }],
        [corners[2], corners[3], { x: midX, y: midY }],
        [corners[3], corners[0], { x: midX, y: midY }],
      ];

      // Randomly merge some adjacent triangles for variety
      const usedTriangles = Math.random() < 0.3
        ? [
            [corners[0], corners[1], corners[2], { x: midX, y: midY }],
            [corners[2], corners[3], corners[0], { x: midX, y: midY }],
          ]
        : triangles;

      for (const tri of usedTriangles) {
        // Compute centroid
        const cx = tri.reduce((s, p) => s + p.x, 0) / tri.length;
        const cy = tri.reduce((s, p) => s + p.y, 0) / tri.length;

        // Distance from impact
        const dx = cx - ix;
        const dy = cy - iy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt(w * w + h * h);
        const normalizedDist = dist / maxDist;

        // Velocity — shards near impact fly faster and more outward
        const angle = Math.atan2(dy, dx);
        const speed = impactForce * (1.8 - normalizedDist) * (0.6 + Math.random() * 0.8);

        // Convert vertices to be relative to centroid
        const relativeVerts = tri.map(p => ({
          x: p.x - cx,
          y: p.y - cy,
        }));

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
          delay: normalizedDist * 120, // Ripple delay in ms
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
      // Activate shard after its delay
      if (!shard.active) {
        if (elapsed > shard.delay) {
          shard.active = true;
        } else {
          allDone = false;
          // Draw shard in original position while waiting
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
          // Glass edge highlight
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.restore();
          continue;
        }
      }

      // Physics update
      shard.vy += gravity;
      shard.cx += shard.vx;
      shard.cy += shard.vy;
      shard.angle += shard.angularVel;
      shard.scale = Math.max(0.3, shard.scale - 0.003);

      // Fade out as shards fall
      if (shard.cy > height * 0.5) {
        shard.opacity = Math.max(0, shard.opacity - 0.025);
      }

      // Check if shard is still visible
      if (shard.opacity <= 0 || shard.cy > height * 2.5 || shard.cx < -width || shard.cx > width * 2) {
        continue;
      }

      allDone = false;

      // Draw shard
      ctx.save();
      ctx.globalAlpha = shard.opacity;
      ctx.translate(shard.cx, shard.cy);
      ctx.rotate(shard.angle);
      ctx.scale(shard.scale, shard.scale);

      // Clip to shard shape
      ctx.beginPath();
      shard.vertices.forEach((v, i) => {
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.clip();

      // Draw the image portion
      ctx.drawImage(img, -shard.texOffsetX, -shard.texOffsetY, width, height);

      // Glass reflection highlight on each shard
      const gradient = ctx.createLinearGradient(-30, -30, 30, 30);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Sharp glass edge
      ctx.strokeStyle = `rgba(200, 230, 255, ${0.3 * shard.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    if (allDone && !completedRef.current) {
      completedRef.current = true;
      onComplete();
      return;
    }

    animationRef.current = requestAnimationFrame(animate);
  }, [width, height, onComplete]);

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
