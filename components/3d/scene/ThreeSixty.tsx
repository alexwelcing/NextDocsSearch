import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin, useXRSessionModeSupported } from '@react-three/xr';
import styled from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Stats } from '@react-three/drei';
import PhysicsGround from './PhysicsGround';
import BackgroundSphere from '../background/BackgroundSphere';
import type { ArticleData } from '../interactive/GlowingArticleDisplay';
import InteractiveTablet from '../interactive/InteractiveTablet';
import ClickingGame, { GameStats } from '../game/ClickingGame';
import GameHUD from '../../overlays/GameHUD';
import GameLeaderboard from '../../overlays/GameLeaderboard';
import PerformanceMonitor from '../../PerformanceMonitor';
import CameraController from '../camera/CameraController';
import CinematicCamera from '../camera/CinematicCamera';
import DirectorsIntro from '../../overlays/DirectorsIntro';
import SceneLighting from './SceneLighting';
import ArticleExplorer3D, { ArticleDetailPanel } from '../interactive/ArticleExplorer3D';
import ArticleDisplayPanel from '../interactive/ArticleDisplayPanel';
import InfiniteLibrary, { COSMIC_LIBRARY, DIGITAL_GARDEN } from '../experiences/InfiniteLibrary';
import { useJourney } from '../../contexts/JourneyContext';
import { perfLogger } from '@/lib/performance-logger';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';
import { useArticleDiscovery } from '../../ArticleDiscoveryProvider';
import HelpButton from '../../ui/HelpButton';

// Re-export GameState type for compatibility
export type GameState = 'IDLE' | 'STARTING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';

// Map polarity string to number for InfiniteLibrary
const polarityToNumber = (polarity?: string): number => {
  const map: Record<string, number> = {
    'C3': -1.0, 'C2': -0.66, 'C1': -0.33,
    'N0': 0,
    'P1': 0.33, 'P2': 0.66, 'P3': 1.0,
  };
  return polarity ? (map[polarity] ?? 0) : 0;
};

// Map EnhancedArticleData to InfiniteLibrary's Article interface
const mapToLibraryArticle = (article: EnhancedArticleData) => ({
  id: article.slug,
  title: article.title,
  polarity: polarityToNumber(article.polarity),
  horizon: article.horizon,
  publishedAt: new Date(article.date),
  category: article.domains?.[0] ?? article.articleType,
  relatedTo: [], // Could be enhanced with actual relations
});

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
  background: rgba(0, 30, 60, 0.6);
  border: 1px solid rgba(0, 212, 255, 0.3);
  color: rgba(255, 255, 255, 0.8);
  padding: 6px 12px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 1000;
  transition: all 0.2s ease;
  backdrop-filter: blur(5px);

  &:hover {
    background: rgba(0, 50, 80, 0.8);
    border-color: rgba(0, 212, 255, 0.6);
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
  onExit?: () => void;
}

interface SceneryOption {
  id: string;
  name: string;
  type: 'image';
  path: string;
}

const ThreeSixty: React.FC<ThreeSixtyProps> = ({ currentImage, isDialogOpen, onChangeImage, onGameStateChange, onExit }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isLowEndDevice, setIsLowEndDevice] = useState(false);

  // Cinematic intro state - always show intro for consistent experience
  const [showCinematicIntro, setShowCinematicIntro] = useState(false); // Disabled for now
  const [cinematicComplete, setCinematicComplete] = useState(true); // Always start ready
  const [cinematicProgress, setCinematicProgress] = useState(0);

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

  // 3D Exploration state
  const [is3DExploreActive, setIs3DExploreActive] = useState(false);
  const [isArticleDisplayOpen, setIsArticleDisplayOpen] = useState(false);
  const [enhancedArticles, setEnhancedArticles] = useState<EnhancedArticleData[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<EnhancedArticleData | null>(null);

  // Journey tracking
  const { completeQuest, updateStats, currentQuest } = useJourney();

  // Article discovery - hide floating button during game
  const { setShowFloatingButton } = useArticleDiscovery();

  // Hide the floating discovery button during game play
  useEffect(() => {
    if (gameState === 'PLAYING' || gameState === 'COUNTDOWN') {
      setShowFloatingButton(false);
    } else {
      setShowFloatingButton(true);
    }
  }, [gameState, setShowFloatingButton]);


  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Detect low-end devices
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

    return options;
  }, [currentImage]);

  // Handle scenery change from tablet
  const handleSceneryChange = useCallback((scenery: SceneryOption) => {
      onChangeImage(scenery.path);
  }, [onChangeImage]);

  // Get current scenery path for tablet display
  const currentSceneryPath = currentImage;

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

  // Fetch enhanced articles for 3D exploration and archive display
  useEffect(() => {
    // Fetch articles when either 3D explore or archive display is active
    if ((is3DExploreActive || isArticleDisplayOpen) && enhancedArticles.length === 0) {
      fetch('/api/articles-enhanced')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setEnhancedArticles(data);
          }
        })
        .catch(err => console.error('Failed to fetch enhanced articles:', err));
    }
  }, [is3DExploreActive, isArticleDisplayOpen, enhancedArticles.length]);

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
    if (isMobile || isLowEndDevice) {
      return [0.3, 0.8];
    }
    return [0.5, 1.5];
  }, [isMobile, isLowEndDevice]);

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

  // 3D Exploration handlers
  const handleToggle3DExplore = useCallback(() => {
    setIs3DExploreActive(prev => !prev);
    setSelectedArticle(null);
  }, []);

  const handleSelectArticle = useCallback((article: EnhancedArticleData | null) => {
    setSelectedArticle(article);
  }, []);

  const handleNavigateToArticle = useCallback(() => {
    if (selectedArticle) {
      window.location.href = `/articles/${selectedArticle.slug}`;
    }
  }, [selectedArticle]);

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

              {/* Background: Use sphere */}
              {!is3DExploreActive && (
                 <BackgroundSphere imageUrl={currentImage} transitionDuration={0.5} />
              )}

              {/* 3D Article Explorer - Immersive InfiniteLibrary Experience */}
              {is3DExploreActive && enhancedArticles.length > 0 && (
                <InfiniteLibrary
                  articles={enhancedArticles.map(mapToLibraryArticle)}
                  theme={COSMIC_LIBRARY}
                  quality={isMobile || isLowEndDevice ? 'low' : 'high'}
                  layout="constellation"
                  radius={25}
                  onArticleSelect={(article) => {
                    const enhanced = enhancedArticles.find(a => a.slug === article.id);
                    if (enhanced) handleSelectArticle(enhanced);
                  }}
                  selectedArticleId={selectedArticle?.slug}
                />
              )}

              {/* Article Display Panel */}
              <ArticleDisplayPanel
                articles={enhancedArticles}
                isOpen={isArticleDisplayOpen}
                onClose={() => setIsArticleDisplayOpen(false)}
              />

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

      {/* Back to Landing Button - Always Visible */}
      {!loading && (
        <button
          onClick={onExit}
          style={{
            position: 'fixed',
            top: '20px',
            left: '20px',
            zIndex: 1000,
            padding: '10px 18px',
            background: 'rgba(10, 10, 16, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '8px',
            color: '#00d4ff',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'monospace',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.6)';
            e.currentTarget.style.transform = 'translateX(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(10, 10, 16, 0.85)';
            e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.3)';
            e.currentTarget.style.transform = 'translateX(0)';
          }}
          aria-label="Return to landing page"
        >
          <span style={{ fontSize: '16px' }}>←</span>
          <span>Home</span>
        </button>
      )}

      {/* Help Button with Keyboard Shortcuts */}
      {!loading && <HelpButton />}

      {/* Pip-Boy style tablet - slides up from bottom */}
      {!loading && (
        <InteractiveTablet
          isGamePlaying={gameState === 'PLAYING' || gameState === 'COUNTDOWN'}
          articles={articles}
          onStartGame={handleStartGame}
          onChangeScenery={handleSceneryChange}
          availableScenery={sceneryOptions}
          currentScenery={currentSceneryPath}
          onToggle3DExplore={handleToggle3DExplore}
          is3DExploreActive={is3DExploreActive}
          onToggleArticleDisplay={() => setIsArticleDisplayOpen(!isArticleDisplayOpen)}
          isArticleDisplayOpen={isArticleDisplayOpen}
          onExitToLanding={onExit}
        />
      )}

      {/* Article Detail Panel for 3D Exploration */}
      {is3DExploreActive && selectedArticle && (
        <ArticleDetailPanel
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onNavigate={handleNavigateToArticle}
        />
      )}

      {/* Director's Intro - GLSL shader experience */}
      {showCinematicIntro && !cinematicComplete && (
        <DirectorsIntro
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
