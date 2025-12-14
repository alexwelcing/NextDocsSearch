/**
 * IdeaHub - Central orchestrator for the idea experience
 *
 * Manages:
 * - Orb arrangement and animation
 * - Game state and flow
 * - Content engagement
 * - Progress tracking
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Html } from '@react-three/drei';
import * as THREE from 'three';
import IdeaOrb from './IdeaOrb';
import type {
  IdeaOrbData,
  OrbState,
  OrbContent,
  IdeaGameState,
  IdeaGameStats,
  IdeaHubConfig,
} from './types';
import { ORB_COLORS, DEFAULT_HUB_CONFIG } from './types';

interface IdeaHubProps {
  /** Initial orbs to display */
  initialOrbs?: IdeaOrbData[];
  /** Hub position in scene */
  position?: [number, number, number];
  /** Configuration for orb arrangement */
  config?: IdeaHubConfig;
  /** Called when content is engaged */
  onContentEngage?: (content: OrbContent) => void;
  /** Called when game completes */
  onGameComplete?: (stats: IdeaGameStats) => void;
  /** Called when an orb is awakened */
  onOrbAwakened?: (id: string) => void;
  /** Whether hub is active/visible */
  isActive?: boolean;
}

/**
 * Generate orb positions in rings around center
 */
function generateOrbPositions(
  config: IdeaHubConfig,
  orbCount: number
): THREE.Vector3Tuple[] {
  const positions: THREE.Vector3Tuple[] = [];
  let orbIndex = 0;

  for (const ring of config.rings) {
    for (let i = 0; i < ring.orbCount && orbIndex < orbCount; i++) {
      const angle = (i / ring.orbCount) * Math.PI * 2;
      const x = Math.cos(angle) * ring.radius;
      const z = Math.sin(angle) * ring.radius;
      const y = ring.elevation + Math.sin(angle * 2) * 0.3;
      positions.push([x, y, z]);
      orbIndex++;
    }
  }

  return positions;
}

/**
 * Generate game orbs for awakening sequence
 */
function generateGameOrb(
  existingOrbs: IdeaOrbData[],
  orbCounter: number
): IdeaOrbData {
  // Position in a sphere around the hub
  const radius = 6 + Math.random() * 4;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.PI * 0.3 + Math.random() * Math.PI * 0.4; // Upper hemisphere

  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi) + 2;
  const z = radius * Math.sin(phi) * Math.sin(theta);

  const isRare = Math.random() < 0.08; // 8% rare chance

  return {
    id: `game-orb-${orbCounter}`,
    state: 'awakening',
    content: {
      type: isRare ? 'mystery' : 'article',
      id: `awakened-${orbCounter}`,
      title: isRare ? 'Rare Discovery' : 'New Idea',
      isRare,
    },
    position: [x, y, z],
    size: isRare ? 0.7 : 0.5,
  };
}

export default function IdeaHub({
  initialOrbs = [],
  position = [0, 2, 0],
  config = DEFAULT_HUB_CONFIG,
  onContentEngage,
  onGameComplete,
  onOrbAwakened,
  isActive = true,
}: IdeaHubProps) {
  // Core state
  const coreRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Orb management
  const [orbs, setOrbs] = useState<IdeaOrbData[]>(initialOrbs);
  const [gameOrbs, setGameOrbs] = useState<IdeaOrbData[]>([]);
  const orbCounterRef = useRef(0);

  // Game state
  const [gameState, setGameState] = useState<IdeaGameState>('idle');
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [rareCount, setRareCount] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const gameStartTime = useRef<number>(0);
  const lastSpawnTime = useRef<number>(0);

  // Animation state
  const pulseRef = useRef(0);
  const rotationRef = useRef(0);

  // Generate static orb positions
  const orbPositions = useMemo(
    () => generateOrbPositions(config, orbs.length),
    [config, orbs.length]
  );

  // Update orb positions
  useEffect(() => {
    setOrbs((current) =>
      current.map((orb, i) => ({
        ...orb,
        position: orbPositions[i] || orb.position,
      }))
    );
  }, [orbPositions]);

  // Handle core click - start game
  const handleCoreClick = useCallback(() => {
    if (gameState === 'idle') {
      setGameState('starting');
      // Reset game state
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setRareCount(0);
      setTotalClicks(0);
      setGameOrbs([]);

      // Start countdown
      setCountdown(3);
      const countdownInterval = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownInterval);
            setGameState('playing');
            gameStartTime.current = Date.now();
            lastSpawnTime.current = Date.now();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
  }, [gameState]);

  // Handle orb awakening (game click)
  const handleOrbAwaken = useCallback(
    (id: string, points: number) => {
      setGameOrbs((current) => current.filter((o) => o.id !== id));

      const newCombo = combo + 1;
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setTotalClicks((t) => t + 1);

      // Apply combo multiplier
      let multiplier = 1;
      if (newCombo >= 5) multiplier = 3;
      else if (newCombo >= 3) multiplier = 2;

      const finalPoints = points * multiplier;
      setScore((s) => s + finalPoints);

      if (points > 10) {
        setRareCount((r) => r + 1);
      }

      onOrbAwakened?.(id);
    },
    [combo, onOrbAwakened]
  );

  // Handle orb expire (missed)
  const handleOrbExpire = useCallback((id: string) => {
    setGameOrbs((current) => current.filter((o) => o.id !== id));
    setCombo(0); // Reset combo on miss
  }, []);

  // Handle content engagement
  const handleContentEngage = useCallback(
    (id: string, content: OrbContent) => {
      onContentEngage?.(content);
    },
    [onContentEngage]
  );

  // Game loop
  useFrame((state, delta) => {
    if (!groupRef.current || !coreRef.current) return;

    // Core animation
    pulseRef.current += delta * 2;
    const pulse = Math.sin(pulseRef.current) * 0.1;

    // Core scale based on state
    let coreScale = 1;
    if (gameState === 'idle') coreScale = 1 + pulse * 0.5;
    if (gameState === 'starting' || gameState === 'playing') coreScale = 1.2 + pulse;

    coreRef.current.scale.setScalar(coreScale);

    // Rotation
    rotationRef.current += delta * 0.3;
    groupRef.current.rotation.y = rotationRef.current;

    // Game spawning logic
    if (gameState === 'playing') {
      const elapsed = (Date.now() - gameStartTime.current) / 1000;

      // Check game end
      if (elapsed >= config.game.duration) {
        setGameState('ending');
        setTimeout(() => {
          setGameState('results');
          const stats: IdeaGameStats = {
            ideasAwakened: totalClicks,
            insightLevel: maxCombo,
            rareDiscoveries: rareCount,
            totalClicks,
            accuracy: gameOrbs.length > 0 ? totalClicks / (totalClicks + gameOrbs.length) : 1,
            duration: config.game.duration,
          };
          onGameComplete?.(stats);
        }, 500);
        return;
      }

      // Spawn new orbs
      const timeSinceSpawn = (Date.now() - lastSpawnTime.current) / 1000;
      const spawnInterval = 1 / config.game.spawnRate;

      if (timeSinceSpawn >= spawnInterval && gameOrbs.length < config.game.maxOrbs) {
        orbCounterRef.current++;
        const newOrb = generateGameOrb(gameOrbs, orbCounterRef.current);
        setGameOrbs((current) => [...current, newOrb]);
        lastSpawnTime.current = Date.now();
      }
    }
  });

  // Close results
  const handleCloseResults = useCallback(() => {
    setGameState('idle');
    setGameOrbs([]);
  }, []);

  if (!isActive) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Central Core */}
      <Sphere
        ref={coreRef}
        args={[0.8, 32, 32]}
        onClick={handleCoreClick}
      >
        <meshStandardMaterial
          color={ORB_COLORS.core}
          emissive={gameState === 'idle' ? '#4488ff' : '#ffaa44'}
          emissiveIntensity={0.8}
          metalness={0.5}
          roughness={0.2}
        />
      </Sphere>

      {/* Core glow */}
      <Sphere args={[1.2, 16, 16]}>
        <meshBasicMaterial
          color={gameState === 'idle' ? '#4488ff' : '#ffaa44'}
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Core light */}
      <pointLight
        color={gameState === 'idle' ? '#4488ff' : '#ffaa44'}
        intensity={gameState === 'playing' ? 3 : 1.5}
        distance={8}
      />

      {/* Static orbs (when not in game) */}
      {gameState === 'idle' &&
        orbs.map((orb, i) => (
          <IdeaOrb
            key={orb.id}
            data={{ ...orb, position: orbPositions[i] || orb.position }}
            onEngage={handleContentEngage}
            interactive={true}
            gameActive={false}
          />
        ))}

      {/* Game orbs */}
      {(gameState === 'playing' || gameState === 'ending') &&
        gameOrbs.map((orb) => (
          <IdeaOrb
            key={orb.id}
            data={orb}
            onAwaken={handleOrbAwaken}
            onExpire={handleOrbExpire}
            interactive={true}
            gameActive={true}
            lifetime={3}
          />
        ))}

      {/* UI Overlays */}
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        {/* Idle prompt */}
        {gameState === 'idle' && (
          <div
            style={{
              color: '#4488ff',
              fontSize: '12px',
              fontFamily: 'monospace',
              textAlign: 'center',
              textShadow: '0 0 10px #4488ff',
              animation: 'pulse 2s infinite',
            }}
          >
            Click to Awaken Ideas
          </div>
        )}

        {/* Countdown */}
        {gameState === 'starting' && (
          <div
            style={{
              color: '#ffaa44',
              fontSize: '48px',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              textShadow: '0 0 20px #ffaa44',
            }}
          >
            {countdown > 0 ? countdown : 'GO!'}
          </div>
        )}

        {/* Game HUD */}
        {gameState === 'playing' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: 'white',
              fontFamily: 'monospace',
            }}
          >
            <div style={{ fontSize: '24px', color: '#ffaa44' }}>{score}</div>
            {combo >= 3 && (
              <div
                style={{
                  fontSize: '14px',
                  color: combo >= 5 ? '#ffd700' : '#aa88ff',
                  animation: 'pulse 0.5s infinite',
                }}
              >
                {combo}x INSIGHT
              </div>
            )}
          </div>
        )}
      </Html>

      {/* Results overlay */}
      {gameState === 'results' && (
        <Html center distanceFactor={8}>
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              border: '2px solid #ffaa44',
              borderRadius: '12px',
              padding: '24px',
              color: 'white',
              fontFamily: 'monospace',
              textAlign: 'center',
              minWidth: '200px',
            }}
          >
            <div style={{ fontSize: '18px', color: '#ffaa44', marginBottom: '16px' }}>
              AWAKENING COMPLETE
            </div>
            <div style={{ fontSize: '32px', color: '#ffd700', marginBottom: '16px' }}>
              {score}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>
              Ideas Awakened: {totalClicks}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '8px' }}>
              Max Insight: {maxCombo}x
            </div>
            {rareCount > 0 && (
              <div style={{ fontSize: '12px', color: '#ffd700', marginBottom: '8px' }}>
                Rare Discoveries: {rareCount}
              </div>
            )}
            <button
              onClick={handleCloseResults}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #4488ff, #44ff88)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontFamily: 'monospace',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Continue
            </button>
          </div>
        </Html>
      )}
    </group>
  );
}

export type { IdeaHubProps };
