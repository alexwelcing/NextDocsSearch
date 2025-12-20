import React, { useEffect, useState } from 'react';

interface CinematicIntroProps {
  onComplete: () => void;
  onSkip: () => void;
  onProgressUpdate?: (progress: number) => void;
  onStart?: () => void;
  durationScale?: number;
}

export default function CinematicIntro({
  onComplete,
  onSkip,
  onProgressUpdate,
  onStart,
  durationScale = 1,
}: CinematicIntroProps) {
  const [phase, setPhase] = useState<'black' | 'waking' | 'opening' | 'awareness' | 'discovery' | 'complete'>('black');
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [textOpacity, setTextOpacity] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    onStart?.();
    setPhase('waking');
    setProgress(0.05);
    onProgressUpdate?.(0.05);

    const scale = Math.max(durationScale, 0.1);

    // Phase 1: Black screen (eyes closed) - 0.6s
    const timer1 = setTimeout(() => {
      setProgress(0.1);
      onProgressUpdate?.(0.1);
    }, 600 * scale);

    // Phase 2: First signs of waking - 1.4s
    const timer2 = setTimeout(() => {
      setFadeOpacity(0.8);
      setProgress(0.2);
      onProgressUpdate?.(0.2);
    }, 1400 * scale);

    // Phase 3: Eyes starting to open - 2.6s
    const timer3 = setTimeout(() => {
      setPhase('opening');
      setFadeOpacity(0.5);
      setProgress(0.4);
      onProgressUpdate?.(0.4);
    }, 2600 * scale);

    // Phase 4: Eyes opening more - 4.2s
    const timer4 = setTimeout(() => {
      setFadeOpacity(0.2);
      setTextOpacity(1);
      setProgress(0.6);
      onProgressUpdate?.(0.6);
    }, 4200 * scale);

    // Phase 5: Full awareness - 6.2s
    const timer5 = setTimeout(() => {
      setPhase('awareness');
      setFadeOpacity(0);
      setProgress(0.75);
      onProgressUpdate?.(0.75);
    }, 6200 * scale);

    // Phase 6: Narrative begins - 7.4s
    const timer6 = setTimeout(() => {
      setTextOpacity(1);
      setProgress(0.85);
      onProgressUpdate?.(0.85);
    }, 7400 * scale);

    // Phase 7: Discovery moment - 9.8s
    const timer7 = setTimeout(() => {
      setPhase('discovery');
      setProgress(0.95);
      onProgressUpdate?.(0.95);
    }, 9800 * scale);

    // Phase 8: Complete - 12s
    const timer8 = setTimeout(() => {
      setPhase('complete');
      setTextOpacity(0);
      setProgress(1);
      onProgressUpdate?.(1);
    }, 12000 * scale);

    // Phase 9: Transition to game - 13.2s
    const timer9 = setTimeout(() => {
      onComplete();
    }, 13200 * scale);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
      clearTimeout(timer6);
      clearTimeout(timer7);
      clearTimeout(timer8);
      clearTimeout(timer9);
    };
  }, [durationScale, onComplete, onProgressUpdate, onStart]);

  const getNarrativeText = () => {
    switch (phase) {
      case 'black':
      case 'waking':
        return '';
      case 'opening':
        return 'You open your eyes...';
      case 'awareness':
        return 'A vast digital world stretches before you.';
      case 'discovery':
        return 'In the distance, something glows with purpose.\n\nA terminal. Your gateway to knowledge.';
      case 'complete':
        return '';
      default:
        return '';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        pointerEvents: phase === 'complete' ? 'none' : 'auto',
      }}
    >
      {/* Black overlay (eyelids) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#000000',
          opacity: fadeOpacity,
          transition: 'opacity 2s ease-out',
        }}
      />

      {/* Vignette effect */}
      {phase !== 'black' && phase !== 'complete' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle, transparent 20%, rgba(0,0,0,0.8) 100%)',
            opacity: phase === 'awareness' ? 0 : 0.7,
            transition: 'opacity 2s ease-out',
          }}
        />
      )}

      {/* Narrative text */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          width: '80%',
          maxWidth: '800px',
          opacity: textOpacity,
          transition: 'opacity 1.5s ease-in-out',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: "'Cinzel', 'Georgia', serif",
            fontSize: 'clamp(20px, 4vw, 36px)',
            color: '#ffffff',
            textShadow: '0 0 20px rgba(68, 136, 255, 0.8), 0 0 40px rgba(68, 136, 255, 0.4)',
            lineHeight: '1.8',
            whiteSpace: 'pre-line',
            letterSpacing: '0.05em',
          }}
        >
          {getNarrativeText()}
        </div>
      </div>

      {/* Skip button */}
      {phase !== 'complete' && (
        <button
          onClick={onSkip}
          style={{
            position: 'absolute',
            bottom: '40px',
            right: '40px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            padding: '12px 24px',
            color: '#ffffff',
            fontSize: '14px',
            fontFamily: 'monospace',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
          }}
        >
          Skip Intro →
        </button>
      )}

      {/* Breathing effect overlay for "waking" phase */}
      {phase === 'waking' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.9) 70%)',
            animation: 'breathe 3s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap');

        @keyframes breathe {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
        }

        @keyframes fadeInText {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
