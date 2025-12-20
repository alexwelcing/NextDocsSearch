import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin, useXRSessionModeSupported } from '@react-three/xr';
import styled from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Stats } from '@react-three/drei';
import { BackSide } from 'three';
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
import { runAssetQueue, AssetStage } from '../lib/perf/assetQueue';
import { usePerfPreferences } from '../lib/hooks/usePerfPreferences';

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

const LoadingOverlay = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 5;
  color: rgba(255, 255, 255, 0.7);
  font-family: 'Courier New', monospace;
  letter-spacing: 0.2em;
  text-transform: uppercase;
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

const ThreeSixty: React.FC<ThreeSixtyProps> = ({ currentImage, isDialogOpen, onChangeImage, onGameStateChange }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [useGaussianSplat, setUseGaussianSplat] = useState(false);
  const [availableSplats, setAvailableSplats] = useState<SplatFile[]>([]);
  const [selectedSplat, setSelectedSplat] = useState<string>('');
  const [hasSplats, setHasSplats] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [initialSceneReady, setInitialSceneReady] = useState(false);
  const [fullSceneReady, setFullSceneReady] = useState(false);

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
  const [prefetchDeepAssets, setPrefetchDeepAssets] = useState(!showCinematicIntro);

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
  const { prefersReducedMotion, prefersReducedData } = usePerfPreferences();

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

  useEffect(() => {
    if (prefersReducedMotion || prefersReducedData) {
      setShowCinematicIntro(false);
      setCinematicComplete(true);
      setCinematicProgress(1);
      setPrefetchDeepAssets(true);
    }
  }, [prefersReducedMotion, prefersReducedData]);

  useEffect(() => {
    if (!showCinematicIntro) {
      setPrefetchDeepAssets(true);
    }
  }, [showCinematicIntro]);

  // Notify parent of game state changes
  useEffect(() => {
    if (onGameStateChange) {
      onGameStateChange(gameState);
    }
  }, [gameState, onGameStateChange]);

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
    availableSplats.forEach((splat, i) => {
      options.push({
        id: `splat-${i}`,
        name: splat.filename.replace('.splat', ''),
        type: 'splat',
        path: splat.path,
      });
    });

    return options;
  }, [currentImage, availableSplats]);

  // Handle scenery change from tablet
  const handleSceneryChange = useCallback((scenery: SceneryOption) => {
    if (scenery.type === 'splat') {
      setUseGaussianSplat(true);
      setSelectedSplat(scenery.path);
    } else {
      setUseGaussianSplat(false);
      onChangeImage(scenery.path);
    }
  }, [onChangeImage]);

  // Get current scenery path for tablet display
  const currentSceneryPath = useGaussianSplat ? selectedSplat : currentImage;

  // Detect VR capability - only show VR button if device supports it
  const isVRSupported = useXRSessionModeSupported('immersive-vr');

  const preloadImage = useCallback((source: string) => {
    if (!source || typeof window === 'undefined') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => resolve();
      image.src = source;
    });
  }, []);

  const fetchArticles = useCallback(async () => {
    try {
      const response = await fetch('/api/articles');
      const data: ArticleData[] = await response.json();
      setArticles(data);
    } catch (error) {
      console.error("Failed fetching articles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSplats = useCallback(async () => {
    if (prefersReducedData || isMobile) {
      setHasSplats(false);
      return;
    }

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
  }, [isMobile, prefersReducedData]);

  useEffect(() => {
    if (!currentImage) {
      return;
    }

    let cancelled = false;

    const runCoreQueue = async () => {
      const stages: AssetStage[] = [
        {
          id: 'core',
          label: 'Core scene assets',
          tasks: [
            {
              id: 'background',
              label: 'Static background',
              load: () => preloadImage(currentImage),
            },
            {
              id: 'camera-path',
              label: 'Primary camera path',
              load: () => new Promise((resolve) => requestAnimationFrame(() => resolve(true))),
            },
            {
              id: 'interactive-tablet',
              label: 'Interactive tablet shell',
              load: () => import('./InteractiveTablet'),
            },
          ],
        },
      ];

      await runAssetQueue(stages);

      if (!cancelled) {
        setInitialSceneReady(true);
      }
    };

    runCoreQueue();

    return () => {
      cancelled = true;
    };
  }, [currentImage, preloadImage]);

  useEffect(() => {
    if (!initialSceneReady || fullSceneReady || !prefetchDeepAssets) {
      return;
    }

    let cancelled = false;

    const runDeepQueue = async () => {
      const deepTasks = [
        {
          id: 'articles',
          label: 'Article content',
          load: fetchArticles,
        },
      ];

      if (!prefersReducedData) {
        deepTasks.push({
          id: 'splats',
          label: 'Gaussian splats',
          load: fetchSplats,
        });
      }

      const stages: AssetStage[] = [
        {
          id: 'deep',
          label: 'Expanded scene assets',
          tasks: deepTasks,
        },
      ];

      await runAssetQueue(stages);

      if (!cancelled) {
        setFullSceneReady(true);
      }
    };

    runDeepQueue();

    return () => {
      cancelled = true;
    };
  }, [fetchArticles, fetchSplats, fullSceneReady, initialSceneReady, prefetchDeepAssets, prefersReducedData]);

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

  const handleCinematicStart = useCallback(() => {
    setPrefetchDeepAssets(true);
  }, []);

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

  const showLightweightScene = initialSceneReady && !fullSceneReady;
  const allowSeasonalEffects = !isMobile && !prefersReducedMotion && !prefersReducedData && fullSceneReady;
  const allowGaussianSplat = useGaussianSplat && selectedSplat && !isMobile && !prefersReducedData && gameState !== 'PLAYING' && fullSceneReady;
  const shouldShowCinematic = showCinematicIntro && !cinematicComplete && fullSceneReady;
  const dprRange = prefersReducedData ? [0.3, 0.6] : isMobile ? [0.3, 0.8] : [0.5, 1.5];

  const LightweightIntroScene = () => (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 8, 4]} intensity={0.7} />
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 2, -6]}>
        <planeGeometry args={[12, 6]} />
        <meshBasicMaterial color="#0b1020" />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <icosahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial color="#7ab1ff" metalness={0.1} roughness={0.6} />
      </mesh>
      <mesh position={[2.5, 0.6, -1]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color="#5a78ff" metalness={0.05} roughness={0.7} />
      </mesh>
      <mesh position={[-2.4, 0.8, -1.5]}>
        <coneGeometry args={[0.8, 1.6, 5]} />
        <meshStandardMaterial color="#93d7ff" metalness={0.1} roughness={0.8} />
      </mesh>
      <mesh>
        <sphereGeometry args={[50, 16, 12]} />
        <meshBasicMaterial color="#04060f" side={BackSide} />
      </mesh>
    </>
  );

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
            {showLightweightScene && <LightweightIntroScene />}
            {fullSceneReady && (
              <PhysicsEnvironment>
                <PhysicsGround />

                {/* Cinematic camera for intro sequence */}
                {shouldShowCinematic && (
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
                {allowGaussianSplat ? (
                  <GaussianSplatBackground
                    splatUrl={selectedSplat}
                    position={[0, 0, 0]}
                    scale={1}
                  />
                ) : (
                  <BackgroundSphere imageUrl={currentImage} transitionDuration={0.5} />
                )}

                {/* Seasonal particle effects (snow, leaves, etc.) */}
                {allowSeasonalEffects && gameState !== 'PLAYING' && (
                  <SeasonalEffects season={currentSeason} theme={seasonalTheme} />
                )}

                {/* Dynamic Scene Lighting */}
                <SceneLighting
                  isCinematic={showCinematicIntro && !cinematicComplete}
                  cinematicProgress={cinematicProgress}
                />
              </PhysicsEnvironment>
            )}
          </XROrigin>
        </XR>
        {/* Performance monitoring - visible in development */}
        {process.env.NODE_ENV === 'development' && <Stats />}
      </Canvas>

      {!initialSceneReady && (
        <LoadingOverlay>
          Loading intro scene...
        </LoadingOverlay>
      )}

      {showLightweightScene && (
        <LoadingOverlay style={{ top: 'auto', bottom: '40px', opacity: 0.7 }}>
          Loading full scene...
        </LoadingOverlay>
      )}

      {/* Performance Monitor - outside Canvas */}
      {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}

      {/* Pip-Boy style tablet - slides up from bottom */}
      {fullSceneReady && !loading && (
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
          onStart={handleCinematicStart}
          durationScale={prefersReducedMotion ? 0.7 : 1}
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
