import Head from 'next/head';
import dynamic from 'next/dynamic';
import StylishFallback from '@/components/StylishFallback';

const CharacterStudio = dynamic(() => import('@/components/CharacterStudio'), {
  ssr: false,
  loading: () => <StylishFallback />,
});

export default function CharacterStudioPage() {
  return (
    <>
      <Head>
        <title>Character Studio - Create Animated 3D Characters | Alex Welcing</title>
        <meta
          name="description"
          content="Generate rigged and animated 3D characters from text descriptions using Gaussian splatting and procedural mesh generation"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="w-full h-screen">
        <CharacterStudio />
      </main>
    </>
  );
}
