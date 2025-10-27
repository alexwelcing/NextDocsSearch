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
import ClickingGame, { GameState, GameStats } from './ClickingGame';
import GameHUD from './GameHUD';
import GameStartOverlay from './GameStartOverlay';
import GameLeaderboard from './GameLeaderboard';

const PhysicsEnvironment: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Physics
      gravity={[0, -9.81, 0]}
      iterations={10}
      tolerance={0.001}
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
}

interface SplatFile {
  filename: string;
  path: string;
  size: number;
}

const ThreeSixty: React.FC<ThreeSixtyProps> = ({ currentImage, isDialogOpen, onChangeImage }) => {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [useGaussianSplat, setUseGaussianSplat] = useState(false);
  const [availableSplats, setAvailableSplats] = useState<SplatFile[]>([]);
  const [selectedSplat, setSelectedSplat] = useState<string>('');
  const [hasSplats, setHasSplats] = useState(false);

  // Game state
  const [gameState, setGameState] = useState<GameState>('IDLE');
  const [score, setScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [combo, setCombo] = useState(0);
  const [gameStats, setGameStats] = useState<GameStats>({
    score: 0,
    comboMax: 0,
    accuracy: 0,
    totalClicks: 0,
    successfulClicks: 0,
  });

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
  const handleGameStart = useCallback(() => {
    setGameState('STARTING');
    setTimeout(() => {
      setGameState('PLAYING');
      setScore(0);
      setTimeRemaining(30);
      setCombo(0);
    }, 100);
  }, []);

  const handleGameEnd = useCallback((finalScore: number, stats: GameStats) => {
    setScore(finalScore);
    setGameStats(stats);
    setGameState('GAME_OVER');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameState('IDLE');
    setTimeout(() => {
      handleGameStart();
    }, 100);
  }, [handleGameStart]);

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

      {/* Background Controls - Only show if splats are detected */}
      {hasSplats && (
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
        shadows
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        gl={{
          powerPreference: 'high-performance',
          antialias: false,
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 2, 10], fov: 60 }}
      >
        <XR store={store}>
          <XROrigin position={[0, 0, 0]}>
            <PhysicsEnvironment>
              <PhysicsGround />
              <OrbitControls
                enableDamping
                dampingFactor={0.05}
                rotateSpeed={0.5}
                zoomSpeed={0.8}
                panSpeed={0.5}
                minDistance={5}
                maxDistance={50}
                maxPolarAngle={Math.PI / 2}
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

              {/* Background: Use Gaussian Splat if enabled, otherwise use sphere */}
              {useGaussianSplat && selectedSplat ? (
                <GaussianSplatBackground
                  splatUrl={selectedSplat}
                  position={[0, 0, 0]}
                  scale={1}
                />
              ) : (
                <BackgroundSphere imageUrl={currentImage} transitionDuration={0.5} />
              )}

              <ambientLight intensity={0.2} position={[-2, 10, 2]} />
              {!loading && (
                <GlowingArticleDisplay
                  articles={articles}
                  article={article}
                  currentIndex={currentIndex}
                  setCurrentIndex={setCurrentIndex}
                  showArticles={true}
                  title="Article Title Placeholder"
                  totalArticles={articles.length}
                />
              )}
              <RoundedRectangle />
              <ResponseDisplay />

              {/* XR Controllers - controller models will be automatically rendered by XR component */}
            </PhysicsEnvironment>
          </XROrigin>
        </XR>
        {/* Performance monitoring - visible in development */}
        {process.env.NODE_ENV === 'development' && <Stats />}
      </Canvas>

      {/* Game UI Overlays */}
      {gameState === 'IDLE' && (
        <GameStartOverlay onStart={handleGameStart} />
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