import React from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { GetStaticProps } from 'next'
import { JourneyProvider } from '@/components/contexts/JourneyContext'
import { SupabaseDataProvider } from '@/components/contexts/SupabaseDataContext'
import StructuredData from '@/components/StructuredData'
import { scanArticles } from '@/lib/articles'
import type { ArticleMeta } from '@/lib/articles'

const Scene3D = dynamic(() => import('@/components/scene/Scene3D'), {
  ssr: false,
  loading: () => (
    <div style={{
      minHeight: '100vh',
      background: '#030308',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#e5e5e5',
      fontFamily: 'monospace',
    }}>
      <div>Loading Idea Space...</div>
    </div>
  ),
})

const IdeaExperience = dynamic(() => import('@/components/ideas/IdeaExperience'), {
  ssr: false,
})

interface IdeasPageProps {
  articles: Array<{
    title: string
    date: string
    author: string[]
    filename?: string
    length?: number
  }>
}

export default function IdeasPage({ articles }: IdeasPageProps) {
  return (
    <SupabaseDataProvider>
      <JourneyProvider>
        <Head>
          <title>Idea Space | Alex Welcing</title>
          <meta
            name="description"
            content="Explore ideas as a spatial constellation. An immersive 3D experience for navigating articles, concepts, and creative tools."
          />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href="https://www.alexwelcing.com/ideas" />
          <meta property="og:title" content="Idea Space | Alex Welcing" />
          <meta property="og:description" content="Explore ideas as a spatial constellation." />
          <meta property="og:image" content="https://www.alexwelcing.com/social-preview.png" />
          <meta property="og:url" content="https://www.alexwelcing.com/ideas" />
          <meta property="og:type" content="website" />
        </Head>

        <StructuredData
          type="Website"
          data={{
            name: 'Idea Space — Alex Welcing',
            url: 'https://www.alexwelcing.com/ideas',
            description: 'Immersive 3D idea constellation for exploring articles and concepts.',
          }}
        />

        <main style={{ width: '100vw', height: '100vh', background: '#030308' }}>
          <Scene3D world="default">
            <IdeaExperience articles={articles} isActive />
          </Scene3D>
        </main>
      </JourneyProvider>
    </SupabaseDataProvider>
  )
}

export const getStaticProps: GetStaticProps = async () => {
  const allArticles = scanArticles()

  const articles = allArticles.slice(0, 10).map((article) => ({
    title: article.title,
    date: article.date,
    author: ['Alex Welcing'],
    filename: article.slug,
    length: article.description?.length || 0,
  }))

  return {
    props: { articles },
  }
}
