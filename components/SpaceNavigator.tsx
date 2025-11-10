/**
 * Space Navigator - 2D Top-Down Arcade Navigation View
 *
 * Main navigation interface inspired by space shooters and Mass Effect galaxy map.
 * Shows worlds as nebulous clusters with articles as glowing points.
 *
 * Mobile-first with touch controls:
 * - Touch/drag to move camera
 * - Tap world to zoom into 360 view
 * - Pinch to zoom (optional)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { WORLDS } from '../config/worlds';
import { useTrophy } from './TrophyContext';

interface SpaceNavigatorProps {
  onWorldSelect: (worldId: number) => void;
  isMobile?: boolean;
}

interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export const SpaceNavigator: React.FC<SpaceNavigatorProps> = ({
  onWorldSelect,
  isMobile = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });
  const cameraRef = useRef<CameraState>({
    x: 0.5,
    y: 0.5,
    zoom: 1.0,
    targetX: 0.5,
    targetY: 0.5,
    targetZoom: 1.0,
  });

  const particlesRef = useRef<Particle[]>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);

  const { getWorldProgress, isWorldCompleted } = useTrophy();

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Create ambient particles
  const createParticle = useCallback((worldX?: number, worldY?: number): Particle => {
    const isWorldParticle = worldX !== undefined && worldY !== undefined;

    return {
      x: isWorldParticle ? worldX + (Math.random() - 0.5) * 0.15 : Math.random(),
      y: isWorldParticle ? worldY + (Math.random() - 0.5) * 0.15 : Math.random(),
      vx: (Math.random() - 0.5) * 0.0001,
      vy: (Math.random() - 0.5) * 0.0001,
      life: Math.random() * 100,
      maxLife: 100 + Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      color: isWorldParticle
        ? `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`
        : `rgba(100, 100, 150, ${Math.random() * 0.5})`,
    };
  }, []);

  // Initialize particles
  useEffect(() => {
    const particles: Particle[] = [];

    // Background particles
    for (let i = 0; i < 100; i++) {
      particles.push(createParticle());
    }

    // World nebula particles
    WORLDS.forEach((world) => {
      for (let i = 0; i < 30; i++) {
        particles.push(createParticle(world.spaceX, world.spaceY));
      }
    });

    particlesRef.current = particles;
  }, [createParticle]);

  // World to screen coordinates
  const worldToScreen = useCallback(
    (wx: number, wy: number): { x: number; y: number } => {
      const camera = cameraRef.current;
      const { width, height } = dimensions;

      const x = (wx - camera.x) * camera.zoom * width + width / 2;
      const y = (wy - camera.y) * camera.zoom * height + height / 2;

      return { x, y };
    },
    [dimensions]
  );

  // Screen to world coordinates
  const screenToWorld = useCallback(
    (sx: number, sy: number): { x: number; y: number } => {
      const camera = cameraRef.current;
      const { width, height } = dimensions;

      const x = (sx - width / 2) / (camera.zoom * width) + camera.x;
      const y = (sy - height / 2) / (camera.zoom * height) + camera.y;

      return { x, y };
    },
    [dimensions]
  );

  // Render loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const camera = cameraRef.current;

    // Smooth camera interpolation
    camera.x += (camera.targetX - camera.x) * 0.1;
    camera.y += (camera.targetY - camera.y) * 0.1;
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.1;

    // Clear with dark space background
    ctx.fillStyle = '#000308';
    ctx.fillRect(0, 0, width, height);

    // Update and draw particles
    particlesRef.current.forEach((particle, i) => {
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life++;

      // Respawn if dead
      if (particle.life > particle.maxLife) {
        particlesRef.current[i] = createParticle();
        return;
      }

      // Wrap around edges
      if (particle.x < 0) particle.x = 1;
      if (particle.x > 1) particle.x = 0;
      if (particle.y < 0) particle.y = 1;
      if (particle.y > 1) particle.y = 0;

      // Draw particle
      const screen = worldToScreen(particle.x, particle.y);
      const alpha = 1 - particle.life / particle.maxLife;

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, particle.size, 0, Math.PI * 2);
      ctx.fillStyle = particle.color.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.fill();
    });

    // Draw worlds
    WORLDS.forEach((world) => {
      const screen = worldToScreen(world.spaceX, world.spaceY);
      const progress = getWorldProgress(world.id);
      const completed = isWorldCompleted(world.id);

      // World nebula glow
      const gradient = ctx.createRadialGradient(
        screen.x,
        screen.y,
        0,
        screen.x,
        screen.y,
        80 * camera.zoom
      );
      gradient.addColorStop(0, `${world.color}40`);
      gradient.addColorStop(0.5, `${world.color}20`);
      gradient.addColorStop(1, 'transparent');

      ctx.fillStyle = gradient;
      ctx.fillRect(
        screen.x - 80 * camera.zoom,
        screen.y - 80 * camera.zoom,
        160 * camera.zoom,
        160 * camera.zoom
      );

      // World core (pulsing)
      const pulse = Math.sin(Date.now() * 0.002 + world.id) * 0.3 + 0.7;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 20 * camera.zoom * pulse, 0, Math.PI * 2);

      if (completed) {
        ctx.fillStyle = world.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = world.color;
      } else {
        ctx.fillStyle = `${world.color}80`;
      }

      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw articles as small glowing points around world
      world.articles.forEach((article) => {
        const articleScreen = worldToScreen(article.spaceX, article.spaceY);

        ctx.beginPath();
        ctx.arc(articleScreen.x, articleScreen.y, 3 * camera.zoom, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff80';
        ctx.fill();
      });

      // World label
      if (camera.zoom > 0.8) {
        ctx.font = `${14 * camera.zoom}px Arial`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(world.name, screen.x, screen.y + 40 * camera.zoom);

        // Progress text
        ctx.font = `${11 * camera.zoom}px Arial`;
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(
          `${progress.read}/${progress.total}`,
          screen.x,
          screen.y + 56 * camera.zoom
        );
      }
    });

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(render);
  }, [dimensions, worldToScreen, getWorldProgress, isWorldCompleted, createParticle]);

  // Start render loop
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [render]);

  // Touch/Mouse controls
  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    touchStartRef.current = { x, y };
    lastTouchRef.current = { x, y };

    // Check if clicked on a world
    const worldPos = screenToWorld(x, y);
    const clickedWorld = WORLDS.find((world) => {
      const dx = world.spaceX - worldPos.x;
      const dy = world.spaceY - worldPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < 0.05 / cameraRef.current.zoom;
    });

    if (clickedWorld) {
      onWorldSelect(clickedWorld.id);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!lastTouchRef.current || !touchStartRef.current) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = (x - lastTouchRef.current.x) / dimensions.width;
    const dy = (y - lastTouchRef.current.y) / dimensions.height;

    cameraRef.current.targetX -= dx / cameraRef.current.zoom;
    cameraRef.current.targetY -= dy / cameraRef.current.zoom;

    lastTouchRef.current = { x, y };
  };

  const handlePointerUp = () => {
    touchStartRef.current = null;
    lastTouchRef.current = null;
  };

  return (
    <Container ref={containerRef}>
      <StyledCanvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <Instructions>
        {isMobile ? 'Tap worlds to explore • Drag to navigate' : 'Click worlds to explore • Drag to navigate'}
      </Instructions>
    </Container>
  );
};

const Container = styled.div`
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #000308;
`;

const StyledCanvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
`;

const Instructions = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  font-family: Arial, sans-serif;
  text-align: center;
  pointer-events: none;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);

  @media (max-width: 768px) {
    font-size: 12px;
    bottom: 10px;
  }
`;

export default SpaceNavigator;
