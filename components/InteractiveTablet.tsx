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

type TerminalView = 'chat' | 'game' | 'scenery' | 'about' | 'blog' | 'audio';

interface InteractiveTabletProps {
  initialPosition?: [number, number, number];
  isGamePlaying?: boolean;
  articles?: ArticleData[];
  onStartGame?: () => void;
  cinematicRevealProgress?: number;
  onChangeScenery?: (scenery: SceneryOption) => void;
  onRotateScenery?: (direction: 'next' | 'prev') => void;
  availableScenery?: SceneryOption[];
  currentScenery?: string;
  audioEnabled?: boolean;
  audioStatus?: 'playing' | 'paused' | 'blocked';
  audioVolume?: number;
  onToggleAudio?: () => void;
  onVolumeChange?: (value: number) => void;
}

export default function InteractiveTablet({
  isGamePlaying = false,
  articles = [],
  onStartGame,
  onChangeScenery,
  onRotateScenery,
  availableScenery = [],
  currentScenery,
  audioEnabled,
  audioStatus,
  audioVolume,
  onToggleAudio,
  onVolumeChange,
}: InteractiveTabletProps) {
  const [isRaised, setIsRaised] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalView, setTerminalView] = useState<TerminalView>('chat');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const handleOpenTerminal = useCallback((view: TerminalView = 'chat') => {
    setTerminalView(view);
    setTerminalOpen(true);
  }, []);

  if (isGamePlaying) return null;

  return (
    <>
      {/* Pip-Boy raise button */}
      {!isRaised && (
        <button
          onClick={handleRaise}
          style={{
            position: 'fixed',
            bottom: isMobile ? '16px' : '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            padding: isMobile ? '14px 28px' : '12px 24px',
            background: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid #0f0',
            borderRadius: '6px',
            color: '#0f0',
            fontFamily: 'monospace',
            fontSize: isMobile ? '14px' : '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 20px rgba(0, 255, 0, 0.2)',
            touchAction: 'manipulation',
          }}
        >
          <span>▲</span>
          <span>MENU</span>
          {!isMobile && <span style={{ color: '#555', fontSize: '10px' }}>[TAB]</span>}
        </button>
      )}

      {/* Pip-Boy tablet */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: `translateX(-50%) translateY(${isRaised ? '0' : '100%'})`,
          zIndex: 500,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          width: isMobile ? '100vw' : 'min(95vw, 420px)',
          maxHeight: isMobile ? '70vh' : '60vh',
        }}
      >
        <div
          style={{
            background: '#0a0a0a',
            border: isMobile ? 'none' : '2px solid #1a1a1a',
            borderBottom: 'none',
            borderRadius: isMobile ? '16px 16px 0 0' : '12px 12px 0 0',
            overflow: 'hidden',
            boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
          }}
        >
          {/* Handle bar */}
          <div
            onClick={handleLower}
            style={{
              padding: isMobile ? '12px' : '8px',
              background: '#111',
              borderBottom: '1px solid #222',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              touchAction: 'manipulation',
            }}
          >
            <div style={{
              width: '48px',
              height: '4px',
              background: '#333',
              borderRadius: '2px',
            }} />
          </div>

          {/* Quick menu */}
          <div style={{
            padding: isMobile ? '20px 16px' : '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            {/* Main actions */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: '10px',
            }}>
              {[
                { label: 'ASK AI', icon: '>', action: () => handleOpenTerminal('chat') },
                { label: 'BLOG', icon: '≡', action: () => handleOpenTerminal('blog') },
                { label: 'GAME', icon: '#', action: () => { onStartGame?.(); handleLower(); } },
                { label: 'SCENE', icon: '*', action: () => handleOpenTerminal('scenery') },
                { label: 'AUDIO', icon: '♪', action: () => handleOpenTerminal('audio') },
                { label: 'ABOUT', icon: '?', action: () => handleOpenTerminal('about') },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    padding: isMobile ? '16px' : '14px',
                    background: '#111',
                    border: '1px solid #222',
                    borderRadius: '8px',
                    color: '#0f0',
                    fontFamily: 'monospace',
                    fontSize: isMobile ? '13px' : '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    touchAction: 'manipulation',
                  }}
                >
                  <span style={{ color: '#0a0' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Navigation links */}
            <div style={{
              borderTop: '1px solid #222',
              paddingTop: '12px',
              display: 'flex',
              justifyContent: 'center',
              gap: isMobile ? '20px' : '16px',
              flexWrap: 'wrap',
            }}>
              {[
                { label: 'Home', href: '/' },
                { label: 'Articles', href: '/articles' },
                { label: 'GitHub', href: 'https://github.com/alexwelcing', external: true },
                { label: 'LinkedIn', href: 'https://linkedin.com/in/alexwelcing', external: true },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.external ? '_blank' : undefined}
                  rel={link.external ? 'noopener noreferrer' : undefined}
                  style={{
                    color: '#555',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    textDecoration: 'none',
                    padding: '4px 8px',
                  }}
                >
                  {link.label}
                  {link.external && ' ↗'}
                </a>
              ))}
            </div>

            {/* Close hint */}
            <div style={{
              textAlign: 'center',
              color: '#333',
              fontSize: '10px',
              fontFamily: 'monospace',
            }}>
              {isMobile ? 'tap handle to close' : 'ESC or tap handle to close'}
            </div>
          </div>
        </div>
      </div>

      {/* Full terminal */}
      <TerminalInterface
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        activeView={terminalView}
        articles={articles}
        onStartGame={() => { onStartGame?.(); handleLower(); setTerminalOpen(false); }}
        onChangeScenery={onChangeScenery}
        onRotateScenery={onRotateScenery}
        availableScenery={availableScenery}
        currentScenery={currentScenery}
        audioEnabled={audioEnabled}
        audioStatus={audioStatus}
        audioVolume={audioVolume}
        onToggleAudio={onToggleAudio}
        onVolumeChange={onVolumeChange}
      />
    </>
  );
}
