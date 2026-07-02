import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import GameOrb from './GameOrb';
import ParticleExplosion from './ParticleExplosion';
import { useGameStore } from '@/stores/gameStore';
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
  onGameEnd?: () => void;
}

const ClickingGame: React.FC<ClickingGameProps> = ({ onGameEnd }) => {
  const gameState = useGameStore((state) => state.gameState);
  const addScore = useGameStore((state) => state.addScore);
  const updateCombo = useGameStore((state) => state.updateCombo);
  const updateTimeRemaining = useGameStore((state) => state.updateTimeRemaining);
  const registerHit = useGameStore((state) => state.registerHit);
  const registerMissedClick = useGameStore((state) => state.registerMissedClick);
  const combo = useGameStore((state) => state.combo);

  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  const timeElapsedRef = useRef(0);
  const nextSpawnTimeRef = useRef(0);
  const orbIdCounterRef = useRef(0);
  const lastReportedTimeRef = useRef<number | null>(null);

  const gameDuration = 30;
  const maxOrbs = isMobile ? 3 : 6;

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Reset local orb state when game starts
  useEffect(() => {
    if (gameState === 'STARTING') {
      setOrbs([]);
      setExplosions([]);
      timeElapsedRef.current = 0;
      nextSpawnTimeRef.current = 0;
      orbIdCounterRef.current = 0;
      lastReportedTimeRef.current = null;
      // Spawn idle orbs for visual appeal
      const idleOrbs: Orb[] = [];
      for (let i = 0; i < 3; i++) {
        idleOrbs.push({
          id: `idle-${i}`,
          position: getRandomPosition(),
          isGolden: false,
        });
      }
      setOrbs(idleOrbs);
    }
  }, [gameState]);

  // Generate random position on a sphere - shooting gallery style (front-facing arc)
  const getRandomPosition = (): [number, number, number] => {
    const radius = 8 + Math.random() * 6;
    const maxTheta = (80 * Math.PI) / 180;
    const theta = -maxTheta + Math.random() * (maxTheta * 2);
    const phi = Math.PI / 4 + Math.random() * (Math.PI / 4);

    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = -radius * Math.sin(phi) * Math.cos(theta);

    return [x, y, z];
  };

  // Check if position is too close to existing orbs
  const isTooClose = (newPos: [number, number, number], existingOrbs: Orb[], minDistance = 3): boolean => {
    const minDistanceSquared = minDistance * minDistance;
    return existingOrbs.some((orb) => {
      const dx = orb.position[0] - newPos[0];
      const dy = orb.position[1] - newPos[1];
      const dz = orb.position[2] - newPos[2];
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      return distanceSquared < minDistanceSquared;
    });
  };

  // Spawn a new orb
  const spawnOrb = useCallback(() => {
    let position: [number, number, number];
    let attempts = 0;
    const maxAttempts = 10;

    do {
      position = getRandomPosition();
      attempts++;
    } while (attempts < maxAttempts && isTooClose(position, orbs));

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
    const multiplier = isMobile ? 2 : 1;
    if (timeElapsed < 10) return 0.5 * multiplier;
    if (timeElapsed < 20) return 0.25 * multiplier;
    return 0.167 * multiplier;
  };

  // Game loop
  useFrame((state, delta) => {
    if (gameState !== 'PLAYING') return;

    // Update timer
    timeElapsedRef.current += delta;
    const timeRemaining = Math.max(0, gameDuration - timeElapsedRef.current);
    const reportedTime = Math.ceil(timeRemaining);
    if (reportedTime !== lastReportedTimeRef.current) {
      lastReportedTimeRef.current = reportedTime;
      updateTimeRemaining(timeRemaining);
    }

    // Check if game ended
    if (timeElapsedRef.current >= gameDuration) {
      onGameEnd?.();
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
      setOrbs((prev) => prev.filter((o) => o.id !== orbId));

      const explosion: Explosion = {
        id: `explosion-${Date.now()}-${Math.random()}`,
        position,
        color: isGolden ? '#FFD700' : '#00BFFF',
      };
      setExplosions((prev) => {
        const updated = [...prev, explosion];
        return updated.slice(-5);
      });

      const newCombo = combo + 1;
      updateCombo(newCombo);
      registerHit();

      let multiplier = 1;
      if (newCombo >= 5) multiplier = 3;
      else if (newCombo >= 3) multiplier = 2;

      addScore(points * multiplier);
    },
    [combo, updateCombo, registerHit, addScore]
  );

  // Handle orb miss (timeout/despawn)
  const handleOrbMiss = useCallback((orbId: string) => {
    setOrbs((prev) => prev.filter((o) => o.id !== orbId));
    updateCombo(0);
  }, [updateCombo]);

  // Handle explosion complete
  const handleExplosionComplete = useCallback((explosionId: string) => {
    setExplosions((prev) => prev.filter((e) => e.id !== explosionId));
  }, []);

  // Handle missed click (clicking on background, not hitting any orb)
  const handleMissedClick = useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      if (gameState === 'PLAYING') {
        registerMissedClick();
        updateCombo(0);
      }
    },
    [gameState, registerMissedClick, updateCombo]
  );

  return (
    <group>
      {/* Invisible click capture sphere to track missed clicks */}
      {gameState === 'PLAYING' && (
        <mesh onClick={handleMissedClick}>
          <sphereGeometry args={[50, 16, 16]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.BackSide} />
        </mesh>
      )}

      {/* Render orbs */}
      {orbs.map((orb) => (
        <GameOrb
          key={orb.id}
          position={orb.position}
          isGolden={orb.isGolden}
          lifetime={gameState === 'IDLE' ? 999999 : 3}
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
