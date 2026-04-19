/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HERO MATERIAL BACKGROUND — animated mathematical-material field
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A canvas-rendered animated gradient field behind the hero tiles. Uses
 * multiple overlapping sine-based field functions (cheap analog of perlin
 * noise) to produce a slowly-flowing "cold material" — cyan/purple/magenta
 * interference bands that feel crystalline + refractive, so they pair well
 * with the glass-break effect when a tile shatters and exposes them.
 *
 * Low-frequency motion (≥3s per cycle) so nothing strobes, and a thin grid
 * overlay on top for the "mathematical" read.
 *
 * SSR-safe: renders an empty container on the server; useEffect spins up
 * the canvas after mount.
 */

import React, { useEffect, useRef } from 'react';

interface HeroMaterialBackgroundProps {
  /** CSS zIndex for the canvas container. Default 0. */
  zIndex?: number;
}

export default function HeroMaterialBackground({ zIndex = 0 }: HeroMaterialBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    startTimeRef.current = performance.now();

    const render = (now: number) => {
      const t = (now - startTimeRef.current) / 1000; // seconds

      // Low-res backing buffer for the smooth gradient field — we paint a
      // coarse grid of coloured cells and let CSS blur them, which is far
      // cheaper than a per-pixel shader while still reading "mathematical".
      const cellsX = 24;
      const cellsY = 14;
      const cellW = width / cellsX;
      const cellH = height / cellsY;

      // Base colour wash
      ctx.fillStyle = '#030308';
      ctx.fillRect(0, 0, width, height);

      for (let j = 0; j <= cellsY; j++) {
        for (let i = 0; i <= cellsX; i++) {
          const u = i / cellsX;
          const v = j / cellsY;

          // Three overlapping sine fields in different directions + speeds.
          const a = Math.sin((u * 4.2) + (v * 2.1) + t * 0.35);
          const b = Math.sin((u * 1.8) - (v * 3.4) + t * 0.27 + 1.7);
          const c = Math.sin((u * 2.7) + (v * 2.9) - t * 0.19 + 3.1);
          const field = (a + b + c) / 3; // -1..1

          // Diagonal wash gradient on top so corners have a direction.
          const wash = Math.sin((u + v) * Math.PI * 0.6 + t * 0.12);

          const intensity = (field * 0.6 + wash * 0.4 + 1) / 2; // 0..1

          // Colour palette: deep navy → cyan → magenta → indigo
          // The material should feel crystalline. Keep saturation moderate.
          const r = Math.round(12 + intensity * 70 + Math.max(0, field) * 60);
          const g = Math.round(18 + intensity * 90 + Math.max(0, -field) * 30);
          const bC = Math.round(38 + intensity * 170);

          ctx.fillStyle = `rgb(${r}, ${g}, ${bC})`;
          ctx.fillRect(i * cellW - cellW * 0.5, j * cellH - cellH * 0.5, cellW * 1.1, cellH * 1.1);
        }
      }

      // Soft vignette toward page background so edges of the hero blend
      // into the darker section background.
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.25,
        width / 2, height / 2, Math.max(width, height) * 0.7
      );
      vignette.addColorStop(0, 'rgba(3, 3, 8, 0)');
      vignette.addColorStop(0.7, 'rgba(3, 3, 8, 0.35)');
      vignette.addColorStop(1, 'rgba(3, 3, 8, 0.75)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          filter: 'blur(18px) saturate(1.15)',
          transform: 'scale(1.05)', // hide blur edge bleed
        }}
      />
      {/* Thin grid overlay for the "mathematical material" read */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.12,
          backgroundImage:
            'linear-gradient(rgba(125, 230, 255, 0.35) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(125, 230, 255, 0.35) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      {/* Caustic shimmer — faint moving highlights */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.35,
          mixBlendMode: 'screen',
          background:
            'radial-gradient(ellipse 40% 30% at 30% 40%, rgba(125, 230, 255, 0.18), transparent 60%),' +
            'radial-gradient(ellipse 35% 35% at 70% 65%, rgba(200, 130, 255, 0.12), transparent 60%)',
          animation: 'materialCaustic 14s ease-in-out infinite alternate',
          pointerEvents: 'none',
        }}
      />
      <style jsx>{`
        @keyframes materialCaustic {
          0%   { transform: translate(0px, 0px) scale(1); }
          50%  { transform: translate(20px, -12px) scale(1.06); }
          100% { transform: translate(-14px, 10px) scale(1); }
        }
      `}</style>
    </div>
  );
}
