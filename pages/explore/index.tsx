import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import StylishFallback from '@/components/StylishFallback'

const Interactive3DExperience = dynamic(() => import('@/components/3d/Interactive3DExperience'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

export default function ExplorePage() {
  const router = useRouter()

  return (
    <>
      <Head>
        <title>Explore the Interactive Layer | Alex Welcing</title>
        <meta name="robots" content="noindex, follow" />
      </Head>
      <Interactive3DExperience onExit={() => router.push('/')} />
    </>
  )
}
