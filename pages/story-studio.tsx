import Head from 'next/head';
import dynamic from 'next/dynamic';
import StylishFallback from '@/components/StylishFallback';

const Character360Story = dynamic(() => import('@/components/Character360Story'), {
  ssr: false,
  loading: () => <StylishFallback />,
});

export default function StoryStudioPage() {
  return (
    <>
      <Head>
        <title>360° Story Studio - Interactive Character Stories | Alex Welcing</title>
        <meta
          name="description"
          content="Create interactive 360-degree stories with rigged animated characters"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="w-full h-screen">
        <Character360Story />
      </main>
    </>
  );
}
