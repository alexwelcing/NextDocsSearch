import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { getRandomBackgroundImage } from '@/lib/backgroundImages'

const ThreeSixty = dynamic(() => import('@/components/3d/scene/ThreeSixty'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#030308] text-white/60 text-sm">
      Loading Experience…
    </div>
  ),
})

interface Interactive3DExperienceProps {
  onExit?: () => void
}

export default function Interactive3DExperience({ onExit }: Interactive3DExperienceProps) {
  const [currentImage] = useState(() => getRandomBackgroundImage())

  return (
    <ThreeSixty
      currentImage={currentImage}
      isDialogOpen={false}
      onChangeImage={() => {}}
      onExit={onExit}
    />
  )
}
