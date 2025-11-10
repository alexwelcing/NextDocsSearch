/**
 * Trophy UI - Display trophies and achievements
 *
 * Shows:
 * - Trophy collection panel
 * - Trophy unlock animations
 * - Progress towards trophies
 */

import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { useTrophy } from './TrophyContext';
import { WORLDS } from '../config/worlds';

export const TrophyUI: React.FC = () => {
  const { progress, getWorldProgress } = useTrophy();
  const [showPanel, setShowPanel] = useState(false);
  const [notification, setNotification] = useState<{ title: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Listen for trophy unlock events
  useEffect(() => {
    const handleTrophyUnlock = (event: CustomEvent) => {
      setNotification(event.detail);

      // Clear notification after 5 seconds
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    };

    window.addEventListener('trophy-unlocked', handleTrophyUnlock as EventListener);
    return () => {
      window.removeEventListener('trophy-unlocked', handleTrophyUnlock as EventListener);
    };
  }, []);

  interface Trophy {
    id: string;
    name: string;
    description: string;
    icon: string;
    unlocked: boolean;
    progress: number;
    progressLabel: string;
  }

  let trophies: Trophy[] = [];
  try {
    const worldProgresses = WORLDS.map(w => getWorldProgress(w.id).percentage);
    const maxProgress = worldProgresses.length > 0 ? Math.max(...worldProgresses) : 0;

    trophies = [
      {
        id: 'worldMaster',
        name: 'World Master',
        description: 'Complete any world by reading all its articles',
        icon: '🌟',
        unlocked: progress.trophies.worldMaster,
        progress: maxProgress,
        progressLabel: progress.worldsCompleted.length > 0
          ? `${progress.worldsCompleted.length} world(s) completed`
          : `Best: ${maxProgress.toFixed(0)}%`,
      },
      {
        id: 'universeExplorer',
        name: 'Universe Explorer',
        description: 'Complete all worlds in the universe',
        icon: '🌌',
        unlocked: progress.trophies.universeExplorer,
        progress: (progress.worldsCompleted.length / WORLDS.length) * 100,
        progressLabel: `${progress.worldsCompleted.length}/${WORLDS.length} worlds`,
      },
      {
        id: 'highScorer',
        name: 'High Scorer',
        description: 'Reach 10,000 points',
        icon: '🏆',
        unlocked: progress.trophies.highScorer,
        progress: Math.min((progress.highScore / 10000) * 100, 100),
        progressLabel: `${progress.highScore.toLocaleString()} / 10,000`,
      },
    ];
  } catch (err) {
    console.error('Trophy calculation error:', err);
    setError('Error loading trophies');
  }

  return (
    <>
      {/* Trophy Button */}
      <TrophyButton onClick={() => setShowPanel(!showPanel)}>
        <TrophyIcon>🏆</TrophyIcon>
        <TrophyCount>
          {Object.values(progress.trophies).filter(Boolean).length}/3
        </TrophyCount>
      </TrophyButton>

      {/* Trophy Panel */}
      {showPanel && (
        <TrophyPanel>
          <PanelHeader>
            <PanelTitle>Trophies</PanelTitle>
            <CloseButton onClick={() => setShowPanel(false)}>×</CloseButton>
          </PanelHeader>

          <TrophyGrid>
            {trophies.map((trophy) => (
              <TrophyCard key={trophy.id} $unlocked={trophy.unlocked}>
                <TrophyCardIcon $unlocked={trophy.unlocked}>
                  {trophy.icon}
                </TrophyCardIcon>
                <TrophyCardContent>
                  <TrophyCardName $unlocked={trophy.unlocked}>
                    {trophy.name}
                  </TrophyCardName>
                  <TrophyCardDesc>{trophy.description}</TrophyCardDesc>
                  {!trophy.unlocked && (
                    <>
                      <ProgressBar>
                        <ProgressFill $percentage={trophy.progress} />
                      </ProgressBar>
                      <ProgressLabel>{trophy.progressLabel}</ProgressLabel>
                    </>
                  )}
                  {trophy.unlocked && (
                    <UnlockedBadge>Unlocked!</UnlockedBadge>
                  )}
                </TrophyCardContent>
              </TrophyCard>
            ))}
          </TrophyGrid>

          <PanelStats>
            <StatItem>
              <StatValue>{progress.articlesRead.length}</StatValue>
              <StatLabel>Articles Read</StatLabel>
            </StatItem>
            <StatItem>
              <StatValue>{progress.worldsCompleted.length}</StatValue>
              <StatLabel>Worlds Completed</StatLabel>
            </StatItem>
            <StatItem>
              <StatValue>{progress.highScore.toLocaleString()}</StatValue>
              <StatLabel>High Score</StatLabel>
            </StatItem>
          </PanelStats>

          <ResetButton onClick={() => {
            if (confirm('Reset all progress? This cannot be undone.')) {
              // We'll wire this up later
              location.reload();
            }
          }}>
            Reset Progress
          </ResetButton>
        </TrophyPanel>
      )}

      {/* Trophy Unlock Notification */}
      {notification && (
        <TrophyNotification>
          <NotificationIcon>🏆</NotificationIcon>
          <NotificationContent>
            <NotificationTitle>{notification.title}</NotificationTitle>
            <NotificationMessage>{notification.message}</NotificationMessage>
          </NotificationContent>
        </TrophyNotification>
      )}
    </>
  );
};

// Animations

const slideIn = keyframes`
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const pulse = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
`;

// Styled Components

const TrophyButton = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid rgba(255, 215, 0, 0.5);
  border-radius: 12px;
  color: white;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.95);
    border-color: rgba(255, 215, 0, 0.8);
    transform: translateY(-2px);
  }

  @media (max-width: 768px) {
    top: 10px;
    right: 10px;
    padding: 10px 12px;
  }
`;

const TrophyIcon = styled.span`
  font-size: 20px;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const TrophyCount = styled.span`
  font-size: 14px;
  color: #ffd700;
`;

const TrophyPanel = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  max-width: 100vw;
  height: 100vh;
  background: rgba(10, 10, 20, 0.95);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 99;
  padding: 24px;
  overflow-y: auto;
  animation: ${slideIn} 0.3s ease-out;

  @media (max-width: 768px) {
    width: 100vw;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const PanelTitle = styled.h2`
  font-size: 24px;
  color: white;
  margin: 0;
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  color: white;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
`;

const TrophyGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
`;

const TrophyCard = styled.div<{ $unlocked: boolean }>`
  display: flex;
  gap: 16px;
  padding: 16px;
  background: ${props => props.$unlocked
    ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 140, 0, 0.1))'
    : 'rgba(255, 255, 255, 0.05)'};
  border: 1px solid ${props => props.$unlocked
    ? 'rgba(255, 215, 0, 0.3)'
    : 'rgba(255, 255, 255, 0.1)'};
  border-radius: 12px;
  transition: all 0.2s ease;

  ${props => props.$unlocked && `
    background-image: linear-gradient(
      90deg,
      rgba(255, 215, 0, 0.1) 0px,
      rgba(255, 215, 0, 0.2) 50%,
      rgba(255, 215, 0, 0.1) 100%
    );
    background-size: 1000px 100%;
    animation: ${shimmer} 3s infinite;
  `}

  &:hover {
    transform: translateY(-2px);
    border-color: ${props => props.$unlocked
      ? 'rgba(255, 215, 0, 0.5)'
      : 'rgba(255, 255, 255, 0.2)'};
  }
`;

const TrophyCardIcon = styled.div<{ $unlocked: boolean }>`
  font-size: 48px;
  filter: ${props => props.$unlocked ? 'none' : 'grayscale(100%) opacity(0.5)'};
`;

const TrophyCardContent = styled.div`
  flex: 1;
`;

const TrophyCardName = styled.h3<{ $unlocked: boolean }>`
  font-size: 18px;
  color: ${props => props.$unlocked ? '#ffd700' : 'white'};
  margin: 0 0 4px 0;
`;

const TrophyCardDesc = styled.p`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 12px 0;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
`;

const ProgressFill = styled.div<{ $percentage: number }>`
  width: ${props => props.$percentage}%;
  height: 100%;
  background: linear-gradient(90deg, #4a9eff, #7b2ff7);
  border-radius: 2px;
  transition: width 0.5s ease;
`;

const ProgressLabel = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
`;

const UnlockedBadge = styled.div`
  display: inline-block;
  padding: 4px 12px;
  background: rgba(0, 255, 0, 0.2);
  border: 1px solid rgba(0, 255, 0, 0.4);
  border-radius: 12px;
  color: #00ff00;
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
`;

const PanelStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
`;

const StatItem = styled.div`
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: #ffd700;
  margin-bottom: 4px;
`;

const StatLabel = styled.div`
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
`;

const ResetButton = styled.button`
  width: 100%;
  padding: 12px;
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.3);
  border-radius: 8px;
  color: #ff6666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 0, 0, 0.2);
    border-color: rgba(255, 0, 0, 0.5);
  }
`;

const TrophyNotification = styled.div`
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 101;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, rgba(255, 215, 0, 0.95), rgba(255, 140, 0, 0.95));
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(255, 215, 0, 0.5);
  animation: ${slideIn} 0.5s ease-out;
  max-width: 350px;

  @media (max-width: 768px) {
    top: 70px;
    right: 10px;
    left: 10px;
    max-width: none;
  }
`;

const NotificationIcon = styled.div`
  font-size: 48px;
  animation: ${pulse} 1s ease-in-out infinite;
`;

const NotificationContent = styled.div`
  flex: 1;
`;

const NotificationTitle = styled.div`
  font-size: 18px;
  font-weight: bold;
  color: #1a1a1a;
  margin-bottom: 4px;
`;

const NotificationMessage = styled.div`
  font-size: 14px;
  color: #333;
`;

export default TrophyUI;
