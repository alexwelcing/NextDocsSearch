import React, { useState, useEffect } from 'react';
import { Achievement } from '../lib/journey/types';

interface AchievementUnlockProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export default function AchievementUnlock({ achievement, onDismiss }: AchievementUnlockProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setIsVisible(true);
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onDismiss, 500); // Wait for fade out
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss]);

  if (!achievement) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2001,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(5px)',
        }}
        onClick={() => {
          setIsVisible(false);
          setTimeout(onDismiss, 500);
        }}
      />

      {/* Achievement Card */}
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #2d2d44 100%)',
          border: '3px solid #FFD700',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '400px',
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(255, 215, 0, 0.5), 0 0 120px rgba(255, 215, 0, 0.3)',
          animation: 'achievementPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        }}
      >
        {/* Achievement Icon */}
        <div style={{
          fontSize: '80px',
          marginBottom: '20px',
          animation: 'iconBounce 1s ease-in-out infinite',
        }}>
          {achievement.icon}
        </div>

        {/* Achievement Unlocked Text */}
        <div style={{
          fontSize: '14px',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          color: '#FFD700',
          fontWeight: 'bold',
          marginBottom: '12px',
          fontFamily: 'monospace',
          textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
        }}>
          ✨ Achievement Unlocked ✨
        </div>

        {/* Achievement Title */}
        <div style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: '12px',
          fontFamily: "'Cinzel', serif",
          textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
        }}>
          {achievement.title}
        </div>

        {/* Achievement Description */}
        <div style={{
          fontSize: '16px',
          color: '#aaa',
          fontFamily: 'monospace',
          fontStyle: 'italic',
          lineHeight: '1.5',
        }}>
          {achievement.description}
        </div>

        {/* Dismiss Hint */}
        <div style={{
          marginTop: '30px',
          fontSize: '12px',
          color: '#666',
          fontFamily: 'monospace',
        }}>
          Click anywhere to continue
        </div>

        {/* Particle Effects */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          borderRadius: '24px',
        }}>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '4px',
                height: '4px',
                background: '#FFD700',
                borderRadius: '50%',
                animation: `particle${i % 4} 2s ease-out infinite`,
                animationDelay: `${i * 0.1}s`,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes achievementPop {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes iconBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes particle0 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(0, -50px);
            opacity: 0;
          }
        }

        @keyframes particle1 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(30px, -30px);
            opacity: 0;
          }
        }

        @keyframes particle2 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(-30px, -30px);
            opacity: 0;
          }
        }

        @keyframes particle3 {
          0% {
            transform: translate(0, 0);
            opacity: 1;
          }
          100% {
            transform: translate(0, 50px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
