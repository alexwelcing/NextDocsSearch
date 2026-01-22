/**
 * ThreeSixtyV2 - Clean, performant 3D scene
 *
 * A streamlined replacement for the original ThreeSixty component.
 * Features:
 * - SparkJS Gaussian Splatting support
 * - GPU-accelerated particle effects
 * - Minimal state, maximum performance
 * - Clean separation of concerns
 */

import React, { useState, useCallback, useEffect } from 'react';
import styled from 'styled-components';
import SparkScene from './core/SparkScene';
import SplatLoader from './core/SplatLoader';
import ParticleField from './effects/ParticleField';
import CosmicOrb from './effects/CosmicOrb';
import SphereHunter, { GameState, GameStats } from './game/SphereHunter';

// Styled components
const Container = styled.div`
  position: fixed;
  inset: 0;
  z-index: 4;
`;

const HUD = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  gap: 24px;
  font-family: monospace;
  color: #00d4ff;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
`;

const HUDItem = styled.div<{ $combo?: number }>`
  text-align: center;

  .label {
    font-size: 12px;
    opacity: 0.7;
    margin-bottom: 4px;
  }

  .value {
    font-size: 28px;
    font-weight: bold;
  }

  &.combo .value {
    color: ${(props) =>
      props.$combo && props.$combo >= 5 ? '#ffd700' : props.$combo && props.$combo >= 3 ? '#ff6600' : '#00d4ff'};
  }
`;

const CountdownOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  z-index: 200;

  .number {
    font-size: 120px;
    font-weight: bold;
    color: #00ff00;
    font-family: monospace;
    text-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
  }
`;

const GameOverOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  z-index: 200;
  gap: 24px;

  h1 {
    font-size: 48px;
    color: #00d4ff;
    margin: 0;
  }

  .score {
    font-size: 64px;
    color: #ffd700;
    font-weight: bold;
  }

  .stats {
    display: flex;
    gap: 32px;
    color: #aaa;
    font-size: 16px;
  }

  button {
    padding: 16px 48px;
    font-size: 18px;
    background: linear-gradient(135deg, #00d4ff, #0088ff);
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    font-weight: bold;
    transition: transform 0.2s, box-shadow 0.2s;

    &:hover {
      transform: scale(1.05);
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
    }
  }
`;

const BackButton = styled.button`
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 100;
  padding: 10px 18px;
  background: rgba(10, 10, 16, 0.85);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 8px;
  color: #00d4ff;
  cursor: pointer;
  font-size: 14px;
  font-family: monospace;
  font-weight: 600;
  backdrop-filter: blur(10px);
  transition: all 0.2s;

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.6);
  }
`;

const StartButton = styled.button`
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  padding: 16px 48px;
  font-size: 20px;
  background: linear-gradient(135deg, #00d4ff, #8844ff);
  border: none;
  border-radius: 12px;
  color: white;
  cursor: pointer;
  font-weight: bold;
  font-family: monospace;
  transition: all 0.3s;
  box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);

  &:hover {
    transform: translateX(-50%) scale(1.05);
    box-shadow: 0 6px 30px rgba(0, 212, 255, 0.5);
  }
`;

// Props
interface ThreeSixtyV2Props {
  splatUrl?: string;
  onExit?: () => void;
  cosmicPowerActive?: boolean;
}

const ThreeSixtyV2: React.FC<ThreeSixtyV2Props> = ({
  splatUrl,
  onExit,
  cosmicPowerActive = false,
}) => {
  // Game state
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [countdown, setCountdown] = useState(3);
  const [stats, setStats] = useState<GameStats | null>(null);

  // Start game
  const startGame = useCallback(() => {
    setGameState('COUNTDOWN');
    setCountdown(3);
    setScore(0);
    setCombo(0);
    setStats(null);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setGameState('PLAYING');
          setTimeRemaining(30);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Game end
  const handleGameEnd = useCallback((finalStats: GameStats) => {
    setStats(finalStats);
    setGameState('GAME_OVER');
  }, []);

  // Multipliers for cosmic power
  const hitRadius = cosmicPowerActive ? 2 : 1;
  const comboMultiplier = cosmicPowerActive ? 1.5 : 1;

  return (
    <Container>
      <SparkScene cameraPosition={[0, 2, 10]}>
        {/* Ambient particles */}
        <ParticleField
          count={300}
          radius={20}
          color="#00d4ff"
          color2="#8844ff"
          size={2}
          speed={0.3}
        />

        {/* Central cosmic orb (visible when idle) */}
        {gameState === 'IDLE' && (
          <CosmicOrb
            position={[0, 0, -5]}
            radius={1}
            color1="#00d4ff"
            color2="#8844ff"
            intensity={1.5}
            rings
          />
        )}

        {/* Gaussian splat background */}
        {splatUrl && (
          <SplatLoader
            url={splatUrl}
            position={[0, 0, 0]}
            scale={1}
          />
        )}

        {/* Game */}
        <SphereHunter
          gameState={gameState}
          onScoreUpdate={setScore}
          onComboUpdate={setCombo}
          onTimeUpdate={setTimeRemaining}
          onGameEnd={handleGameEnd}
          hitRadiusMultiplier={hitRadius}
          comboMultiplier={comboMultiplier}
          duration={30}
          maxOrbs={6}
        />
      </SparkScene>

      {/* Back button */}
      <BackButton onClick={onExit}>← Home</BackButton>

      {/* Start button */}
      {gameState === 'IDLE' && (
        <StartButton onClick={startGame}>
          START GAME
        </StartButton>
      )}

      {/* HUD */}
      {gameState === 'PLAYING' && (
        <HUD>
          <HUDItem>
            <div className="label">SCORE</div>
            <div className="value">{score}</div>
          </HUDItem>
          <HUDItem>
            <div className="label">TIME</div>
            <div className="value">{Math.ceil(timeRemaining)}</div>
          </HUDItem>
          <HUDItem className="combo" $combo={combo}>
            <div className="label">COMBO</div>
            <div className="value">x{combo}</div>
          </HUDItem>
        </HUD>
      )}

      {/* Countdown overlay */}
      {gameState === 'COUNTDOWN' && (
        <CountdownOverlay>
          <div className="number">{countdown || 'GO!'}</div>
        </CountdownOverlay>
      )}

      {/* Game over overlay */}
      {gameState === 'GAME_OVER' && stats && (
        <GameOverOverlay>
          <h1>GAME OVER</h1>
          <div className="score">{stats.score}</div>
          <div className="stats">
            <span>Best Combo: x{stats.comboMax}</span>
            <span>Accuracy: {stats.accuracy.toFixed(1)}%</span>
            <span>Hits: {stats.hits}</span>
          </div>
          <button onClick={startGame}>PLAY AGAIN</button>
          <button onClick={onExit} style={{ background: 'rgba(255,255,255,0.1)' }}>
            EXIT
          </button>
        </GameOverOverlay>
      )}

      {/* Cosmic power indicator */}
      {cosmicPowerActive && gameState !== 'GAME_OVER' && (
        <div
          style={{
            position: 'fixed',
            top: gameState === 'PLAYING' ? 80 : 20,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(136,68,255,0.2))',
            border: '1px solid rgba(0,212,255,0.5)',
            borderRadius: '20px',
            color: '#00d4ff',
            fontSize: '12px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            zIndex: 100,
          }}
        >
          COSMIC POWER ACTIVE
        </div>
      )}
    </Container>
  );
};

export default ThreeSixtyV2;
