/**
 * New Index Page - Arcade-style Content Exploration
 *
 * Main entry point for the new world-based navigation system.
 * Replace index.tsx with this file when ready to deploy.
 */

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import TrophyUI from '@/components/TrophyUI';
import { useTrophy } from '@/components/TrophyContext';

// Dynamically import WorldExplorer (client-side only)
const WorldExplorer = dynamic(() => import('@/components/WorldExplorer'), {
  ssr: false,
  loading: () => <LoadingScreen>Loading Universe...</LoadingScreen>,
});

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false);
  const router = useRouter();
  const { markArticleRead } = useTrophy();

  // Detect mobile and prevent scroll
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        )
      );
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    return () => {
      window.removeEventListener('resize', checkMobile);
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, []);

  // Handle article selection from world view
  const handleArticleSelect = (slug: string) => {
    // Navigate to article page
    router.push(`/articles/${slug}`);
  };

  return (
    <>
      <Head>
        <title>Alex Welcing - AI Product Manager</title>
        <meta
          name="description"
          content="Navigate through space to explore AI product insights. Built like an arcade game because documentation should be fun."
        />
        <meta
          name="keywords"
          content="Alex Welcing, Product Management, AI, Interactive Portfolio"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://alexwelcing.com" />
        <link rel="icon" href="/favicon.ico" />

        {/* Open Graph Meta Tags */}
        <meta property="og:title" content="Alex Welcing - AI Product Manager" />
        <meta
          property="og:description"
          content="Navigate through space to explore AI product insights. Built like an arcade game because documentation should be fun."
        />
        <meta property="og:image" content="/social-preview.png" />
        <meta property="og:url" content="https://alexwelcing.com" />
        <meta property="og:type" content="website" />
      </Head>

      <Container>
        {/* Trophy System UI */}
        <TrophyUI />

        {/* Main World Explorer */}
        <WorldExplorer
          isMobile={isMobile}
          onArticleSelect={handleArticleSelect}
        />

        {/* Help overlay for first-time users */}
        <HelpOverlay />
      </Container>
    </>
  );
}

// Help Overlay Component
const HelpOverlay: React.FC = () => {
  const [showHelp, setShowHelp] = useState(false);
  const [hasSeenHelp, setHasSeenHelp] = useState(false);

  useEffect(() => {
    // Check if user has seen help before
    const seen = sessionStorage.getItem('help_seen');
    if (!seen) {
      setShowHelp(true);
      setHasSeenHelp(false);
    } else {
      setHasSeenHelp(true);
    }
  }, []);

  const handleDismiss = () => {
    setShowHelp(false);
    setHasSeenHelp(true);
    sessionStorage.setItem('help_seen', 'true');
  };

  if (!showHelp && hasSeenHelp) {
    return (
      <HelpButton onClick={() => setShowHelp(true)}>
        ?
      </HelpButton>
    );
  }

  if (!showHelp) return null;

  return (
    <HelpModal onClick={handleDismiss}>
      <HelpContent onClick={(e) => e.stopPropagation()}>
        <HelpTitle>Your docs shouldn&apos;t be boring</HelpTitle>
        <HelpText>
          <p>So I built mine like a space shooter.</p>
          <p>Tap the glowing clusters. Read about AI product management. Watch the fog clear as you unlock each world.</p>
          <p><em>Session-based. No tracking. Just exploration.</em></p>
        </HelpText>
        <HelpCloseButton onClick={handleDismiss}>
          Start
        </HelpCloseButton>
      </HelpContent>
    </HelpModal>
  );
};

// Styled Components

const Container = styled.div`
  width: 100%;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
  background: #000308;
  touch-action: none;
`;

const LoadingScreen = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000308;
  color: white;
  font-size: 24px;
  font-family: Arial, sans-serif;
`;

const HelpButton = styled.button`
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 100;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.8);
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: white;
  font-size: 24px;
  font-weight: bold;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.95);
    border-color: rgba(255, 255, 255, 0.6);
    transform: scale(1.1);
  }

  @media (max-width: 768px) {
    bottom: 10px;
    right: 10px;
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
`;

const HelpModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(10px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  cursor: pointer;
`;

const HelpContent = styled.div`
  max-width: 600px;
  background: linear-gradient(135deg, rgba(20, 20, 40, 0.95), rgba(10, 10, 30, 0.95));
  border: 2px solid rgba(100, 100, 200, 0.5);
  border-radius: 20px;
  padding: 40px;
  cursor: default;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);

  @media (max-width: 768px) {
    padding: 24px;
    max-width: 90%;
  }
`;

const HelpTitle = styled.h2`
  font-size: 32px;
  color: white;
  margin: 0 0 20px 0;
  text-align: center;

  @media (max-width: 768px) {
    font-size: 24px;
  }
`;

const HelpText = styled.div`
  color: rgba(255, 255, 255, 0.9);
  font-size: 16px;
  line-height: 1.6;

  p {
    margin: 0 0 16px 0;
  }

  ul {
    margin: 0 0 16px 0;
    padding-left: 20px;
  }

  li {
    margin-bottom: 12px;
  }

  strong {
    color: #7b2ff7;
  }

  em {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
  }

  @media (max-width: 768px) {
    font-size: 14px;
  }
`;

const HelpCloseButton = styled.button`
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #7b2ff7, #4a9eff);
  border: none;
  border-radius: 12px;
  color: white;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(123, 47, 247, 0.5);
  }

  @media (max-width: 768px) {
    font-size: 16px;
    padding: 14px;
  }
`;
