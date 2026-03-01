
import Head from 'next/head';
import dynamic from 'next/dynamic';
import StylishFallback from '@/components/StylishFallback';

const SuperStudio = dynamic(() => import('@/components/SuperStudio'), {
  ssr: false,
  loading: () => <StylishFallback />,
});

export default function StudioPage() {
  return (
    <>
      <Head>
        <title>Super Studio - Create Infinite Assets | Alex Welcing</title>
        <meta
          name="description"
          content="Generate 3D characters, props, and environments using AI."
        />
        <meta name="keywords" content="AI 3D generation, 3D assets, AI art, creative studio, Alex Welcing" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://www.alexwelcing.com/studio" />
        <link rel="icon" href="/favicon.ico" />
        <meta property="og:title" content="Super Studio - Create Infinite Assets | Alex Welcing" />
        <meta property="og:description" content="Generate 3D characters, props, and environments using AI." />
        <meta property="og:image" content="https://www.alexwelcing.com/social-preview.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://www.alexwelcing.com/studio" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@alexwelcing" />
        <meta name="twitter:title" content="Super Studio - Create Infinite Assets | Alex Welcing" />
        <meta name="twitter:description" content="Generate 3D characters, props, and environments using AI." />
        <meta name="twitter:image" content="https://www.alexwelcing.com/social-preview.png" />
      </Head>
      <main className="w-full h-screen bg-black">
        <SuperStudio />
      </main>
    </>
  );
}
