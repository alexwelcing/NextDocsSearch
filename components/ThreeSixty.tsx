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
import GameLeaderboard from './GameLeaderboard';
import PerformanceMonitor from './PerformanceMonitor';
import CameraController from './CameraController';
import CinematicCamera from './CinematicCamera';
import CinematicIntro from './CinematicIntro';
import SceneLighting from './SceneLighting';
import SeasonalEffects from './SeasonalEffects';
import { useJourney } from './JourneyContext';
import { getCurrentSeason, getSeasonalTheme, Season, SeasonalTheme } from '../lib/theme/seasonalTheme';
import { perfLogger } from '@/lib/performance-logger';

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

interface SceneryOption {
  id: string;
  name: string;
  type: 'image' | 'splat';
  path: string;
}

interface PerformanceFlags {
  allowSplats: boolean;
  allowSeasonalEffects: boolean;
  forceLowPower: boolean;
}

const ThreeSixty: React.FC<ThreeSixtyProps> = ({ currentImage, isDialogOpen, onChangeImage, onGameStateChange }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [useGaussianSplat, setUseGaussianSplat] = useState(false);
  const [availableSplats, setAvailableSplats] = useState<SplatFile[]>([]);
  const [selectedSplat, setSelectedSplat] = useState<string>('');
  const [hasSplats, setHasSplats] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);
  const [performanceFlags, setPerformanceFlags] = useState<PerformanceFlags>({
    allowSplats: true,
    allowSeasonalEffects: true,
    forceLowPower: false,
  });

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

  // Detect low-end devices and apply performance feature flags
  useEffect(() => {
    const detectLowEndDevice = () => {
      if (typeof window === 'undefined') return;

      const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
      const hardwareConcurrency = navigator.hardwareConcurrency ?? 8;
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl');
      const maxTextureSize = gl ? gl.getParameter(gl.MAX_TEXTURE_SIZE) : 4096;

      const detectedLowEnd =
        deviceMemory <= 4 ||
        hardwareConcurrency <= 4 ||
        maxTextureSize <= 4096;

      setIsLowEndDevice(detectedLowEnd);
    };

    detectLowEndDevice();
    window.addEventListener('resize', detectLowEndDevice);
    return () => window.removeEventListener('resize', detectLowEndDevice);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const perfMode = params.get('perf');
    const forceLowPower = perfMode === 'low';
    const forceHighPower = perfMode === 'high';
    const splatsDisabled = params.get('splats') === 'off';
    const seasonalDisabled = params.get('seasonal') === 'off';

    const allowSplats = !splatsDisabled && (forceHighPower || (!forceLowPower && !isLowEndDevice));
    const allowSeasonalEffects =
      !seasonalDisabled && (forceHighPower || (!forceLowPower && !isLowEndDevice));

    setPerformanceFlags({
      allowSplats,
      allowSeasonalEffects,
      forceLowPower: forceLowPower && !forceHighPower,
    });
  }, [isLowEndDevice]);

  useEffect(() => {
    if (performanceFlags.allowSplats || !useGaussianSplat) return;
    setUseGaussianSplat(false);
  }, [performanceFlags.allowSplats, useGaussianSplat]);

  // Notify parent of game state changes
  useEffect(() => {
    if (onGameStateChange) {
      onGameStateChange(gameState);
    }
  }, [gameState, onGameStateChange]);

  useEffect(() => {
    if (gameState === 'IDLE') {
      perfLogger.markEvent('ambient-loop');
    }
  }, [gameState]);

  useEffect(() => {
    if (useGaussianSplat && performanceFlags.allowSplats && selectedSplat) {
      perfLogger.markEvent('artifact-splat');
    }
  }, [useGaussianSplat, performanceFlags.allowSplats, selectedSplat]);

  useEffect(() => {
    if (performanceFlags.allowSeasonalEffects && gameState !== 'PLAYING') {
      perfLogger.markEvent(`seasonal-${currentSeason}`);
    }
  }, [performanceFlags.allowSeasonalEffects, gameState, currentSeason]);

  // Create XR store for VR support
  const store = useMemo(() => createXRStore(), []);

  // Build scenery options for the tablet menu
  const sceneryOptions = useMemo<SceneryOption[]>(() => {
    const options: SceneryOption[] = [];

    // Add current image as an option
    options.push({
      id: 'current-panorama',
      name: 'Default Panorama',
      type: 'image',
      path: currentImage,
    });

    // Add available splats
    if (performanceFlags.allowSplats) {
      availableSplats.forEach((splat, i) => {
        options.push({
          id: `splat-${i}`,
          name: splat.filename.replace('.splat', ''),
          type: 'splat',
          path: splat.path,
        });
      });
    }

    return options;
  }, [currentImage, availableSplats, performanceFlags.allowSplats]);

  // Handle scenery change from tablet
  const handleSceneryChange = useCallback((scenery: SceneryOption) => {
    if (scenery.type === 'splat') {
      if (!performanceFlags.allowSplats) {
        return;
      }
      setUseGaussianSplat(true);
      setSelectedSplat(scenery.path);
    } else {
      setUseGaussianSplat(false);
      onChangeImage(scenery.path);
    }
  }, [onChangeImage, performanceFlags.allowSplats]);

  // Get current scenery path for tablet display
  const currentSceneryPath = useGaussianSplat ? selectedSplat : currentImage;

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

  const dprRange = useMemo<[number, number]>(() => {
    if (isMobile || isLowEndDevice || performanceFlags.forceLowPower) {
      return [0.3, 0.8];
    }
    return [0.5, 1.5];
  }, [isMobile, isLowEndDevice, performanceFlags.forceLowPower]);

  // Game handlers - start game directly from terminal
  const handleStartGame = useCallback(() => {
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
      handleStartGame();
    }, 100);
  }, [handleStartGame]);

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

      {/* Background controls moved to tablet menu */}

      <Canvas
        shadows={false}
        dpr={dprRange}
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
                onGameStart={handleStartGame}
                onGameEnd={handleGameEnd}
                onScoreUpdate={setScore}
                onComboUpdate={setCombo}
                onTimeUpdate={setTimeRemaining}
              />

              {/* Background: Use Gaussian Splat if enabled and not on mobile/playing, otherwise use sphere */}
              {useGaussianSplat &&
              selectedSplat &&
              !isMobile &&
              performanceFlags.allowSplats &&
              gameState !== 'PLAYING' ? (
                <GaussianSplatBackground
                  splatUrl={selectedSplat}
                  position={[0, 0, 0]}
                  scale={1}
                />
              ) : (
                <BackgroundSphere imageUrl={currentImage} transitionDuration={0.5} />
              )}

              {/* Seasonal particle effects (snow, leaves, etc.) */}
              {!isMobile && performanceFlags.allowSeasonalEffects && gameState !== 'PLAYING' && (
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

      {/* Pip-Boy style tablet - slides up from bottom */}
      {!loading && (
        <InteractiveTablet
          isGamePlaying={gameState === 'PLAYING' || gameState === 'COUNTDOWN'}
          articles={articles}
          onStartGame={handleStartGame}
          onChangeScenery={handleSceneryChange}
          availableScenery={sceneryOptions}
          currentScenery={currentSceneryPath}
        />
      )}

      {/* Cinematic Intro Overlay */}
      {showCinematicIntro && !cinematicComplete && (
        <CinematicIntro
          onComplete={handleCinematicComplete}
          onSkip={handleCinematicSkip}
          onProgressUpdate={handleCinematicProgress}
        />
      )}

      {/* Countdown overlay - minimal */}
      {gameState === 'COUNTDOWN' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.7)',
          zIndex: 1000,
        }}>
          <div style={{
            fontSize: '120px',
            fontWeight: 'bold',
            color: '#0f0',
            fontFamily: 'monospace',
          }}>
            {countdown || 'GO'}
          </div>
        </div>
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
