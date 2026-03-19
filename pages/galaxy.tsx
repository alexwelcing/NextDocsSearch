/**
 * Galaxy Page - Meta-navigation layer for all worlds
 * 
 * This is the entry point to the galaxy view - a cosmic map of all
 * immersive destinations across the site.
 */

import dynamic from 'next/dynamic';
import Head from 'next/head';
import styled from 'styled-components';

// Dynamic import to prevent SSR issues with Three.js
const GalaxyView = dynamic(
  () => import('@/components/galaxy/GalaxyScene'),
  { ssr: false, loading: () => <LoadingScreen /> }
);

const LoadingScreen = styled.div`
  position: fixed;
  inset: 0;
  background: #030308;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #00d4ff;
  font-family: var(--font-mono, monospace);
  font-size: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  
  &::after {
    content: '';
    animation: pulse 1.5s infinite;
  }
  
  @keyframes pulse {
    0%, 100% { content: ''; }
    33% { content: '.'; }
    66% { content: '..'; }
  }
`;

export default function GalaxyPage() {
  return (
    <>
      <Head>
        <title>Galaxy View | Alex Welcing</title>
        <meta name="description" content="Explore all worlds in the galaxy - immersive scenes, articles, games, and memories." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#030308" />
      </Head>
      
      <GalaxyView />
    </>
  );
}
