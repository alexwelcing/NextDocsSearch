/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THROW BALL — Draggable projectile with 3D arc trajectory
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A glass ball sitting in the bottom-left corner that:
 * 1. Can be grabbed (mouse or touch) and dragged
 * 2. Shows a trajectory arc while dragging (slingshot style)
 * 3. When released, flies along a 3D parabolic arc toward the tiles
 * 4. Reports impact position for glass-break collision detection
 * 5. Has a satisfying 3D scale/shadow effect during flight
 *
 * Props:
 *   onImpact(x, y) — called with viewport coordinates when ball hits
 *   disabled        — prevents interaction during active break animation
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ThrowBallProps {
  onImpact: (x: number, y: number, force: number) => void;
  disabled?: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

// ─── Physics constants ───────────────────────────────────────────────────

const BALL_SIZE = 56;
const BALL_REST_BOTTOM = 32;
const BALL_REST_LEFT = 32;
const FLIGHT_DURATION = 350; // ms — snappy flight for fast throws
const GRAVITY_ARC = 0.4; // arc height multiplier
const MIN_DRAG_DISTANCE = 30; // px minimum to register a throw

// ─── Component ───────────────────────────────────────────────────────────

export default function ThrowBall({ onImpact, disabled, containerRef }: ThrowBallProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [flyProgress, setFlyProgress] = useState(0);
  const [isRespawning, setIsRespawning] = useState(false);
  const ballRef = useRef<HTMLDivElement>(null);
  const flyAnimRef = useRef<number>(0);

  // Rest position (bottom-left corner of container)
  const getRestPos = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { x: BALL_REST_LEFT + BALL_SIZE / 2, y: window.innerHeight - BALL_REST_BOTTOM - BALL_SIZE / 2 };
    const rect = container.getBoundingClientRect();
    return {
      x: rect.left + BALL_REST_LEFT + BALL_SIZE / 2,
      y: rect.bottom - BALL_REST_BOTTOM - BALL_SIZE / 2,
    };
  }, [containerRef]);

  // ─── Drag handling (mouse + touch) ─────────────────────────────────

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (disabled || isFlying || isRespawning) return;
    setIsDragging(true);
    setDragStart({ x: clientX, y: clientY });
    setBallPos({ x: clientX, y: clientY });
  }, [disabled, isFlying, isRespawning]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    setBallPos({ x: clientX, y: clientY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging || !ballPos || !dragStart) {
      setIsDragging(false);
      return;
    }

    const rest = getRestPos();
    const dx = ballPos.x - rest.x;
    const dy = ballPos.y - rest.y;
    const dragDist = Math.sqrt(dx * dx + dy * dy);

    if (dragDist < MIN_DRAG_DISTANCE) {
      // Too short — snap back
      setIsDragging(false);
      setBallPos(null);
      setDragStart(null);
      return;
    }

    // Calculate throw target — slingshot: ball flies in the direction it was dragged
    // The further you drag, the further it goes
    const force = Math.min(dragDist / 200, 1.5);
    const targetX = rest.x + dx * 2.5;
    const targetY = rest.y + dy * 2.5;

    // Clamp target to container bounds
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    const clampedX = rect ? Math.max(rect.left, Math.min(rect.right, targetX)) : targetX;
    const clampedY = rect ? Math.max(rect.top, Math.min(rect.bottom, targetY)) : targetY;

    setIsDragging(false);
    setIsFlying(true);

    // Animate flight
    const startTime = performance.now();
    const startX = ballPos.x;
    const startY = ballPos.y;
    const midX = (startX + clampedX) / 2;
    const arcHeight = Math.abs(startY - clampedY) * GRAVITY_ARC + 80;

    const animateFlight = (now: number) => {
      const t = Math.min(1, (now - startTime) / FLIGHT_DURATION);
      // Ease-in for acceleration feel
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      // Parabolic arc — quadratic bezier
      const oneMinusT = 1 - eased;
      const px = oneMinusT * oneMinusT * startX + 2 * oneMinusT * eased * midX + eased * eased * clampedX;
      const controlY = Math.min(startY, clampedY) - arcHeight;
      const py = oneMinusT * oneMinusT * startY + 2 * oneMinusT * eased * controlY + eased * eased * clampedY;

      setBallPos({ x: px, y: py });
      setFlyProgress(eased);

      if (t < 1) {
        flyAnimRef.current = requestAnimationFrame(animateFlight);
      } else {
        // Impact!
        setIsFlying(false);
        setBallPos(null);
        setFlyProgress(0);
        onImpact(clampedX, clampedY, force);

        // Quick respawn for fast interactivity
        setIsRespawning(true);
        setTimeout(() => setIsRespawning(false), 250);
      }
    };

    flyAnimRef.current = requestAnimationFrame(animateFlight);
  }, [isDragging, ballPos, dragStart, getRestPos, onImpact, containerRef]);

  // Mouse events
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  // Touch events
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleDragStart]);

  // Global move/end listeners
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onMouseUp = () => handleDragEnd();
    const onTouchEnd = () => handleDragEnd();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flyAnimRef.current) cancelAnimationFrame(flyAnimRef.current);
    };
  }, []);

  // ─── Computed styles ───────────────────────────────────────────────

  const rest = getRestPos();
  const currentX = ballPos?.x ?? rest.x;
  const currentY = ballPos?.y ?? rest.y;

  // 3D scale effect during flight — ball gets "closer" at mid-arc then shrinks at impact
  const flyScale = isFlying
    ? 1 + Math.sin(flyProgress * Math.PI) * 0.6
    : isDragging ? 1.15 : 1;

  // Shadow grows during flight to sell the 3D effect
  const shadowBlur = isFlying
    ? 10 + Math.sin(flyProgress * Math.PI) * 30
    : isDragging ? 15 : 8;

  const shadowOpacity = isFlying
    ? 0.3 + Math.sin(flyProgress * Math.PI) * 0.3
    : isDragging ? 0.4 : 0.3;

  // ─── Trajectory line (while dragging) ──────────────────────────────

  const renderTrajectory = () => {
    if (!isDragging || !ballPos) return null;

    const dx = ballPos.x - rest.x;
    const dy = ballPos.y - rest.y;
    const targetX = rest.x + dx * 2.5;
    const targetY = rest.y + dy * 2.5;
    const arcHeight = Math.abs(ballPos.y - targetY) * GRAVITY_ARC + 80;

    // Generate arc points
    const points: { x: number; y: number }[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const oneMinusT = 1 - t;
      const midX = (ballPos.x + targetX) / 2;
      const controlY = Math.min(ballPos.y, targetY) - arcHeight;
      const px = oneMinusT * oneMinusT * ballPos.x + 2 * oneMinusT * t * midX + t * t * targetX;
      const py = oneMinusT * oneMinusT * ballPos.y + 2 * oneMinusT * t * controlY + t * t * targetY;
      points.push({ x: px, y: py });
    }

    return (
      <svg
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9998,
        }}
      >
        <defs>
          <linearGradient id="trajectoryGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(0, 212, 255, 0.6)" />
            <stop offset="100%" stopColor="rgba(0, 212, 255, 0)" />
          </linearGradient>
        </defs>
        <path
          d={`M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`}
          fill="none"
          stroke="url(#trajectoryGradient)"
          strokeWidth="2"
          strokeDasharray="6,4"
          opacity={0.7}
        />
        {/* Target crosshair */}
        <circle
          cx={targetX}
          cy={targetY}
          r={12}
          fill="none"
          stroke="rgba(0, 212, 255, 0.3)"
          strokeWidth="1.5"
        />
        <circle
          cx={targetX}
          cy={targetY}
          r={3}
          fill="rgba(0, 212, 255, 0.5)"
        />
      </svg>
    );
  };

  return (
    <>
      {renderTrajectory()}

      {/* The ball */}
      <div
        ref={ballRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{
          position: 'fixed',
          left: currentX - BALL_SIZE / 2,
          top: currentY - BALL_SIZE / 2,
          width: BALL_SIZE,
          height: BALL_SIZE,
          zIndex: 9999,
          cursor: disabled || isFlying || isRespawning ? 'default' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          // 3D transform
          transform: `scale(${flyScale})`,
          transition: isDragging || isFlying ? 'none' : 'transform 0.3s ease, opacity 0.4s ease',
          opacity: isRespawning ? 0 : 1,
          pointerEvents: isFlying ? 'none' : 'auto',
        }}
      >
        {/* Shadow (on the "ground plane") */}
        <div
          style={{
            position: 'absolute',
            bottom: -4,
            left: '50%',
            transform: 'translateX(-50%)',
            width: BALL_SIZE * 0.7,
            height: 6,
            borderRadius: '50%',
            background: `rgba(0, 0, 0, ${shadowOpacity})`,
            filter: `blur(${shadowBlur}px)`,
            transition: isDragging || isFlying ? 'none' : 'all 0.3s ease',
          }}
        />

        {/* Glass ball body */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: `
              radial-gradient(ellipse 35% 35% at 35% 30%, rgba(255,255,255,0.7) 0%, transparent 50%),
              radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0, 212, 255, 0.15) 0%, transparent 70%),
              radial-gradient(circle at 50% 50%, rgba(200, 230, 255, 0.25) 0%, rgba(100, 160, 220, 0.1) 50%, rgba(30, 60, 90, 0.3) 100%)
            `,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: `
              inset 0 -3px 8px rgba(0, 0, 0, 0.3),
              inset 0 2px 4px rgba(255, 255, 255, 0.2),
              0 0 ${shadowBlur}px rgba(0, 212, 255, 0.2)
            `,
          }}
        />

        {/* Specular highlight */}
        <div
          style={{
            position: 'absolute',
            top: '15%',
            left: '25%',
            width: '30%',
            height: '20%',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.6)',
            filter: 'blur(2px)',
            transform: 'rotate(-30deg)',
          }}
        />
      </div>

      {/* "Grab & throw" hint text — only shown briefly */}
      {!isDragging && !isFlying && !disabled && !isRespawning && (
        <div
          style={{
            position: 'fixed',
            left: BALL_REST_LEFT - 4,
            bottom: BALL_REST_BOTTOM + BALL_SIZE + 8,
            zIndex: 9999,
            color: 'rgba(0, 212, 255, 0.6)',
            fontSize: '11px',
            fontFamily: "'Inter', sans-serif",
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            animation: 'ballHintPulse 2s ease-in-out infinite',
            textAlign: 'left',
            whiteSpace: 'nowrap',
          }}
        >
          Grab & throw
        </div>
      )}

      <style jsx>{`
        @keyframes ballHintPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </>
  );
}
