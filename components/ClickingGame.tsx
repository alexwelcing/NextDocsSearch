import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import GameOrb from './GameOrb';
import ParticleExplosion from './ParticleExplosion';
import * as THREE from 'three';

export type GameState = 'IDLE' | 'STARTING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';

interface Orb {
  id: string;
  position: [number, number, number];
  isGolden: boolean;
}

interface Explosion {
  id: string;
  position: [number, number, number];
  color: string;
}

interface ClickingGameProps {
  gameState: GameState;
  onGameStart: () => void;
  onGameEnd: (score: number, stats: GameStats) => void;
  onScoreUpdate?: (score: number) => void;
  onComboUpdate?: (combo: number) => void;
  onTimeUpdate?: (timeRemaining: number) => void;
}

export interface GameStats {
  score: number;
  comboMax: number;
  accuracy: number;
  totalClicks: number;
  successfulClicks: number;
}

const ClickingGame: React.FC<ClickingGameProps> = ({
  gameState,
  onGameStart,
  onGameEnd,
  onScoreUpdate,
  onComboUpdate,
  onTimeUpdate,
}) => {
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboMax, setComboMax] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [successfulClicks, setSuccessfulClicks] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const timeElapsedRef = useRef(0);
  const nextSpawnTimeRef = useRef(0);
  const orbIdCounterRef = useRef(0);

  const gameDuration = 30; // 30 seconds
  const maxOrbs = isMobile ? 3 : 6; // Limit concurrent orbs on mobile

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Notify parent of updates
  useEffect(() => {
    onScoreUpdate?.(score);
  }, [score, onScoreUpdate]);

  useEffect(() => {
    onComboUpdate?.(combo);
  }, [combo, onComboUpdate]);

  useEffect(() => {
    const timeRemaining = Math.max(0, gameDuration - timeElapsedRef.current);
    onTimeUpdate?.(timeRemaining);
  }, [onTimeUpdate]);

  // Reset game state
  const resetGame = useCallback(() => {
    setOrbs([]);
    setExplosions([]);
    setScore(0);
    setCombo(0);
    setComboMax(0);
    setTotalClicks(0);
    setSuccessfulClicks(0);
    timeElapsedRef.current = 0;
    nextSpawnTimeRef.current = 0;
    orbIdCounterRef.current = 0;
  }, []);

  // Spawn idle orbs (for IDLE state visual)
  const spawnIdleOrbsMemoized = useCallback(() => {
    const idleOrbs: Orb[] = [];
    for (let i = 0; i < 3; i++) {
      const position = getRandomPosition();
      idleOrbs.push({
        id: `idle-${i}`,
        position,
        isGolden: false,
      });
    }
    setOrbs(idleOrbs);
  }, []);

  // Start game
  useEffect(() => {
    if (gameState === 'STARTING') {
      resetGame();
      // Spawn initial idle orbs for visual appeal
      spawnIdleOrbsMemoized();
    }
  }, [gameState, resetGame, spawnIdleOrbsMemoized]);

  // Generate random position on a sphere - shooting gallery style (front-facing arc)
  const getRandomPosition = (): [number, number, number] => {
    const radius = 8 + Math.random() * 6; // Between 8-14 units from center

    // Constrain to 160-degree arc in front of camera (80 degrees left/right of center)
    // theta: horizontal angle - limit to ±80 degrees (±1.396 radians) from forward (0)
    const maxTheta = (80 * Math.PI) / 180; // 80 degrees in radians
    const theta = -maxTheta + Math.random() * (maxTheta * 2); // -80 to +80 degrees

    // phi: vertical angle - keep in upper hemisphere, slightly lower range for better targeting
    const phi = Math.PI / 4 + Math.random() * (Math.PI / 4); // 45-90 degrees from top

    const x = radius * Math.sin(phi) * Math.sin(theta); // Note: sin(theta) for forward-facing
    const y = radius * Math.cos(phi);
    const z = -radius * Math.sin(phi) * Math.cos(theta); // Negative Z is forward

    return [x, y, z];
  };

  // Check if position is too close to existing orbs
  const isTooClose = (newPos: [number, number, number], existingOrbs: Orb[], minDistance = 3): boolean => {
    return existingOrbs.some((orb) => {
      const dx = orb.position[0] - newPos[0];
      const dy = orb.position[1] - newPos[1];
      const dz = orb.position[2] - newPos[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      return distance < minDistance;
    });
  };

  // Spawn a new orb
  const spawnOrb = useCallback(() => {
    let position: [number, number, number];
    let attempts = 0;
    const maxAttempts = 10;

    // Try to find a good position
    do {
      position = getRandomPosition();
      attempts++;
    } while (attempts < maxAttempts && isTooClose(position, orbs));

    // 5% chance for golden orb
    const isGolden = Math.random() < 0.05;

    const newOrb: Orb = {
      id: `orb-${orbIdCounterRef.current++}`,
      position,
      isGolden,
    };

    setOrbs((prev) => [...prev, newOrb]);
  }, [orbs]);

  // Calculate spawn rate based on time elapsed
  const getSpawnInterval = (timeElapsed: number): number => {
    const multiplier = isMobile ? 2 : 1; // Slower spawn on mobile
    if (timeElapsed < 10) return 0.5 * multiplier; // 2 per second (1 on mobile)
    if (timeElapsed < 20) return 0.25 * multiplier; // 4 per second (2 on mobile)
    return 0.167 * multiplier; // 6 per second (3 on mobile)
  };

  // Game loop
  useFrame((state, delta) => {
    if (gameState !== 'PLAYING') return;

    // Update timer
    timeElapsedRef.current += delta;
    const timeRemaining = Math.max(0, gameDuration - timeElapsedRef.current);
    onTimeUpdate?.(timeRemaining);

    // Check if game ended
    if (timeElapsedRef.current >= gameDuration) {
      const accuracy = totalClicks > 0 ? (successfulClicks / totalClicks) * 100 : 0;
      onGameEnd(score, {
        score,
        comboMax,
        accuracy,
        totalClicks,
        successfulClicks,
      });
      return;
    }

    // Spawn new orbs based on time - but respect max concurrent orbs
    if (timeElapsedRef.current >= nextSpawnTimeRef.current && orbs.length < maxOrbs) {
      spawnOrb();
      nextSpawnTimeRef.current = timeElapsedRef.current + getSpawnInterval(timeElapsedRef.current);
    }
  });

  // Handle orb hit
  const handleOrbHit = useCallback(
    (orbId: string, points: number, position: [number, number, number], isGolden: boolean) => {
      // Remove orb
      setOrbs((prev) => prev.filter((o) => o.id !== orbId));

      // Add explosion (limit to 5 concurrent explosions for performance)
      const explosion: Explosion = {
        id: `explosion-${Date.now()}-${Math.random()}`,
        position,
        color: isGolden ? '#FFD700' : '#00BFFF',
      };
      setExplosions((prev) => {
        const updated = [...prev, explosion];
        return updated.slice(-5); // Keep only last 5 explosions
      });

      // Update score and combo
      const newCombo = combo + 1;
      setCombo(newCombo);
      setComboMax((prev) => Math.max(prev, newCombo));
      setSuccessfulClicks((prev) => prev + 1);

      // Apply combo multiplier
      let multiplier = 1;
      if (newCombo >= 5) multiplier = 3;
      else if (newCombo >= 3) multiplier = 2;

      const earnedPoints = points * multiplier;
      setScore((prev) => prev + earnedPoints);
    },
    [combo]
  );

  // Handle orb miss (timeout/despawn)
  const handleOrbMiss = useCallback((orbId: string) => {
    setOrbs((prev) => prev.filter((o) => o.id !== orbId));
    setCombo(0); // Reset combo on miss
  }, []);

  // Handle explosion complete
  const handleExplosionComplete = useCallback((explosionId: string) => {
    setExplosions((prev) => prev.filter((e) => e.id !== explosionId));
  }, []);

  // Handle click on orb (for tracking accuracy)
  const handleClick = useCallback(() => {
    if (gameState === 'PLAYING') {
      setTotalClicks((prev) => prev + 1);
    }
  }, [gameState]);

  return (
    <group onClick={handleClick}>
      {/* Render orbs */}
      {orbs.map((orb) => (
        <GameOrb
          key={orb.id}
          position={orb.position}
          isGolden={orb.isGolden}
          lifetime={gameState === 'IDLE' ? 999999 : 3} // Idle orbs don't despawn
          onHit={(points) => handleOrbHit(orb.id, points, orb.position, orb.isGolden)}
          onMiss={() => handleOrbMiss(orb.id)}
        />
      ))}

      {/* Render explosions */}
      {explosions.map((explosion) => (
        <ParticleExplosion
          key={explosion.id}
          position={explosion.position}
          color={explosion.color}
          onComplete={() => handleExplosionComplete(explosion.id)}
        />
      ))}
    </group>
  );
};

export default ClickingGame;
