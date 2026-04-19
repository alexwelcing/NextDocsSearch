import React, { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import StylishFallback from '@/components/StylishFallback'
import GameHUD from '@/components/overlays/GameHUD'
import GameLeaderboard from '@/components/overlays/GameLeaderboard'
import InteractiveTablet from '@/components/3d/interactive/InteractiveTablet'
import ArticleDisplayPanel from '@/components/3d/interactive/ArticleDisplayPanel'
import { useJourney } from '@/components/contexts/JourneyContext'
import { getRandomBackgroundImage } from '@/lib/backgroundImages'
import styles from '@/styles/Home.module.css'
import type { GameState, GameStats } from '@/components/3d/game/ClickingGame'

const Scene3D = dynamic(() => import('@/components/scene/Scene3D'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

interface Interactive3DExperienceProps {
  onExit?: () => void
}

export default function Interactive3DExperience({ onExit }: Interactive3DExperienceProps) {
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [articles, setArticles] = useState<any[]>([])
  const [isArticleDisplayOpen, setIsArticleDisplayOpen] = useState(false)

  const [gameState, setGameState] = useState<GameState>('IDLE')
  const [score, setScore] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [combo, setCombo] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [gameStats, setGameStats] = useState<GameStats>({
    score: 0, comboMax: 0, accuracy: 0, totalClicks: 0, successfulClicks: 0,
  })

  const { completeQuest, updateStats, currentQuest } = useJourney()

  const getRandomImage = useCallback(() => {
    setCurrentImage(getRandomBackgroundImage())
  }, [])

  async function fetchArticles() {
    try {
      const response = await fetch('/api/articles')
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }
      const data = await response.json()
      setArticles(data)
    } catch (error) {
      console.error('Failed to fetch articles:', error)
    }
  }

  useEffect(() => {
    getRandomImage()
    fetchArticles()
  }, [getRandomImage])

  const handleStartGame = useCallback(() => {
    setGameState('COUNTDOWN')
    setCountdown(3)
    setScore(0)
    setCombo(0)

    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          setTimeout(() => {
            setGameState('PLAYING')
            setTimeRemaining(30)
          }, 500)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const handleGameEnd = useCallback((finalScore: number, stats: GameStats) => {
    setScore(finalScore)
    setGameStats(stats)
    setGameState('GAME_OVER')
    updateStats('highestGameScore', finalScore)
    if (currentQuest?.id === 'play-game') completeQuest('play-game')
    if (finalScore >= 5000) completeQuest('leaderboard-rank')
  }, [updateStats, currentQuest, completeQuest])

  const handlePlayAgain = useCallback(() => {
    setGameState('IDLE')
    setTimeout(() => handleStartGame(), 100)
  }, [handleStartGame])

  const sceneryOptions = useMemo(() => {
    const options: { id: string; name: string; type: 'image' | 'splat'; path: string }[] = []
    if (currentImage) {
      options.push({ id: 'current-panorama', name: 'Default Panorama', type: 'image', path: currentImage })
    }
    return options
  }, [currentImage])

  const handleSceneryChange = useCallback((scenery: { type: string; path: string }) => {
    if (scenery.type === 'image') {
      setCurrentImage(scenery.path)
    }
  }, [])

  const worldConfig = useMemo(() => {
    if (!currentImage) return 'default'
    return {
      id: 'dynamic-home',
      name: 'Dynamic Home',
      assets: {
        fallbackPanorama: currentImage,
      },
    } as any
  }, [currentImage])

  return (
    <main className={`${styles.main} ${styles.gradientbg}`}>
      <Scene3D
        world={worldConfig}
        articles={articles}
        onGameStateChange={(state: string) => setGameState(state as GameState)}
        gameState={gameState}
        onStartGame={handleStartGame}
        onGameEnd={handleGameEnd}
        onScoreUpdate={setScore}
        onComboUpdate={setCombo}
        onTimeUpdate={setTimeRemaining}
      >
        <ArticleDisplayPanel
          isOpen={isArticleDisplayOpen}
          onClose={() => setIsArticleDisplayOpen(false)}
        />
      </Scene3D>

      <InteractiveTablet
        isGamePlaying={gameState === 'PLAYING' || gameState === 'COUNTDOWN'}
        articles={articles}
        onStartGame={handleStartGame}
        onChangeScenery={handleSceneryChange}
        availableScenery={sceneryOptions}
        currentScenery={currentImage ?? undefined}
        onToggleArticleDisplay={() => setIsArticleDisplayOpen(prev => !prev)}
        isArticleDisplayOpen={isArticleDisplayOpen}
        onExitToLanding={onExit}
      />

      {gameState === 'COUNTDOWN' && (
        <div style={{
          position: 'fixed', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.7)', zIndex: 1000,
        }}>
          <div style={{
            fontSize: '120px', fontWeight: 'bold', color: '#0f0', fontFamily: 'monospace',
          }}>
            {countdown || 'GO'}
          </div>
        </div>
      )}

      {gameState === 'PLAYING' && (
        <GameHUD score={score} timeRemaining={timeRemaining} combo={combo} isPlaying={true} />
      )}

      {gameState === 'GAME_OVER' && (
        <GameLeaderboard
          playerScore={score}
          playerStats={gameStats}
          onPlayAgain={handlePlayAgain}
          onClose={() => setGameState('IDLE')}
        />
      )}
    </main>
  )
}
