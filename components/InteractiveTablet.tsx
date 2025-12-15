import React, { useState, useCallback, useEffect } from 'react';
import TerminalInterface from './TerminalInterface';

interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
}

interface SceneryOption {
  id: string;
  name: string;
  type: 'image' | 'splat';
  path: string;
}

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  articles?: ArticleData[];
  onStartGame?: () => void;
  cinematicRevealProgress?: number;
  onChangeScenery?: (scenery: SceneryOption) => void;
  availableScenery?: SceneryOption[];
  currentScenery?: string;
}

export default function InteractiveTablet({
  isGamePlaying = false,
  articles = [],
  onStartGame,
  onChangeScenery,
  availableScenery = [],
  currentScenery,
}: InteractiveTabletProps) {
  const [isRaised, setIsRaised] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Toggle tablet with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (!isGamePlaying) {
          setIsRaised(prev => !prev);
        }
      }
      if (e.key === 'Escape' && isRaised) {
        setIsRaised(false);
        setTerminalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGamePlaying, isRaised]);

  const handleRaise = useCallback(() => {
    if (!isGamePlaying) {
      setIsRaised(true);
    }
  }, [isGamePlaying]);

  const handleLower = useCallback(() => {
    setIsRaised(false);
    setTerminalOpen(false);
  }, []);

  const handleOpenTerminal = useCallback(() => {
    setTerminalOpen(true);
  }, []);

  // Hide during gameplay
  if (isGamePlaying) return null;

  return (
    <>
      {/* Pip-Boy raise button - bottom center */}
      {!isRaised && (
        <div
          onClick={handleRaise}
          style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            cursor: 'pointer',
            padding: '12px 24px',
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid #333',
            borderRadius: '4px',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: '12px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#0f0';
            e.currentTarget.style.background = 'rgba(0, 20, 0, 0.9)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#333';
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
          }}
        >
          <span style={{ fontSize: '16px' }}>▲</span>
          <span>TERMINAL</span>
          <span style={{ color: '#555', fontSize: '10px' }}>[TAB]</span>
        </div>
      )}

      {/* Pip-Boy tablet - slides up from bottom */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: `translateX(-50%) translateY(${isRaised ? '0' : '100%'})`,
          zIndex: 500,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          width: 'min(95vw, 500px)',
        }}
      >
        {/* Tablet frame */}
        <div
          style={{
            background: '#0a0a0a',
            border: '2px solid #222',
            borderBottom: 'none',
            borderRadius: '12px 12px 0 0',
            overflow: 'hidden',
            boxShadow: '0 -10px 40px rgba(0, 255, 0, 0.1)',
          }}
        >
          {/* Handle bar */}
          <div
            onClick={handleLower}
            style={{
              padding: '8px',
              background: '#111',
              borderBottom: '1px solid #222',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{
              width: '40px',
              height: '4px',
              background: '#333',
              borderRadius: '2px',
            }} />
            <span style={{
              color: '#444',
              fontSize: '10px',
              fontFamily: 'monospace',
            }}>
              [ESC] to close
            </span>
          </div>

          {/* Screen content */}
          <div
            onClick={handleOpenTerminal}
            style={{
              padding: '24px',
              cursor: 'pointer',
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
            }}
          >
            <div style={{
              color: '#0f0',
              fontSize: '36px',
              fontFamily: 'monospace',
            }}>
              {'>_'}
            </div>
            <div style={{
              color: '#0f0',
              fontSize: '16px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
              letterSpacing: '3px',
            }}>
              TERMINAL
            </div>
            <div style={{
              color: '#555',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}>
              click to open
            </div>

            {/* Quick actions */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '16px',
            }}>
              {[
                { label: 'CHAT', action: handleOpenTerminal },
                { label: 'GAME', action: () => { onStartGame?.(); handleLower(); } },
                { label: 'SCENE', action: handleOpenTerminal },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={(e) => { e.stopPropagation(); item.action(); }}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    color: '#666',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0f0';
                    e.currentTarget.style.color = '#0f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.color = '#666';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full terminal interface */}
      <TerminalInterface
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        articles={articles}
        onStartGame={() => { onStartGame?.(); handleLower(); setTerminalOpen(false); }}
        onChangeScenery={onChangeScenery}
        availableScenery={availableScenery}
        currentScenery={currentScenery}
      />
    </>
  );
}
