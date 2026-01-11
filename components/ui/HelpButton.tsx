/**
 * HelpButton - Keyboard Shortcuts and Help Overlay
 *
 * Always-accessible help button that shows keyboard shortcuts
 * and explains core features.
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, Keyboard } from 'lucide-react';

const HelpButtonContainer = styled.button`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  width: 44px;
  height: 44px;
  padding: 0;
  background: rgba(10, 10, 16, 0.85);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 50%;
  color: #00d4ff;
  cursor: pointer;
  font-size: 20px;
  font-weight: bold;
  font-family: monospace;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  &:hover {
    background: rgba(0, 212, 255, 0.15);
    border-color: rgba(0, 212, 255, 0.6);
    transform: scale(1.05);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const Overlay = styled.div<{ $visible: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 1001;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  display: ${props => props.$visible ? 'flex' : 'none'};
  align-items: center;
  justify-content: center;
  padding: 20px;
  animation: fadeIn 0.2s ease;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const HelpPanel = styled.div`
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  background: rgba(10, 10, 16, 0.95);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
  background: rgba(0, 30, 50, 0.3);
`;

const Title = styled.h2`
  margin: 0;
  font-size: 24px;
  color: #00d4ff;
  font-family: monospace;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 12px;

  svg {
    width: 24px;
    height: 24px;
  }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
  }

  svg {
    width: 20px;
    height: 20px;
  }
`;

const Content = styled.div`
  padding: 24px;
  overflow-y: auto;
  max-height: calc(90vh - 100px);
  color: #e0e0ff;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.6;

  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 212, 255, 0.3);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 212, 255, 0.5);
  }
`;

const Section = styled.div`
  margin-bottom: 32px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #00d4ff;
  font-weight: 600;
  border-bottom: 1px solid rgba(0, 212, 255, 0.2);
  padding-bottom: 8px;
`;

const ShortcutList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ShortcutItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 212, 255, 0.05);
    border-color: rgba(0, 212, 255, 0.2);
  }
`;

const ShortcutDesc = styled.span`
  color: #ccc;
  font-size: 14px;
`;

const ShortcutKey = styled.kbd`
  display: inline-block;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(0, 212, 255, 0.3);
  border-radius: 4px;
  color: #00d4ff;
  font-family: monospace;
  font-size: 13px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const FeatureList = styled.ul`
  margin: 0;
  padding-left: 20px;
  color: #aaa;

  li {
    margin-bottom: 8px;
    line-height: 1.5;
  }

  strong {
    color: #00d4ff;
  }
`;

export default function HelpButton() {
  const [isOpen, setIsOpen] = useState(false);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
      // Open help with ? or F1
      if ((e.key === '?' || e.key === 'F1') && !isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <HelpButtonContainer
        onClick={() => setIsOpen(true)}
        aria-label="Open help and keyboard shortcuts"
        title="Help (Press ? or F1)"
      >
        <span>?</span>
      </HelpButtonContainer>

      <Overlay $visible={isOpen} onClick={() => setIsOpen(false)}>
        <HelpPanel onClick={(e) => e.stopPropagation()}>
          <Header>
            <Title>
              <Keyboard />
              Help & Shortcuts
            </Title>
            <CloseButton onClick={() => setIsOpen(false)} aria-label="Close help">
              <X />
            </CloseButton>
          </Header>

          <Content>
            <Section>
              <SectionTitle>Keyboard Shortcuts</SectionTitle>
              <ShortcutList>
                <ShortcutItem>
                  <ShortcutDesc>Open/Close Terminal Menu</ShortcutDesc>
                  <ShortcutKey>TAB</ShortcutKey>
                </ShortcutItem>
                <ShortcutItem>
                  <ShortcutDesc>Close Panels/Menus</ShortcutDesc>
                  <ShortcutKey>ESC</ShortcutKey>
                </ShortcutItem>
                <ShortcutItem>
                  <ShortcutDesc>Open Help</ShortcutDesc>
                  <ShortcutKey>?</ShortcutKey>
                </ShortcutItem>
                <ShortcutItem>
                  <ShortcutDesc>Return to Home</ShortcutDesc>
                  <ShortcutKey>Click top-left button</ShortcutKey>
                </ShortcutItem>
              </ShortcutList>
            </Section>

            <Section>
              <SectionTitle>Navigation</SectionTitle>
              <FeatureList>
                <li><strong>← Home Button</strong> (top-left) - Return to landing page</li>
                <li><strong>? Help Button</strong> (top-right) - View this help panel</li>
                <li><strong>NAVIGATE Button</strong> (bottom-center) - Open terminal menu</li>
                <li><strong>Terminal Tabs</strong> - Switch between features</li>
              </FeatureList>
            </Section>

            <Section>
              <SectionTitle>Features</SectionTitle>
              <FeatureList>
                <li><strong>EXPLORE Tab</strong> - Browse and search articles</li>
                <li><strong>3D Galaxy View</strong> - Visualize articles in 3D space</li>
                <li><strong>Article Panel</strong> - Floating panel with article carousel</li>
                <li><strong>GAME Tab</strong> - Play the clicking mini-game</li>
                <li><strong>SCENE Tab</strong> - Change 3D background environment</li>
                <li><strong>CHAT Tab</strong> - AI chat interface (if available)</li>
                <li><strong>ABOUT Tab</strong> - Information and mission brief</li>
              </FeatureList>
            </Section>

            <Section>
              <SectionTitle>Tips</SectionTitle>
              <FeatureList>
                <li>Click and drag to rotate the 3D view</li>
                <li>Scroll to zoom in/out in 3D mode</li>
                <li>Use filters in EXPLORE tab to find specific articles</li>
                <li>3D Galaxy View shows articles as floating orbs</li>
                <li>Article Panel displays full article previews</li>
              </FeatureList>
            </Section>

            <Section>
              <SectionTitle>About</SectionTitle>
              <FeatureList>
                <li>Built with Next.js, React, and Three.js</li>
                <li>Exploring speculative AI futures and emergent intelligence</li>
                <li>Press <ShortcutKey>ESC</ShortcutKey> to close this help panel</li>
              </FeatureList>
            </Section>
          </Content>
        </HelpPanel>
      </Overlay>
    </>
  );
}
