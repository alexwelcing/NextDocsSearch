import React from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import StylishFallback from '@/components/StylishFallback'
import StructuredData from '@/components/StructuredData'
import { SITE_URL } from '@/lib/site-url'

const Interactive3DExperience = dynamic(() => import('@/components/3d/Interactive3DExperience'), {
  ssr: false,
  loading: () => <StylishFallback />,
})

export default function HomePage() {
  const siteUrl = SITE_URL

  return (
    <>
      <Head>
        <title>Alex Welcing</title>
        <meta
          name="description"
          content="Explore Alex Welcing's interactive 360 scene, essays on speculative AI, and emergent intelligence research."
        />
        <meta
          name="keywords"
          content="Alex Welcing, speculative AI, emergent intelligence, LLM, AI agents, essays, 3D visualization"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={siteUrl} />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:title" content="Alex Welcing" />
        <meta
          property="og:description"
          content="Interactive 360 scene and essays on speculative AI and emergent intelligence."
        />
        <meta property="og:image" content={`${siteUrl}/social-preview.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:type" content="website" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Alex Welcing" />
        <meta
          name="twitter:description"
          content="Interactive 360 scene and essays on speculative AI and emergent intelligence."
        />
        <meta name="twitter:image" content={`${siteUrl}/social-preview.png`} />
        <meta name="theme-color" content="#0a0a0a" />
      </Head>

      <StructuredData
        type="Website"
        data={{
          name: 'Alex Welcing',
          url: siteUrl,
          description:
            'Interactive 360 scene and essays on speculative AI and emergent intelligence.',
          author: { '@type': 'Person', name: 'Alex Welcing', url: `${siteUrl}/about` },
        }}
      />

      <StructuredData
        type="Person"
        data={{
          name: 'Alex Welcing',
          url: siteUrl,
          description:
            'Building with AI products that help people survive. Writing on speculative AI and emergent intelligence.',
          sameAs: [
            'https://www.linkedin.com/in/alexwelcing',
            'https://github.com/alexwelcing',
            'https://x.com/alexwelcing',
          ],
          knowsAbout: [
            'Large Language Models',
            'AI Agent Systems',
            'Retrieval-Augmented Generation',
            'Vector Databases',
            'AI Product Management',
            'Prompt Engineering',
            'AI Safety & Alignment',
            '3D Visualization',
            'System Architecture',
            'TypeScript',
            'React',
            'Next.js',
          ],
        }}
      />

      <h1
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Alex Welcing — Interactive 360 AI scene.
      </h1>

      <Interactive3DExperience />
    </>
  )
}
