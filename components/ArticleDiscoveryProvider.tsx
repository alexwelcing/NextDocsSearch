'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { Compass, Star, X } from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import ArticleRecommendationModal from './ArticleRecommendationModal';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

// Animation keyframes
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3), 0 0 40px rgba(0, 212, 255, 0.15);
  }
  50% {
    box-shadow: 0 4px 30px rgba(0, 212, 255, 0.5), 0 0 60px rgba(0, 212, 255, 0.25);
  }
`;

const bounce = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateX(20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
`;

const FloatingButtonContainer = styled.div<{ $visible: boolean }>`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 90;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  transition: all 0.3s ease;
  opacity: ${props => props.$visible ? 1 : 0};
  pointer-events: ${props => props.$visible ? 'auto' : 'none'};
  transform: ${props => props.$visible ? 'translateY(0)' : 'translateY(20px)'};

  @media (max-width: 768px) {
    bottom: 16px;
    right: 16px;
  }
`;

const FloatingButton = styled.button<{ $expanded?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: ${props => props.$expanded ? '16px 28px' : '18px'};
  background: rgba(0, 30, 50, 0.9);
  border: 2px solid rgba(0, 212, 255, 0.4);
  border-radius: ${props => props.$expanded ? '8px' : '50%'};
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${pulseGlow} 3s ease-in-out infinite;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(10px);

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 120%;
    height: 120%;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, transparent 70%);
    transform: translate(-50%, -50%) scale(0);
    transition: transform 0.5s ease;
  }

  &:hover {
    transform: scale(1.05);
    border-color: rgba(0, 212, 255, 0.6);
    animation: ${bounce} 1s ease-in-out infinite;

    &::before {
      transform: translate(-50%, -50%) scale(1);
    }
  }

  &:active {
    transform: scale(0.98);
  }

  svg {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: #00d4ff;
  }
`;

const ButtonText = styled.span`
  white-space: nowrap;
  animation: ${slideIn} 0.3s ease;
`;

// AI Eye animations - the eye looks around and blinks with personality
const eyeLook = keyframes`
  0%, 100% { transform: translate(0, 0); }
  15% { transform: translate(2px, -1px); }
  30% { transform: translate(-1px, 1px); }
  45% { transform: translate(1px, 2px); }
  60% { transform: translate(-2px, -1px); }
  75% { transform: translate(1px, -2px); }
  90% { transform: translate(-1px, 1px); }
`;

const blink = keyframes`
  0%, 45%, 55%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.1); }
`;

const pupilPulse = keyframes`
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.15); }
`;

const AIEyeContainer = styled.div`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 26px;
  height: 26px;
  background: radial-gradient(circle at 30% 30%, #f0f8ff, #e0e8f0);
  border-radius: 50%;
  border: 2px solid #0f0f18;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.5);
  animation: ${bounce} 3s ease-in-out infinite;
`;

const AIEyeIris = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  background: radial-gradient(circle at 30% 30%, #00d4ff, #0080aa);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ${eyeLook} 8s ease-in-out infinite;
  box-shadow: inset 0 -2px 4px rgba(0, 0, 0, 0.2);
`;

const AIEyePupil = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  background: #000;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ${pupilPulse} 2s ease-in-out infinite;

  &::after {
    content: '';
    position: absolute;
    top: 1px;
    left: 1px;
    width: 2px;
    height: 2px;
    background: white;
    border-radius: 50%;
  }
`;

const AIEyeLid = styled.div`
  position: absolute;
  top: 0;
  left: -2px;
  right: -2px;
  height: 50%;
  background: linear-gradient(to bottom, #0a1628, #0a1628 80%, transparent);
  transform-origin: top center;
  animation: ${blink} 4s ease-in-out infinite;
  animation-delay: 2s;
`;

const AIEye = () => (
  <AIEyeContainer>
    <AIEyeIris>
      <AIEyePupil />
    </AIEyeIris>
    <AIEyeLid />
  </AIEyeContainer>
);

const Tooltip = styled.div<{ $visible: boolean }>`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 12px;
  padding: 12px 16px;
  background: rgba(3, 3, 8, 0.95);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  font-size: 0.875rem;
  white-space: nowrap;
  opacity: ${props => props.$visible ? 1 : 0};
  transform: ${props => props.$visible ? 'translateY(0)' : 'translateY(8px)'};
  transition: all 0.2s ease;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);

  &::after {
    content: '';
    position: absolute;
    bottom: -6px;
    right: 20px;
    width: 12px;
    height: 12px;
    background: rgba(3, 3, 8, 0.95);
    border-right: 1px solid rgba(0, 212, 255, 0.2);
    border-bottom: 1px solid rgba(0, 212, 255, 0.2);
    transform: rotate(45deg);
  }
`;

const TooltipHighlight = styled.span`
  color: #00d4ff;
  font-weight: 600;
`;

const MiniCard = styled.button<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(3, 3, 8, 0.95);
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: all 0.25s ease;
  opacity: ${props => props.$visible ? 1 : 0};
  transform: ${props => props.$visible ? 'translateX(0)' : 'translateX(20px)'};
  animation: ${slideIn} 0.3s ease;
  max-width: 280px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);

  &:hover {
    background: rgba(0, 212, 255, 0.08);
    border-color: rgba(0, 212, 255, 0.35);
    transform: translateX(-4px);
  }
`;

const MiniCardImage = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: rgba(0, 212, 255, 0.15);
  border: 1px solid rgba(0, 212, 255, 0.3);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    color: #00d4ff;
  }
`;

const MiniCardContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const MiniCardTitle = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MiniCardSubtitle = styled.div`
  font-size: 0.7rem;
  color: #9ca3af;
  margin-top: 2px;
`;

const CloseCardButton = styled.button`
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;

  &:hover {
    background: rgba(255, 75, 75, 0.2);
    color: #ff6b6b;
  }
`;

// Context types
interface ArticleDiscoveryContextType {
  isModalOpen: boolean;
  openModal: (article?: EnhancedArticleData) => void;
  closeModal: () => void;
  currentArticle: EnhancedArticleData | undefined;
  setCurrentArticle: (article: EnhancedArticleData | undefined) => void;
  showFloatingButton: boolean;
  setShowFloatingButton: (show: boolean) => void;
}

const ArticleDiscoveryContext = createContext<ArticleDiscoveryContextType | null>(null);

export function useArticleDiscovery() {
  const context = useContext(ArticleDiscoveryContext);
  if (!context) {
    throw new Error('useArticleDiscovery must be used within ArticleDiscoveryProvider');
  }
  return context;
}

interface ArticleDiscoveryProviderProps {
  children: ReactNode;
  initialShowButton?: boolean;
}

export function ArticleDiscoveryProvider({
  children,
  initialShowButton = true,
}: ArticleDiscoveryProviderProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentArticle, setCurrentArticle] = useState<EnhancedArticleData | undefined>();
  const [showFloatingButton, setShowFloatingButton] = useState(initialShowButton);
  const [isHovered, setIsHovered] = useState(false);
  const [showMiniCard, setShowMiniCard] = useState(false);
  const [suggestedArticle, setSuggestedArticle] = useState<EnhancedArticleData | null>(null);

  // Pre-fetch and cache all articles
  const [allArticles, setAllArticles] = useState<EnhancedArticleData[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    fetch('/api/articles-enhanced')
      .then(res => res.json())
      .then((data: EnhancedArticleData[]) => {
        setAllArticles(data);
      })
      .catch(console.error);
  }, []);

  const openModal = useCallback((article?: EnhancedArticleData) => {
    if (article) {
      setCurrentArticle(article);
    }
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Mini-card popup disabled - users found it distracting
  // The 3D article icon now serves as the primary discovery mechanism

  const value: ArticleDiscoveryContextType = {
    isModalOpen,
    openModal,
    closeModal,
    currentArticle,
    setCurrentArticle,
    showFloatingButton,
    setShowFloatingButton,
  };

  return (
    <ArticleDiscoveryContext.Provider value={value}>
      {children}

      {/* Floating Discovery Button */}
      <FloatingButtonContainer $visible={showFloatingButton && !isModalOpen}>
        {/* Tooltip */}
        <Tooltip $visible={isHovered}>
          Discover <TooltipHighlight>related articles</TooltipHighlight> and explore the archive
        </Tooltip>

        {/* Main button */}
        <FloatingButton
          $expanded={isHovered}
          onClick={() => openModal()}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label="Discover Articles"
        >
          <Compass />
          {isHovered && <ButtonText>Discover Articles</ButtonText>}
          {!isHovered && currentArticle && <AIEye />}
        </FloatingButton>
      </FloatingButtonContainer>

      {/* The Modal */}
      <ArticleRecommendationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        currentArticle={currentArticle}
        allArticles={allArticles}
      />
    </ArticleDiscoveryContext.Provider>
  );
}

export default ArticleDiscoveryProvider;
