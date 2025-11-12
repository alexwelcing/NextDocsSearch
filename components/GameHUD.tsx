import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

interface GameHUDProps {
  score: number;
  timeRemaining: number;
  combo: number;
  isPlaying: boolean;
}

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const comboGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 10px rgba(138, 43, 226, 0.5);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
  }
`;

const HUDContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 100;
  font-family: 'Arial Black', sans-serif;
`;

const ScoreDisplay = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 12px 20px;
  border-radius: 10px;
  border: 2px solid #de7ea2;
  backdrop-filter: blur(10px);

  @media (max-width: 768px) {
    bottom: 10px;
    left: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    border-width: 1px;
  }
`;

const ScoreLabel = styled.div`
  color: #de7ea2;
  font-size: 12px;
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 1px;

  @media (max-width: 768px) {
    font-size: 9px;
    letter-spacing: 0.5px;
  }
`;

const ScoreValue = styled.div`
  color: white;
  font-size: 28px;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(222, 126, 162, 0.8);

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const TimerDisplay = styled.div<{ warning: boolean }>`
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 12px 20px;
  border-radius: 10px;
  border: 2px solid ${props => props.warning ? '#ff4444' : '#de7ea2'};
  backdrop-filter: blur(10px);
  animation: ${props => props.warning ? pulse : 'none'} 0.5s infinite;

  @media (max-width: 768px) {
    bottom: 10px;
    right: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    border-width: 1px;
  }
`;

const TimerLabel = styled.div`
  color: #de7ea2;
  font-size: 12px;
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 1px;

  @media (max-width: 768px) {
    font-size: 9px;
    letter-spacing: 0.5px;
  }
`;

const TimerValue = styled.div<{ warning: boolean }>`
  color: ${props => props.warning ? '#ff4444' : 'white'};
  font-size: 28px;
  font-weight: bold;
  text-shadow: 0 0 10px ${props => props.warning ? 'rgba(255, 68, 68, 0.8)' : 'rgba(222, 126, 162, 0.8)'};

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const ComboDisplay = styled.div<{ visible: boolean; highCombo: boolean }>`
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: ${props => props.highCombo
    ? 'linear-gradient(135deg, rgba(138, 43, 226, 0.9), rgba(255, 215, 0, 0.9))'
    : 'rgba(138, 43, 226, 0.9)'};
  padding: 12px 30px;
  border-radius: 50px;
  border: 2px solid ${props => props.highCombo ? '#FFD700' : '#de7ea2'};
  backdrop-filter: blur(10px);
  opacity: ${props => props.visible ? 1 : 0};
  transition: opacity 0.3s ease;
  animation: ${props => props.highCombo ? comboGlow : 'none'} 1s infinite;

  @media (max-width: 768px) {
    bottom: 60px;
    padding: 8px 20px;
    border-width: 1px;
  }
`;

const ComboText = styled.div`
  color: white;
  font-size: 20px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);

  @media (max-width: 768px) {
    font-size: 14px;
    letter-spacing: 1px;
  }
`;

const MultiplierBadge = styled.div`
  display: inline-block;
  background: #FFD700;
  color: #000;
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 16px;
  font-weight: bold;
  margin-left: 10px;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);

  @media (max-width: 768px) {
    padding: 3px 8px;
    font-size: 11px;
    margin-left: 6px;
  }
`;

const GameHUD: React.FC<GameHUDProps> = ({ score, timeRemaining, combo, isPlaying }) => {
  const [displayScore, setDisplayScore] = useState(0);
  const isWarning = timeRemaining <= 5;
  const showCombo = combo >= 3;
  const highCombo = combo >= 5;

  // Animate score increment
  useEffect(() => {
    if (score > displayScore) {
      const increment = Math.ceil((score - displayScore) / 10);
      const timer = setTimeout(() => {
        setDisplayScore(prev => Math.min(prev + increment, score));
      }, 30);
      return () => clearTimeout(timer);
    } else {
      setDisplayScore(score);
    }
  }, [score, displayScore]);

  if (!isPlaying) return null;

  const multiplier = highCombo ? 3 : combo >= 3 ? 2 : 1;

  return (
    <HUDContainer>
      <ScoreDisplay>
        <ScoreLabel>Score</ScoreLabel>
        <ScoreValue>{displayScore.toLocaleString()}</ScoreValue>
      </ScoreDisplay>

      <TimerDisplay warning={isWarning}>
        <TimerLabel>Time</TimerLabel>
        <TimerValue warning={isWarning}>
          {Math.ceil(timeRemaining)}
        </TimerValue>
      </TimerDisplay>

      <ComboDisplay visible={showCombo} highCombo={highCombo}>
        <ComboText>
          {combo}x COMBO
          {multiplier > 1 && (
            <MultiplierBadge>{multiplier}x POINTS</MultiplierBadge>
          )}
        </ComboText>
      </ComboDisplay>
    </HUDContainer>
  );
};

export default GameHUD;
