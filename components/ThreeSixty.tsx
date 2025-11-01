import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { createXRStore, XR, XROrigin, XRSpace, useXRSessionModeSupported } from '@react-three/xr';
import styled, { css, keyframes } from 'styled-components';
import { Physics } from '@react-three/cannon';
import { OrbitControls, Stats } from '@react-three/drei';
import PhysicsGround from './PhysicsGround';
import BackgroundSphere from './BackgroundSphere';
import GlowingArticleDisplay, { ArticleData } from './GlowingArticleDisplay';
import RoundedRectangle from './RoundedRectangle';
import ResponseDisplay from './ResponseDisplay';
import GaussianSplatBackground from './GaussianSplatBackground';
import InteractiveTablet from './InteractiveTablet';
import ClickingGame, { GameState, GameStats } from './ClickingGame';
import GameHUD from './GameHUD';
import GameStartOverlay from './GameStartOverlay';
import GameLeaderboard from './GameLeaderboard';
import BouncingBall from './BouncingBall';
import PerformanceMonitor from './PerformanceMonitor';
import CameraController from './CameraController';
import SeasonalEffects from './SeasonalEffects';
import { getCurrentSeason, getSeasonalTheme, Season, SeasonalTheme } from '../lib/theme/seasonalTheme';

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

const StyledButton = styled.button`
  background: #de7ea2;
  border: 3px solid #6a6699;
  opacity: 80%;
  color: white;
  cursor: pointer;
  font-size: 24px;
  border-radius: 10px;
  align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: scale(1.05);
    background: #941947;
    opacity: 80%;
  }
`

const VRButtonStyled = styled.button`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #8214a0;
  border: 3px solid #de7ea2;
  color: white;
  padding: 15px 30px;
  font-size: 18px;
  border-radius: 10px;
  cursor: pointer;
  z-index: 1000;
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateX(-50%) scale(1.05);
    background: #941947;
    box-shadow: 0 0 20px rgba(222, 126, 162, 0.5);
  }

  &:disabled {
    background: #666;
    cursor: not-allowed;
    opacity: 0.5;
  }
`

const BackgroundControlsContainer = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.7);
  padding: 15px;
  border-radius: 10px;
  border: 2px solid #de7ea2;
  backdrop-filter: blur(10px);
`

const ToggleButton = styled.button<{ active: boolean }>`
  background: ${props => props.active ? '#8214a0' : '#333'};
  border: 2px solid ${props => props.active ? '#de7ea2' : '#666'};
  color: white;
  padding: 10px 20px;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: ${props => props.active ? '#941947' : '#444'};
    transform: scale(1.05);
  }
`

const SplatSelector = styled.select`
  background: #333;
  border: 2px solid #de7ea2;
  color: white;
  padding: 10px;
  font-size: 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: #444;
  }

  option {
    background: #333;
    color: white;
  }
`

const ControlLabel = styled.label`
  color: white;
  font-size: 12px;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 1px;
`

const SeasonIndicator = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 12px 16px;
  border-radius: 8px;
  border: 2px solid #de7ea2;
  backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 8px;
`

const SeasonButton = styled.button<{ active: boolean }>`
  background: ${props => props.active ? '#8214a0' : 'transparent'};
  border: 1px solid ${props => props.active ? '#de7ea2' : '#666'};
  color: white;
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: capitalize;

  &:hover {
    background: ${props => props.active ? '#941947' : '#333'};
    border-color: #de7ea2;
  }
`

const fadeIn = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [useGaussianSplat, setUseGaussianSplat] = useState(false);
  const [availableSplats, setAvailableSplats] = useState<SplatFile[]>([]);
  const [selectedSplat, setSelectedSplat] = useState<string>('');
  const [hasSplats, setHasSplats] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Seasonal theme state (with query param support)
  const [currentSeason, setCurrentSeason] = useState<Season>(() => {
    // Check for season query parameter
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const seasonParam = params.get('season');
      return getCurrentSeason(seasonParam);
    }
    return getCurrentSeason();
  });
  const [seasonalTheme, setSeasonalTheme] = useState<SeasonalTheme>(getSeasonalTheme(currentSeason));

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

    // Listen for URL changes (for SPAs)
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
          // Set first splat as default
          setSelectedSplat(data.splats[0].path);
        }
      } catch (error) {
        console.error("Failed fetching splat files:", error);
      }
    };

    fetchSplats();
  }, []);

  const article = articles[currentIndex];

  const handleEnterVR = async () => {
    try {
      await store.enterVR();
    } catch (error) {
      console.error('Failed to enter VR:', error);
    }
  };

  // Game handlers
  // Step 1: Bouncing ball click shows overlay (STARTING state)
  const handleBallClick = useCallback(() => {
    setGameState('STARTING');
  }, []);

  // Step 2: User clicks "Start" in overlay - begin countdown
  const handleGameStart = useCallback(() => {
    setGameState('COUNTDOWN');
    setCountdown(3);
    setScore(0);
    setCombo(0);
    
    // Countdown: 3, 2, 1, GO!
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // After countdown, start the game
          setTimeout(() => {
            setGameState('PLAYING');
            setTimeRemaining(30);
          }, 500); // Brief pause on "GO!"
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
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameState('IDLE');
    setTimeout(() => {
      handleBallClick();
    }, 100);
  }, [handleBallClick]);

  const handleCloseLeaderboard = useCallback(() => {
    setGameState('IDLE');
  }, []);

  // Handle season change
  const handleSeasonChange = useCallback((season: Season) => {
    const url = new URL(window.location.href);
    url.searchParams.set('season', season);
    window.history.pushState({}, '', url.toString());
    setCurrentSeason(season);
    setSeasonalTheme(getSeasonalTheme(season));
  }, []);

  const handleSeasonReset = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('season');
    window.history.pushState({}, '', url.toString());
    const defaultSeason = getCurrentSeason();
    setCurrentSeason(defaultSeason);
    setSeasonalTheme(getSeasonalTheme(defaultSeason));
  }, []);

  return (
    <ThreeSixtyContainer>
      {/* Only show VR button if device supports VR */}
      {isVRSupported && (
        <VRButtonStyled onClick={handleEnterVR}>
          Enter VR
        </VRButtonStyled>
      )}

      {/* Background Controls - Only show if splats are detected AND not playing game or countdown */}
      {hasSplats && gameState !== 'PLAYING' && gameState !== 'COUNTDOWN' && (
        <BackgroundControlsContainer>
          <ControlLabel>Background Mode</ControlLabel>
          <div style={{ display: 'flex', gap: '8px' }}>
            <ToggleButton
              active={!useGaussianSplat}
              onClick={() => setUseGaussianSplat(false)}
            >
              Image
            </ToggleButton>
            <ToggleButton
              active={useGaussianSplat}
              onClick={() => setUseGaussianSplat(true)}
            >
              Splat
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

              {/* Camera controller for smooth game start transition */}
              <CameraController gameState={gameState} />

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

              <ambientLight intensity={0.6} />
              <directionalLight
                position={[10, 10, 5]}
                intensity={0.8}
              />
              <directionalLight
                position={[-10, 10, -5]}
                intensity={0.5}
              />
              <hemisphereLight
                args={['#ffffff', '#8844bb', 0.4]}
                position={[0, 50, 0]}
              />

              {/* Interactive Tablet - replaces old floating UI (GlowingArticleDisplay, RoundedRectangle, ResponseDisplay) */}
              {!loading && (
                <InteractiveTablet
                  initialPosition={[0, 3, 5]}
                  isGamePlaying={gameState === 'PLAYING' || gameState === 'COUNTDOWN'}
                  articles={articles}
                  onStartGame={handleBallClick}
                />
              )}

              {/* XR Controllers - controller models will be automatically rendered by XR component */}
            </PhysicsEnvironment>
          </XROrigin>
        </XR>
        {/* Performance monitoring - visible in development */}
        {process.env.NODE_ENV === 'development' && <Stats />}
      </Canvas>

      {/* Performance Monitor - outside Canvas */}
      {process.env.NODE_ENV === 'development' && <PerformanceMonitor />}

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

      {/* Season Selector - Hidden */}
      <SeasonIndicator style={{ display: 'none' }}>
        <ControlLabel style={{ margin: 0, fontSize: '10px', marginRight: '4px' }}>
          Season:
        </ControlLabel>
        <SeasonButton
          active={currentSeason === 'spring'}
          onClick={() => handleSeasonChange('spring')}
        >
          🌸 Spring
        </SeasonButton>
        <SeasonButton
          active={currentSeason === 'summer'}
          onClick={() => handleSeasonChange('summer')}
        >
          ☀️ Summer
        </SeasonButton>
        <SeasonButton
          active={currentSeason === 'autumn'}
          onClick={() => handleSeasonChange('autumn')}
        >
          🍂 Autumn
        </SeasonButton>
        <SeasonButton
          active={currentSeason === 'winter'}
          onClick={() => handleSeasonChange('winter')}
        >
          ❄️ Winter
        </SeasonButton>
        <SeasonButton
          active={currentSeason === 'halloween'}
          onClick={() => handleSeasonChange('halloween')}
        >
          🎃 Halloween
        </SeasonButton>
        <SeasonButton
          active={currentSeason === 'christmas'}
          onClick={() => handleSeasonChange('christmas')}
        >
          🎄 Christmas
        </SeasonButton>
        <SeasonButton
          active={false}
          onClick={handleSeasonReset}
          style={{ marginLeft: '4px', borderColor: '#888' }}
        >
          Auto
        </SeasonButton>
      </SeasonIndicator>
    </ThreeSixtyContainer>
  );
};

export default ThreeSixty;