/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HAMMER TOOL — pick-up-and-click-to-break glass-break tool
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Alternate to the throw ball. The user clicks the hammer to "pick it up",
 * at which point:
 *   1. The cursor turns into a crosshair + a hammer icon follows the pointer
 *   2. Any click (on the document) fires onStrike(viewportX, viewportY)
 *      — the parent (HeroMosaic) decides which tile to instant-shatter.
 *   3. Clicking the hammer again, pressing Escape, or after any strike,
 *      the tool returns to its rest position.
 *
 * SSR-safe: the moving indicator and document listeners only run on the
 * client via useEffect.
 */

import React, { useEffect, useRef, useState } from 'react';

interface HammerToolProps {
  /** Called once per strike while active. Coordinates are in viewport pixels. */
  onStrike: (viewportX: number, viewportY: number) => void;
}

const REST_RIGHT = 32;
const REST_BOTTOM = 40;
const HAMMER_SIZE = 64;

export default function HammerTool({ onStrike }: HammerToolProps) {
  const [active, setActive] = useState(false);
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const [swingKey, setSwingKey] = useState(0);
  const onStrikeRef = useRef(onStrike);
  onStrikeRef.current = onStrike;

  // Follow the pointer while active.
  useEffect(() => {
    if (!active) {
      setPtr(null);
      return;
    }
    const handleMove = (e: PointerEvent) => setPtr({ x: e.clientX, y: e.clientY });
    const handleTouch = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        setPtr({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('touchmove', handleTouch);
    };
  }, [active]);

  // Strike on any click while active; Escape cancels.
  useEffect(() => {
    if (!active) return;

    const handleClick = (e: MouseEvent) => {
      // Ignore clicks on the toggle button itself (handled separately).
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-hammer-toggle="true"]')) return;
      e.preventDefault();
      setSwingKey(k => k + 1);
      onStrikeRef.current(e.clientX, e.clientY);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(false);
    };

    window.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('keydown', handleKey);

    // Make the document cursor a crosshair site-wide while the tool is on.
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    return () => {
      window.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('keydown', handleKey);
      document.body.style.cursor = prevCursor;
    };
  }, [active]);

  return (
    <>
      {/* Toggle button (rest position, bottom-right of hero container) */}
      <button
        type="button"
        data-hammer-toggle="true"
        aria-pressed={active}
        aria-label={active ? 'Put hammer down' : 'Pick up hammer'}
        onClick={(e) => {
          e.stopPropagation();
          setActive(v => !v);
        }}
        style={{
          position: 'absolute',
          right: REST_RIGHT,
          bottom: REST_BOTTOM,
          width: HAMMER_SIZE,
          height: HAMMER_SIZE,
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          borderRadius: '50%',
          border: active ? '2px solid rgba(255, 215, 0, 0.95)' : '2px solid rgba(255, 215, 0, 0.6)',
          background: active
            ? 'radial-gradient(circle at 50% 40%, rgba(255, 215, 0, 0.35), rgba(160, 100, 30, 0.5))'
            : 'radial-gradient(circle at 50% 40%, rgba(255, 215, 0, 0.18), rgba(60, 40, 10, 0.7))',
          cursor: 'pointer',
          boxShadow: active
            ? '0 0 18px rgba(255, 215, 0, 0.7), 0 0 42px rgba(255, 215, 0, 0.35)'
            : '0 0 12px rgba(255, 215, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.5)',
          animation: active ? 'none' : 'hammerIdlePulse 2.6s ease-in-out infinite',
          transition: 'background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        }}
      >
        <HammerIcon size={36} glow={active} />
      </button>

      {/* Rest-state hint label */}
      {!active && (
        <div
          style={{
            position: 'absolute',
            right: REST_RIGHT - 4,
            bottom: REST_BOTTOM + HAMMER_SIZE + 8,
            zIndex: 9998,
            color: 'rgba(255, 215, 0, 0.95)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            textShadow: '0 0 8px rgba(255, 215, 0, 0.55)',
            fontFamily: "'Inter', sans-serif",
            animation: 'hammerHintPulse 2.4s ease-in-out infinite',
          }}
        >
          Pick up hammer
        </div>
      )}

      {/* Active-state pointer-tracking hammer */}
      {active && ptr && (
        <div
          key={`swing-${swingKey}`}
          style={{
            position: 'fixed',
            left: ptr.x - HAMMER_SIZE / 2,
            top: ptr.y - HAMMER_SIZE / 2 - 6,
            width: HAMMER_SIZE,
            height: HAMMER_SIZE,
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'hammerSwing 0.35s ease-out',
            filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))',
            transformOrigin: '30% 70%',
          }}
        >
          <HammerIcon size={HAMMER_SIZE} glow />
        </div>
      )}

      {/* Active-state banner across the top of the hero */}
      {active && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9998,
            padding: '8px 14px',
            borderRadius: 6,
            background: 'rgba(40, 24, 4, 0.85)',
            border: '1px solid rgba(255, 215, 0, 0.55)',
            color: 'rgba(255, 215, 0, 0.95)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textShadow: '0 0 8px rgba(255, 215, 0, 0.45)',
            pointerEvents: 'none',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Click a pane to break it — esc to drop
        </div>
      )}

      <style jsx>{`
        @keyframes hammerIdlePulse {
          0%, 100% { transform: rotate(-8deg) scale(1); }
          50%      { transform: rotate(-4deg) scale(1.06); }
        }
        @keyframes hammerHintPulse {
          0%, 100% { opacity: 0.95; }
          50%      { opacity: 0.55; }
        }
        @keyframes hammerSwing {
          0%   { transform: rotate(-60deg) translate(-4px, -6px); }
          45%  { transform: rotate(5deg)   translate(0px, 1px); }
          60%  { transform: rotate(-10deg) translate(-1px, 0px); }
          100% { transform: rotate(0deg)   translate(0px, 0px); }
        }
      `}</style>
    </>
  );
}

// ─── Inline SVG hammer icon ─────────────────────────────────────────────

function HammerIcon({ size, glow }: { size: number; glow: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hammerHead" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe680" />
          <stop offset="45%" stopColor="#d4a018" />
          <stop offset="100%" stopColor="#7a5308" />
        </linearGradient>
        <linearGradient id="hammerHandle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6a4a18" />
          <stop offset="50%" stopColor="#b07a2c" />
          <stop offset="100%" stopColor="#6a4a18" />
        </linearGradient>
      </defs>
      {/* Handle — diagonal from bottom-left to upper-right */}
      <rect
        x="10"
        y="36"
        width="36"
        height="8"
        rx="2"
        transform="rotate(-35 28 40)"
        fill="url(#hammerHandle)"
        stroke="rgba(20, 12, 2, 0.9)"
        strokeWidth="1"
      />
      {/* Head */}
      <g transform="rotate(-35 44 20)">
        <rect
          x="32"
          y="10"
          width="26"
          height="18"
          rx="2"
          fill="url(#hammerHead)"
          stroke="rgba(20, 12, 2, 0.9)"
          strokeWidth="1.5"
        />
        <rect x="34" y="12" width="3" height="14" fill="rgba(255, 255, 255, 0.35)" />
      </g>
      {glow && (
        <circle
          cx="46"
          cy="16"
          r="7"
          fill="rgba(255, 230, 140, 0.5)"
          style={{ filter: 'blur(4px)' }}
        />
      )}
    </svg>
  );
}
