import React from 'react';

interface TerminalAccessButtonProps {
  onClick: () => void;
  isGamePlaying?: boolean;
}

/**
 * Fallback 2D button to access the terminal when the 3D tablet isn't clickable
 */
export default function TerminalAccessButton({ onClick, isGamePlaying = false }: TerminalAccessButtonProps) {
  if (isGamePlaying) return null;

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '120px',
        right: '20px',
        zIndex: 999,
        background: 'linear-gradient(135deg, #4488ff, #00ff88)',
        border: '3px solid #00ff88',
        borderRadius: '16px',
        padding: '16px 24px',
        color: '#ffffff',
        fontSize: '18px',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        cursor: 'pointer',
        boxShadow: '0 8px 30px rgba(68, 136, 255, 0.6), 0 0 60px rgba(0, 255, 136, 0.3)',
        textShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
        transition: 'all 0.3s ease',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1) translateY(-5px)';
        e.currentTarget.style.boxShadow = '0 12px 40px rgba(68, 136, 255, 0.8), 0 0 80px rgba(0, 255, 136, 0.5)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1) translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(68, 136, 255, 0.6), 0 0 60px rgba(0, 255, 136, 0.3)';
      }}
    >
      ▶ OPEN TERMINAL
    </button>
  );
}
