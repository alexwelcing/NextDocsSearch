import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

interface GameHUDProps {
  score: number;
  timeRemaining: number;
  combo: number;
  isPlaying: boolean;
  cosmicPowerActive?: boolean;
  comboBoostMultiplier?: number;
}

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
`;

const comboGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
  }
`;

const cosmicPulse = keyframes`
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 20px rgba(255, 0, 255, 0.6), 0 0 40px rgba(0, 255, 255, 0.4);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 30px rgba(255, 0, 255, 0.8), 0 0 60px rgba(0, 255, 255, 0.6);
  }
`;

const laserSweep = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
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
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 20px 30px;
  border-radius: 8px;
  border: 2px solid rgba(0, 212, 255, 0.5);
  backdrop-filter: blur(10px);
`;

const ScoreLabel = styled.div`
  color: #00d4ff;
  font-size: 14px;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const ScoreValue = styled.div`
  color: white;
  font-size: 48px;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.6);
`;

const TimerDisplay = styled.div<{ warning: boolean }>`
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 20px 30px;
  border-radius: 8px;
  border: 2px solid ${props => props.warning ? '#ff4444' : 'rgba(0, 212, 255, 0.5)'};
  backdrop-filter: blur(10px);
  animation: ${props => props.warning ? pulse : 'none'} 0.5s infinite;
`;

const TimerLabel = styled.div`
  color: #00d4ff;
  font-size: 14px;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 2px;
`;

const TimerValue = styled.div<{ warning: boolean }>`
  color: ${props => props.warning ? '#ff4444' : 'white'};
  font-size: 48px;
  font-weight: bold;
  text-shadow: 0 0 10px ${props => props.warning ? 'rgba(255, 68, 68, 0.8)' : 'rgba(0, 212, 255, 0.6)'};
`;

const ComboDisplay = styled.div<{ visible: boolean; highCombo: boolean }>`
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: ${props => props.highCombo
    ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.9), rgba(255, 215, 0, 0.9))'
    : 'rgba(0, 212, 255, 0.9)'};
  padding: 15px 40px;
  border-radius: 8px;
  border: 2px solid ${props => props.highCombo ? '#FFD700' : 'rgba(0, 212, 255, 0.6)'};
  backdrop-filter: blur(10px);
  opacity: ${props => props.visible ? 1 : 0};
  transition: opacity 0.3s ease;
  animation: ${props => props.highCombo ? comboGlow : 'none'} 1s infinite;
`;

const ComboText = styled.div`
  color: white;
  font-size: 28px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
`;

const MultiplierBadge = styled.div`
  display: inline-block;
  background: #FFD700;
  color: #000;
  padding: 5px 15px;
  border-radius: 20px;
  font-size: 20px;
  font-weight: bold;
  margin-left: 15px;
  box-shadow: 0 0 15px rgba(255, 215, 0, 0.8);
`;

const CosmicPowerDisplay = styled.div`
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(128, 0, 255, 0.85), rgba(0, 255, 255, 0.85));
  padding: 12px 28px;
  border-radius: 30px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  animation: ${cosmicPulse} 2s infinite ease-in-out;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const CosmicIcon = styled.div`
  width: 24px;
  height: 24px;
  background: radial-gradient(circle, #fff 0%, #ff00ff 40%, #00ffff 100%);
  border-radius: 50%;
  box-shadow: 0 0 15px #ff00ff, 0 0 25px #00ffff;
`;

const CosmicText = styled.div`
  color: white;
  font-size: 16px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 3px;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
  background: linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff);
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${laserSweep} 3s linear infinite;
`;

const CosmicBonus = styled.span`
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: #fff;
  -webkit-text-fill-color: #fff;
  margin-left: 8px;
`;

const GameHUD: React.FC<GameHUDProps> = ({
  score,
  timeRemaining,
  combo,
  isPlaying,
  cosmicPowerActive = false,
  comboBoostMultiplier = 1,
}) => {
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

  const baseMultiplier = highCombo ? 3 : combo >= 3 ? 2 : 1;
  const totalMultiplier = Math.round(baseMultiplier * comboBoostMultiplier * 10) / 10;

  return (
    <HUDContainer>
      {/* Cosmic Power Indicator */}
      {cosmicPowerActive && (
        <CosmicPowerDisplay>
          <CosmicIcon />
          <CosmicText>
            COSMIC POWER
            <CosmicBonus>2.5x HIT ZONE</CosmicBonus>
          </CosmicText>
        </CosmicPowerDisplay>
      )}

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
          {totalMultiplier > 1 && (
            <MultiplierBadge>
              {totalMultiplier}x POINTS
              {cosmicPowerActive && comboBoostMultiplier > 1 && ' +BOOST'}
            </MultiplierBadge>
          )}
        </ComboText>
      </ComboDisplay>
    </HUDContainer>
  );
};

export default GameHUD;
