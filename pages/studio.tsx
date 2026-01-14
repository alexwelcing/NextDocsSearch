
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="w-full h-screen bg-black">
        <SuperStudio />
      </main>
    </>
  );
}
