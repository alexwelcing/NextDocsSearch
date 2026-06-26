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
}

export default function Interactive3DExperience({ onExit }: Interactive3DExperienceProps) {
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
    <main className={`${styles.main} ${styles.gradientbg}`}>
      <Scene3D world={worldConfig} quality="medium" />

      <div className="fixed left-4 top-4 z-[1000] flex flex-wrap gap-3">
        {onExit && (
          <button
            onClick={handleExit}
            className="rounded-md border border-white/15 bg-black/45 px-4 py-2 text-sm text-white/75 backdrop-blur hover:bg-white/10 hover:text-white"
          >
            Back to Explore
          </button>
        )}
        <Link
          href="/articles"
          className="rounded-md border border-cyan-300/25 bg-cyan-950/40 px-4 py-2 text-sm text-cyan-100 backdrop-blur hover:bg-cyan-400/15"
        >
          Read Articles
        </Link>
      </div>
    </main>
  )
}
