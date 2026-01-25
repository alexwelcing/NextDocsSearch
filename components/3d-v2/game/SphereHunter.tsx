/**
 * SphereHunter - Streamlined clicking game
 *
 * A clean, performant game with:
 * - Minimal state management
 * - Efficient orb spawning
 * - Simple combo system
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import TargetOrb from './TargetOrb';

export type GameState = 'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';

export interface GameStats {
  score: number;
  comboMax: number;
  accuracy: number;
  hits: number;
  misses: number;
}

interface Orb {
  id: string;
  position: [number, number, number];
  isGolden: boolean;
}

interface SphereHunterProps {
  gameState: GameState;
  onScoreUpdate?: (score: number) => void;
  onComboUpdate?: (combo: number) => void;
  onTimeUpdate?: (time: number) => void;
  onGameEnd?: (stats: GameStats) => void;
  hitRadiusMultiplier?: number;
  comboMultiplier?: number;
  duration?: number;
  maxOrbs?: number;
}

// Generate position in front arc
const getRandomPosition = (): [number, number, number] => {
  const radius = 8 + Math.random() * 6;
  const theta = (Math.random() - 0.5) * Math.PI * 0.8; // ±72 degrees
  const phi = Math.PI / 4 + Math.random() * Math.PI / 4;

  return [
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
    -radius * Math.sin(phi) * Math.cos(theta),
  ];
};

const SphereHunter: React.FC<SphereHunterProps> = ({
  gameState,
  onScoreUpdate,
  onComboUpdate,
  onTimeUpdate,
  onGameEnd,
  hitRadiusMultiplier = 1,
  comboMultiplier = 1,
  duration = 30,
  maxOrbs = 6,
}) => {
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const comboMaxRef = useRef(0);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const timeRef = useRef(0);
  const nextSpawnRef = useRef(0);
  const idRef = useRef(0);

  // Reset on game start
  useEffect(() => {
    if (gameState === 'PLAYING') {
      scoreRef.current = 0;
      comboRef.current = 0;
      comboMaxRef.current = 0;
      hitsRef.current = 0;
      missesRef.current = 0;
      timeRef.current = 0;
      nextSpawnRef.current = 0;
      setOrbs([]);
    }
  }, [gameState]);

  // Spawn logic
  const spawnOrb = useCallback(() => {
    const newOrb: Orb = {
      id: `orb-${idRef.current++}`,
      position: getRandomPosition(),
      isGolden: Math.random() < 0.05,
    };
    setOrbs((prev) => [...prev.slice(-(maxOrbs - 1)), newOrb]);
  }, [maxOrbs]);

  // Hit handler
  const handleHit = useCallback(
    (orbId: string, points: number, isGolden: boolean) => {
      setOrbs((prev) => prev.filter((o) => o.id !== orbId));

      comboRef.current++;
      comboMaxRef.current = Math.max(comboMaxRef.current, comboRef.current);
      hitsRef.current++;

      // Calculate score with combo
      let multiplier = 1;
      if (comboRef.current >= 5) multiplier = 3;
      else if (comboRef.current >= 3) multiplier = 2;

      const earned = Math.round(points * multiplier * comboMultiplier);
      scoreRef.current += earned;

      onScoreUpdate?.(scoreRef.current);
      onComboUpdate?.(comboRef.current);
    },
    [comboMultiplier, onScoreUpdate, onComboUpdate]
  );

  // Miss handler
  const handleMiss = useCallback(
    (orbId: string) => {
      setOrbs((prev) => prev.filter((o) => o.id !== orbId));
      comboRef.current = 0;
      missesRef.current++;
      onComboUpdate?.(0);
    },
    [onComboUpdate]
  );

  // Background click handler
  const handleBackgroundClick = useCallback(() => {
    if (gameState === 'PLAYING') {
      comboRef.current = 0;
      missesRef.current++;
      onComboUpdate?.(0);
    }
  }, [gameState, onComboUpdate]);

  // Game loop
  useFrame((_, delta) => {
    if (gameState !== 'PLAYING') return;

    timeRef.current += delta;
    const remaining = Math.max(0, duration - timeRef.current);
    onTimeUpdate?.(remaining);

    // End game
    if (timeRef.current >= duration) {
      const total = hitsRef.current + missesRef.current;
      onGameEnd?.({
        score: scoreRef.current,
        comboMax: comboMaxRef.current,
        accuracy: total > 0 ? (hitsRef.current / total) * 100 : 0,
        hits: hitsRef.current,
        misses: missesRef.current,
      });
      return;
    }

    // Spawn orbs
    if (timeRef.current >= nextSpawnRef.current && orbs.length < maxOrbs) {
      spawnOrb();
      // Spawn rate increases over time
      const rate = timeRef.current < 10 ? 0.5 : timeRef.current < 20 ? 0.3 : 0.2;
      nextSpawnRef.current = timeRef.current + rate;
    }
  });

  return (
    <group>
      {/* Click capture background */}
      {gameState === 'PLAYING' && (
        <mesh onClick={handleBackgroundClick}>
          <sphereGeometry args={[50, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.BackSide} />
        </mesh>
      )}

      {/* Orbs */}
      {orbs.map((orb) => (
        <TargetOrb
          key={orb.id}
          position={orb.position}
          isGolden={orb.isGolden}
          lifetime={3}
          hitRadius={0.8 * hitRadiusMultiplier}
          onHit={(pts) => handleHit(orb.id, pts, orb.isGolden)}
          onMiss={() => handleMiss(orb.id)}
        />
      ))}
    </group>
  );
};

export default SphereHunter;
