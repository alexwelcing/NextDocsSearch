import React, { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import StylishFallback from '@/components/StylishFallback'
import { getRandomBackgroundImage } from '@/lib/backgroundImages'
import styles from '@/styles/Home.module.css'

const Scene3D = dynamic(() => import('@/components/scene/Scene3D'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

interface Interactive3DExperienceProps {
  onExit?: () => void
  exitLabel?: string
}

export default function Interactive3DExperience({ onExit, exitLabel = 'Back to Home' }: Interactive3DExperienceProps) {
  const [currentImage] = useState(() => getRandomBackgroundImage())

  const worldConfig = useMemo(
    () => ({
      id: 'dynamic-home',
      name: 'Dynamic Home',
      assets: {
        fallbackPanorama: currentImage,
      },
    }),
    [currentImage]
  )

  const handleExit = useCallback(() => {
    onExit?.()
  }, [onExit])

  return (
    <div className="fixed inset-0 z-[100] bg-[#030308]">
      <main className={`${styles.main} ${styles.gradientbg}`}>
        <Scene3D world={worldConfig} quality="medium" />
      </main>

      {/* Control UI — rendered as a sibling so it always sits above the canvas */}
      <div className="fixed left-4 top-4 z-[1000] flex flex-wrap gap-3">
        {onExit && (
          <button
            onClick={handleExit}
            className="rounded-md border border-white/30 bg-black/80 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur hover:bg-white/20 hover:text-white transition"
          >
            {exitLabel}
          </button>
        )}
        <Link
          href="/articles"
          className="rounded-md border border-cyan-400/50 bg-cyan-950/80 px-4 py-2 text-sm font-medium text-cyan-100 shadow-lg backdrop-blur hover:bg-cyan-400/25 transition"
        >
          Read Articles
        </Link>
      </div>

      <div className="fixed bottom-6 left-1/2 z-[1000] -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-5 py-2 text-xs text-white/80 shadow-lg backdrop-blur pointer-events-none">
        Drag to look • Scroll to zoom • WASD to move
      </div>
    </div>
  )
}
