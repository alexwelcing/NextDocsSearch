import React from 'react';

interface TerminalButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

/**
 * Reliable terminal button component with conditional visibility.
 * Visible when terminal is closed, hidden when terminal is open.
 * Completely independent from the 3D scene for reliable interaction.
 */
export default function TerminalButton({ onClick, isOpen }: TerminalButtonProps) {
  if (isOpen) return null; // Hide when terminal is open

  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 999999,
        padding: '18px 32px',
        fontSize: '18px',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        color: '#ffffff',
        background: 'linear-gradient(135deg, #0066ff 0%, #00ff88 100%)',
        border: '3px solid rgba(255, 255, 255, 0.3)',
        borderRadius: '12px',
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0, 102, 255, 0.5), inset 0 2px 8px rgba(255, 255, 255, 0.2)',
        transition: 'all 0.3s ease',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05) translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 12px 48px rgba(0, 255, 136, 0.6), inset 0 2px 8px rgba(255, 255, 255, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1) translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 102, 255, 0.5), inset 0 2px 8px rgba(255, 255, 255, 0.2)';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.98) translateY(0)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1.05) translateY(-3px)';
      }}
    >
      ▶ OPEN TERMINAL
    </button>
  );
}
