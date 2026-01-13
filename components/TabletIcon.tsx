import React from 'react';

interface TabletIconProps {
  size?: number;
  color?: string;
  glowColor?: string;
  animated?: boolean;
}

// A cool animated portal/gateway icon for the tablet menu button
export default function TabletIcon({
  size = 24,
  color = '#0f0',
  glowColor = 'rgba(0, 255, 0, 0.5)',
  animated = true,
}: TabletIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Glow filter */}
        <filter id="portalGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradient for the portal ring */}
        <linearGradient id="portalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>

        {/* Inner glow gradient */}
        <radialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Outer rotating ring */}
      <g filter="url(#portalGlow)">
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="url(#portalGradient)"
          strokeWidth="2"
          strokeDasharray="8 4"
          style={animated ? {
            animation: 'portalSpin 8s linear infinite',
          } : {}}
        />
      </g>

      {/* Middle ring */}
      <circle
        cx="24"
        cy="24"
        r="14"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.6"
        style={animated ? {
          animation: 'portalSpinReverse 6s linear infinite',
        } : {}}
      />

      {/* Inner glow */}
      <circle cx="24" cy="24" r="12" fill="url(#innerGlow)" />

      {/* Central diamond/portal symbol */}
      <g style={animated ? {
        animation: 'portalPulse 2s ease-in-out infinite',
        transformOrigin: '24px 24px',
      } : {}}>
        {/* Diamond shape */}
        <path
          d="M24 12 L32 24 L24 36 L16 24 Z"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Inner star */}
        <path
          d="M24 18 L26 24 L24 30 L22 24 Z"
          fill={color}
          fillOpacity="0.8"
        />

        {/* Horizontal line */}
        <line
          x1="18"
          y1="24"
          x2="30"
          y2="24"
          stroke={color}
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
      </g>

      {/* Orbital dots */}
      {animated && (
        <>
          <circle
            cx="24"
            cy="4"
            r="2"
            fill={color}
            style={{
              animation: 'orbitalDot 4s linear infinite',
              transformOrigin: '24px 24px',
            }}
          />
          <circle
            cx="24"
            cy="4"
            r="1.5"
            fill="#8b5cf6"
            style={{
              animation: 'orbitalDot 4s linear infinite',
              animationDelay: '-2s',
              transformOrigin: '24px 24px',
            }}
          />
        </>
      )}

      {/* Inline styles for animations */}
      <style>{`
        @keyframes portalSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes portalSpinReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes portalPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }

        @keyframes orbitalDot {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}

// Alternative simpler icon - a stylized command/portal symbol
export function TabletIconSimple({
  size = 20,
  color = '#0f0',
}: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Hexagon outline */}
      <path
        d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Inner triangle pointing up */}
      <path
        d="M12 7L16 14H8L12 7Z"
        fill={color}
        fillOpacity="0.7"
      />

      {/* Center dot */}
      <circle cx="12" cy="13" r="1.5" fill={color} />
    </svg>
  );
}

// Cosmic variant for when power is unlocked
export function TabletIconCosmic({
  size = 24,
}: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="cosmicGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
        <filter id="cosmicGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer rotating ring */}
      <circle
        cx="24"
        cy="24"
        r="20"
        fill="none"
        stroke="url(#cosmicGrad)"
        strokeWidth="2"
        strokeDasharray="6 3"
        filter="url(#cosmicGlow)"
        style={{
          animation: 'cosmicSpin 4s linear infinite',
        }}
      />

      {/* Star burst */}
      <g filter="url(#cosmicGlow)" style={{
        animation: 'cosmicPulse 1.5s ease-in-out infinite',
        transformOrigin: '24px 24px',
      }}>
        <path
          d="M24 8L26 20L38 18L28 24L38 30L26 28L24 40L22 28L10 30L20 24L10 18L22 20L24 8Z"
          fill="url(#cosmicGrad)"
        />
      </g>

      <style>{`
        @keyframes cosmicSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes cosmicPulse {
          0%, 100% { transform: scale(0.9); opacity: 0.9; }
          50% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </svg>
  );
}
