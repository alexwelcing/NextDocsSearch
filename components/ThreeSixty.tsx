import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin, useXRSessionModeSupported } from '@react-three/xr';
import styled from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Stats } from '@react-three/drei';
import PhysicsGround from './PhysicsGround';
import BackgroundSphere from './BackgroundSphere';
import type { ArticleData } from './GlowingArticleDisplay';
import GaussianSplatBackground from './GaussianSplatBackground';
import InteractiveTablet from './InteractiveTablet';
import ClickingGame, { GameStats } from './ClickingGame';
import GameHUD from './GameHUD';
import GameStartOverlay from './GameStartOverlay';
import GameLeaderboard from './GameLeaderboard';
import BouncingBall from './BouncingBall';
import PerformanceMonitor from './PerformanceMonitor';
import CameraController from './CameraController';
import CinematicCamera from './CinematicCamera';
import CinematicIntro from './CinematicIntro';
import SceneLighting from './SceneLighting';
import SeasonalEffects from './SeasonalEffects';
import { useJourney } from './JourneyContext';
import { getCurrentSeason, getSeasonalTheme, Season, SeasonalTheme } from '../lib/theme/seasonalTheme';

// Re-export GameState type for compatibility
export type GameState = 'IDLE' | 'STARTING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';

const PhysicsEnvironment: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Physics
      gravity={[0, -9.81, 0]}
      iterations={5}
      tolerance={0.01}
      allowSleep={true}
      broadphase="SAP"
      defaultContactMaterial={{
        friction: 0.1,
        restitution: 0.7,
      }}
    >
      {children}
    </Physics>
  );
};

const VRButtonStyled = styled.button`
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(130, 20, 160, 0.5);
  border: 1px solid rgba(222, 126, 162, 0.5);
  color: rgba(255, 255, 255, 0.8);
  padding: 6px 12px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 1000;
  transition: all 0.2s ease;
  backdrop-filter: blur(5px);

  &:hover {
    background: rgba(130, 20, 160, 0.8);
    border-color: rgba(222, 126, 162, 0.8);
    color: white;
  }

  &:disabled {
    background: rgba(102, 102, 102, 0.3);
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const BackgroundControlsContainer = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
  padding: 6px;
  border-radius: 4px;
  border: 1px solid rgba(222, 126, 162, 0.3);
  backdrop-filter: blur(5px);
`

const ToggleButton = styled.button<{ active: boolean }>`
  background: ${props => props.active ? 'rgba(130, 20, 160, 0.7)' : 'rgba(51, 51, 51, 0.5)'};
  border: 1px solid ${props => props.active ? 'rgba(222, 126, 162, 0.5)' : 'rgba(102, 102, 102, 0.3)'};
  color: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  font-size: 10px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.active ? 'rgba(148, 25, 71, 0.8)' : 'rgba(68, 68, 68, 0.6)'};
  }
`

const SplatSelector = styled.select`
  background: rgba(51, 51, 51, 0.5);
  border: 1px solid rgba(222, 126, 162, 0.3);
  color: rgba(255, 255, 255, 0.9);
  padding: 4px 6px;
  font-size: 10px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(68, 68, 68, 0.6);
  }

  option {
    background: #333;
    color: white;
  }
`

const ControlLabel = styled.label`
  color: rgba(255, 255, 255, 0.7);
  font-size: 9px;
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const ThreeSixtyContainer = styled.div`
  position: fixed;
  z-index: 4;
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  opacity: 1;
`;

interface ThreeSixtyProps {
  currentImage: string;
  isDialogOpen: boolean;
  onChangeImage: (newImage: string) => void;
  onGameStateChange?: (gameState: GameState) => void;
}

interface SplatFile {
  filename: string;
  path: string;
  size: number;
}

const ThreeSixty: React.FC<ThreeSixtyProps> = ({ currentImage, isDialogOpen, onChangeImage, onGameStateChange }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [useGaussianSplat, setUseGaussianSplat] = useState(false);
  const [availableSplats, setAvailableSplats] = useState<SplatFile[]>([]);
  const [selectedSplat, setSelectedSplat] = useState<string>('');
  const [hasSplats, setHasSplats] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Cinematic intro state - check localStorage to see if already watched
  const [showCinematicIntro, setShowCinematicIntro] = useState(() => {
    if (typeof window !== 'undefined') {
      const hasWatchedIntro = localStorage.getItem('hasWatchedIntro');
      return !hasWatchedIntro;
    }
    return false;
  });
  const [cinematicComplete, setCinematicComplete] = useState(!showCinematicIntro);
  const [cinematicProgress, setCinematicProgress] = useState(0);

  // Seasonal theme state (with query param support)
  const [currentSeason, setCurrentSeason] = useState<Season>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const seasonParam = params.get('season');
      return getCurrentSeason(seasonParam);
    }
    return getCurrentSeason();
  });
  const [seasonalTheme, setSeasonalTheme] = useState<SeasonalTheme>(getSeasonalTheme(currentSeason));

  // Game state
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [combo, setCombo] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [gameStats, setGameStats] = useState<GameStats>({
    score: 0,
    comboMax: 0,
    accuracy: 0,
    totalClicks: 0,
    successfulClicks: 0,
  });

  // Journey tracking
  const { completeQuest, updateStats, currentQuest } = useJourney();

  // Update season when query params change
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const seasonParam = params.get('season');
      const newSeason = getCurrentSeason(seasonParam);
      if (newSeason !== currentSeason) {
        setCurrentSeason(newSeason);
        setSeasonalTheme(getSeasonalTheme(newSeason));
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [currentSeason]);

  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Notify parent of game state changes
  useEffect(() => {
    if (onGameStateChange) {
      onGameStateChange(gameState);
    }
  }, [gameState, onGameStateChange]);

  // Create XR store for VR support
  const store = useMemo(() => createXRStore(), []);

  // Detect VR capability - only show VR button if device supports it
  const isVRSupported = useXRSessionModeSupported('immersive-vr');

  // Fetch articles
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch('/api/articles');
        const data: ArticleData[] = await response.json();
        setArticles(data);
      } catch (error) {
        console.error("Failed fetching articles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  // Auto-detect available splat files
  useEffect(() => {
    const fetchSplats = async () => {
      try {
        const response = await fetch('/api/getSplats');
        const data = await response.json();

        if (data.hasSplats && data.splats.length > 0) {
          setAvailableSplats(data.splats);
          setHasSplats(true);
          setSelectedSplat(data.splats[0].path);
        }
      } catch (error) {
        console.error("Failed fetching splat files:", error);
      }
    };

    fetchSplats();
  }, []);

  const handleEnterVR = async () => {
    try {
      await store.enterVR();
    } catch (error) {
      console.error('Failed to enter VR:', error);
    }
  };

  // Cinematic intro handlers
  const handleCinematicComplete = useCallback(() => {
    setCinematicComplete(true);
    setShowCinematicIntro(false);
    setCinematicProgress(1);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasWatchedIntro', 'true');
    }
  }, []);

  const handleCinematicSkip = useCallback(() => {
    setCinematicComplete(true);
    setShowCinematicIntro(false);
    setCinematicProgress(1);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hasWatchedIntro', 'true');
    }
  }, []);

  const handleCinematicProgress = useCallback((progress: number) => {
    setCinematicProgress(progress);
  }, []);

  // Game handlers
  const handleBallClick = useCallback(() => {
    setGameState('STARTING');
  }, []);

  const handleGameStart = useCallback(() => {
    setGameState('COUNTDOWN');
    setCountdown(3);
    setScore(0);
    setCombo(0);

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setTimeout(() => {
            setGameState('PLAYING');
            setTimeRemaining(30);
          }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleGameEnd = useCallback((finalScore: number, stats: GameStats) => {
    setScore(finalScore);
    setGameStats(stats);
    setGameState('GAME_OVER');

    updateStats('highestGameScore', finalScore);

    if (currentQuest?.id === 'play-game') {
      completeQuest('play-game');
    }

    if (finalScore >= 5000) {
      completeQuest('leaderboard-rank');
    }
  }, [updateStats, currentQuest, completeQuest]);

  const handlePlayAgain = useCallback(() => {
    setGameState('IDLE');
    setTimeout(() => {
      handleBallClick();
    }, 100);
  }, [handleBallClick]);

  const handleCloseLeaderboard = useCallback(() => {
    setGameState('IDLE');
  }, []);

  return (
    <ThreeSixtyContainer>
      {/* Only show VR button if device supports VR */}
      {isVRSupported && (
        <VRButtonStyled onClick={handleEnterVR}>
          Enter VR
        </VRButtonStyled>
      )}

      {/* Replay Intro Button - Only show after intro has been completed */}
      {cinematicComplete && gameState !== 'PLAYING' && (
        <VRButtonStyled
          style={{ bottom: 'auto', top: '10px', left: '10px' }}
          onClick={() => {
            setCinematicComplete(false);
            setShowCinematicIntro(true);
            setCinematicProgress(0);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('hasWatchedIntro');
            }
          }}
        >
          ▶ Replay Intro
        </VRButtonStyled>
      )}

      {/* Background Controls - Only show if splats are detected AND not playing game */}
      {hasSplats && gameState !== 'PLAYING' && (
        <BackgroundControlsContainer>
          <ControlLabel>BG</ControlLabel>
          <div style={{ display: 'flex', gap: '3px' }}>
            <ToggleButton
              active={!useGaussianSplat}
              onClick={() => setUseGaussianSplat(false)}
            >
              IMG
            </ToggleButton>
            <ToggleButton
              active={useGaussianSplat}
              onClick={() => setUseGaussianSplat(true)}
            >
              SPL
            </ToggleButton>
          </div>

          {useGaussianSplat && availableSplats.length > 0 && (
            <>
              <ControlLabel>Select Splat</ControlLabel>
              <SplatSelector
                value={selectedSplat}
                onChange={(e) => setSelectedSplat(e.target.value)}
              >
                {availableSplats.map((splat) => (
                  <option key={splat.path} value={splat.path}>
                    {splat.filename} ({(splat.size / 1024 / 1024).toFixed(1)}MB)
                  </option>
                ))}
              </SplatSelector>
            </>
          )}
        </BackgroundControlsContainer>
      )}

      <Canvas
        shadows={false}
        dpr={isMobile ? [0.3, 0.8] : [0.5, 1.5]}
        performance={{ min: 0.1 }}
        gl={{
          powerPreference: 'high-performance',
          antialias: false,
          stencil: false,
          depth: true,
          alpha: false,
        }}
        camera={{ position: [0, 2, 10], fov: isMobile ? 70 : 60 }}
      >
        <XR store={store}>
          <XROrigin position={[0, 0, 0]}>
            <PhysicsEnvironment>
              <PhysicsGround />

              {/* Cinematic camera for intro sequence */}
              {showCinematicIntro && !cinematicComplete && (
                <CinematicCamera
                  isPlaying={true}
                  onComplete={handleCinematicComplete}
                />
              )}

              {/* Camera controller for smooth game transitions */}
              {cinematicComplete && <CameraController gameState={gameState} />}

              {/* OrbitControls - disabled during cinematic intro */}
              {cinematicComplete && (
                <OrbitControls
                  enableDamping
                  dampingFactor={0.1}
                  rotateSpeed={0.5}
                  zoomSpeed={0.8}
                  panSpeed={0.5}
                  minDistance={5}
                  maxDistance={50}
                  maxPolarAngle={Math.PI / 2}
                  enablePan={false}
                />
              )}

              {/* Sphere Hunter Game */}
              <ClickingGame
                gameState={gameState}
                onGameStart={handleGameStart}
                onGameEnd={handleGameEnd}
                onScoreUpdate={setScore}
                onComboUpdate={setCombo}
                onTimeUpdate={setTimeRemaining}
              />

              {/* Bouncing Ball - visible only in IDLE state */}
              {gameState === 'IDLE' && (
                <BouncingBall onActivate={handleBallClick} />
              )}

              {/* Interactive Tablet - main menu interface */}
              {!loading && (
                <InteractiveTablet
                  initialPosition={[0, 3, 5]}
                  isGamePlaying={gameState === 'PLAYING' || gameState === 'COUNTDOWN'}
                  articles={articles}
                  onStartGame={handleBallClick}
                  cinematicRevealProgress={
                    showCinematicIntro && !cinematicComplete
                      ? Math.max(0, (cinematicProgress - 0.7) / 0.3)
                      : 1
                  }
                />
              )}

              {/* Background: Use Gaussian Splat if enabled and not on mobile/playing, otherwise use sphere */}
              {useGaussianSplat && selectedSplat && !isMobile && gameState !== 'PLAYING' ? (
                <GaussianSplatBackground
                  splatUrl={selectedSplat}
                  position={[0, 0, 0]}
                  scale={1}
                />
              ) : (
                <BackgroundSphere imageUrl={currentImage} transitionDuration={0.5} />
              )}

              {/* Seasonal particle effects (snow, leaves, etc.) */}
              {!isMobile && gameState !== 'PLAYING' && (
                <SeasonalEffects season={currentSeason} theme={seasonalTheme} />
              )}

              {/* Dynamic Scene Lighting */}
              <SceneLighting
                isCinematic={showCinematicIntro && !cinematicComplete}
                cinematicProgress={cinematicProgress}
              />
            </PhysicsEnvironment>
          </XROrigin>
        </XR>
        {/* Performance monitoring - visible in development */}
        {process.env.NODE_ENV === 'development' && <Stats />}
      </Canvas>

      {/* Performance Monitor - outside Canvas */}
      {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}

      {/* Cinematic Intro Overlay */}
      {showCinematicIntro && !cinematicComplete && (
        <CinematicIntro
          onComplete={handleCinematicComplete}
          onSkip={handleCinematicSkip}
          onProgressUpdate={handleCinematicProgress}
        />
      )}

      {/* Game UI Overlays */}
      {(gameState === 'STARTING' || gameState === 'COUNTDOWN') && (
        <GameStartOverlay
          onStart={handleGameStart}
          isCountingDown={gameState === 'COUNTDOWN'}
          countdown={countdown}
        />
      )}

      {gameState === 'PLAYING' && (
        <GameHUD
          score={score}
          timeRemaining={timeRemaining}
          combo={combo}
          isPlaying={true}
        />
      )}

      {gameState === 'GAME_OVER' && (
        <GameLeaderboard
          playerScore={score}
          playerStats={gameStats}
          onPlayAgain={handlePlayAgain}
          onClose={handleCloseLeaderboard}
        />
      )}
    </ThreeSixtyContainer>
  );
};

export default ThreeSixty;
