import React, { useState, useEffect } from 'react';
import { useJourney } from './JourneyContext';

export default function QuestNotification() {
  const { currentQuest, progress } = useJourney();
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Show notification when there's an active quest
    if (currentQuest) {
      setIsVisible(true);
      // Auto-collapse after 5 seconds
      const timer = setTimeout(() => setIsExpanded(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [currentQuest]);

  if (!isVisible || !currentQuest) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 900,
        maxWidth: '350px',
      }}
    >
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95), rgba(68, 136, 255, 0.2))',
          border: '2px solid rgba(68, 136, 255, 0.5)',
          borderRadius: '16px',
          padding: isExpanded ? '20px' : '16px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 8px 32px rgba(68, 136, 255, 0.3)',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          animation: 'slideInRight 0.5s ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(68, 136, 255, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(68, 136, 255, 0.3)';
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isExpanded ? '12px' : '0',
        }}>
          <div style={{
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#00ff88',
            fontWeight: 'bold',
            fontFamily: 'monospace',
          }}>
            🎯 Active Quest
          </div>
          <div style={{
            fontSize: '10px',
            color: '#888',
            fontFamily: 'monospace',
          }}>
            Phase {currentQuest.phase}/5
          </div>
        </div>

        {/* Quest Title */}
        <div style={{
          fontSize: isExpanded ? '18px' : '16px',
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: isExpanded ? '8px' : '4px',
          fontFamily: "'Cinzel', serif",
          textShadow: '0 0 10px rgba(0, 255, 136, 0.3)',
        }}>
          {currentQuest.title}
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <>
            <div style={{
              fontSize: '13px',
              color: '#aaa',
              marginBottom: '12px',
              fontFamily: 'monospace',
              fontStyle: 'italic',
              lineHeight: '1.5',
            }}>
              {currentQuest.description}
            </div>

            <div style={{
              background: 'rgba(0, 255, 136, 0.1)',
              border: '1px solid rgba(0, 255, 136, 0.3)',
              borderRadius: '8px',
              padding: '12px',
            }}>
              <div style={{
                fontSize: '11px',
                color: '#00ff88',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: 'bold',
                fontFamily: 'monospace',
              }}>
                Objective:
              </div>
              <div style={{
                fontSize: '14px',
                color: '#ffffff',
                fontFamily: 'monospace',
              }}>
                {currentQuest.objective}
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{
              marginTop: '12px',
              fontSize: '10px',
              color: '#888',
              fontFamily: 'monospace',
            }}>
              Journey Progress: {progress.completedQuests.length}/{QUESTS.length} quests
              <div style={{
                width: '100%',
                height: '4px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                marginTop: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${(progress.completedQuests.length / QUESTS.length) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #4488ff, #00ff88)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          </>
        )}

        {/* Collapse Hint */}
        {!isExpanded && (
          <div style={{
            fontSize: '11px',
            color: '#666',
            marginTop: '8px',
            fontFamily: 'monospace',
          }}>
            Click to expand
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// Import QUESTS for progress calculation
import { QUESTS } from '../lib/journey/types';
