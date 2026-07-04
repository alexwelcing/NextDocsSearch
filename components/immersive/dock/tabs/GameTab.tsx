// GAME: Sphere Hunter launcher + leaderboard. The game itself runs out in the scene; this tab
// arms it, shows the standing orders, and lists the top scores.

import { useEffect, useState } from 'react'
import { WindfoilText } from '../../text/WindfoilText'
import { ScreenHeader, ScreenHints } from '../widgets/ScreenChrome'
import { useTabKeys } from '../useTabKeys'
import { useImmersiveStore } from '@/stores/immersiveStore'
import { playSound } from '@/lib/immersive/audio'
import { ARC, FONT, TYPE, rgba } from '@/lib/immersive/theme'
import { stopLook } from '../DockKey'

interface ScoreRow {
  player_name?: string
  name?: string
  score: number
}

export function GameTab({ active, width }: { active: boolean; width: number }) {
  const gameActive = useImmersiveStore((s) => s.gameActive)
  const setGameActive = useImmersiveStore((s) => s.setGameActive)
  const setDockOpen = useImmersiveStore((s) => s.setDockOpen)
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [scoresState, setScoresState] = useState<'loading' | 'ok' | 'offline'>('loading')

  useEffect(() => {
    let live = true
    fetch('/api/game/get-leaderboard')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('offline'))))
      .then((d: { leaderboard?: ScoreRow[]; scores?: ScoreRow[] }) => {
        if (!live) return
        setScores((d.leaderboard ?? d.scores ?? []).slice(0, 5))
        setScoresState('ok')
      })
      .catch(() => live && setScoresState('offline'))
    return () => {
      live = false
    }
  }, [gameActive])

  const toggle = () => {
    playSound(gameActive ? 'close' : 'confirm')
    setGameActive(!gameActive)
    if (!gameActive) setDockOpen(false) // clear the view for the hunt
  }

  useTabKeys(active, (e) => {
    if (e.key === 'Enter') {
      toggle()
      return true
    }
    return false
  })

  return (
    <group>
      <ScreenHeader title="SPHERE HUNTER" right={gameActive ? '● ACTIVE' : 'ARMED'} width={width} />
      <WindfoilText
        font={FONT.mono}
        fontSize={TYPE.body}
        color={rgba(ARC.green, 0.85)}
        position={[0, -0.055, 0]}
        maxWidth={width}
        lineHeight={1.35}
      >
        {'CONTRACT: DESTROY DRIFTING SPHERES.\n60 SECONDS. COMBO MULTIPLIERS FOR FAST HANDS.\nSCORES FILE TO THE PUBLIC LEDGER.'}
      </WindfoilText>

      {/* big fire-control button */}
      <group position={[width / 2, -0.19, 0]}>
        <mesh
          onPointerDown={(e) => {
            stopLook(e)
            toggle()
          }}
          onPointerOver={(e) => e.stopPropagation()}
        >
          <planeGeometry args={[0.3, 0.05]} />
          <meshBasicMaterial color={gameActive ? '#3a1410' : ARC.greenFaint} />
        </mesh>
        <WindfoilText
          font={FONT.display}
          fontSize={0.03}
          color={gameActive ? rgba(ARC.red) : rgba(ARC.greenBright)}
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.0003]}
        >
          {gameActive ? 'ABORT HUNT' : 'BEGIN HUNT'}
        </WindfoilText>
      </group>

      <group position={[0, -0.245, 0]}>
        <WindfoilText font={FONT.mono} fontSize={TYPE.micro} color={rgba(ARC.greenDim)}>
          {scoresState === 'offline'
            ? 'LEDGER OFFLINE'
            : scoresState === 'loading'
              ? 'READING LEDGER…'
              : 'TOP HUNTERS:'}
        </WindfoilText>
        {scores.map((s, i) => (
          <WindfoilText
            key={i}
            font={FONT.mono}
            fontSize={TYPE.micro}
            color={rgba(i === 0 ? ARC.amber : ARC.green, 0.75)}
            position={[0.12 + (i % 3) * 0.16, -Math.floor(i / 3) * 0.022, 0]}
            maxLines={1}
            maxWidth={0.15}
          >
            {`${(s.player_name ?? s.name ?? '???').toUpperCase().slice(0, 8)} ${s.score}`}
          </WindfoilText>
        ))}
      </group>
      <ScreenHints text="ENTER TOGGLE HUNT" width={width} />
    </group>
  )
}
