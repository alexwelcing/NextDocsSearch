'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Compass, Star, X } from 'lucide-react';
import styled, { keyframes, css } from 'styled-components';
import ArticleRecommendationModal from './ArticleRecommendationModal';
import type { EnhancedArticleData } from '@/pages/api/articles-enhanced';

// Animation keyframes
const pulseGlow = keyframes`
  0%, 100% {
    box-shadow: 0 4px 20px rgba(222, 126, 162, 0.4), 0 0 40px rgba(222, 126, 162, 0.2);
  }
  50% {
    box-shadow: 0 4px 30px rgba(222, 126, 162, 0.6), 0 0 60px rgba(222, 126, 162, 0.3);
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
  background: linear-gradient(135deg, #de7ea2 0%, #6366f1 100%);
  border: none;
  border-radius: ${props => props.$expanded ? '20px' : '50%'};
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  animation: ${pulseGlow} 3s ease-in-out infinite;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 120%;
    height: 120%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
    transform: translate(-50%, -50%) scale(0);
    transition: transform 0.5s ease;
  }

  &:hover {
    transform: scale(1.05);
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
  }
`;

const ButtonText = styled.span`
  white-space: nowrap;
  animation: ${slideIn} 0.3s ease;
`;

const NotificationBadge = styled.span`
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: #ef4444;
  border-radius: 11px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #0f0f18;
  animation: ${bounce} 2s ease-in-out infinite;
`;

const Tooltip = styled.div<{ $visible: boolean }>`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 12px;
  padding: 12px 16px;
  background: rgba(15, 15, 25, 0.95);
  border: 1px solid rgba(222, 126, 162, 0.3);
  border-radius: 12px;
  color: #fff;
  font-size: 0.875rem;
  white-space: nowrap;
  opacity: ${props => props.$visible ? 1 : 0};
  transform: ${props => props.$visible ? 'translateY(0)' : 'translateY(8px)'};
  transition: all 0.2s ease;
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);

  &::after {
    content: '';
    position: absolute;
    bottom: -6px;
    right: 20px;
    width: 12px;
    height: 12px;
    background: rgba(15, 15, 25, 0.95);
    border-right: 1px solid rgba(222, 126, 162, 0.3);
    border-bottom: 1px solid rgba(222, 126, 162, 0.3);
    transform: rotate(45deg);
  }
`;

const TooltipHighlight = styled.span`
  color: #de7ea2;
  font-weight: 600;
`;

const MiniCard = styled.button<{ $visible: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(15, 15, 25, 0.95);
  border: 1px solid rgba(222, 126, 162, 0.25);
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.25s ease;
  opacity: ${props => props.$visible ? 1 : 0};
  transform: ${props => props.$visible ? 'translateX(0)' : 'translateX(20px)'};
  animation: ${slideIn} 0.3s ease;
  max-width: 280px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);

  &:hover {
    background: rgba(222, 126, 162, 0.1);
    border-color: rgba(222, 126, 162, 0.4);
    transform: translateX(-4px);
  }
`;

const MiniCardImage = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, #de7ea2 0%, #6366f1 100%);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
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

  const openModal = useCallback((article?: EnhancedArticleData) => {
    if (article) {
      setCurrentArticle(article);
    }
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Show a suggested article mini-card after some delay
  React.useEffect(() => {
    if (!showFloatingButton || isModalOpen) return;

    const timer = setTimeout(() => {
      // Fetch a random article suggestion
      fetch('/api/articles-enhanced')
        .then(res => res.json())
        .then((articles: EnhancedArticleData[]) => {
          if (articles.length > 0) {
            const random = articles[Math.floor(Math.random() * articles.length)];
            if (random.slug !== currentArticle?.slug) {
              setSuggestedArticle(random);
              setShowMiniCard(true);

              // Hide after 10 seconds
              setTimeout(() => setShowMiniCard(false), 10000);
            }
          }
        })
        .catch(() => {});
    }, 8000);

    return () => clearTimeout(timer);
  }, [showFloatingButton, isModalOpen, currentArticle]);

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
        {/* Mini suggestion card */}
        {showMiniCard && suggestedArticle && (
          <MiniCard
            $visible={showMiniCard}
            onClick={() => {
              setShowMiniCard(false);
              openModal(suggestedArticle);
            }}
          >
            <MiniCardImage>
              <Star size={20} color="#fff" />
            </MiniCardImage>
            <MiniCardContent>
              <MiniCardTitle>{suggestedArticle.title}</MiniCardTitle>
              <MiniCardSubtitle>
                {suggestedArticle.articleType === 'fiction' ? 'Fiction' : 'Research'} • {suggestedArticle.readingTime} min read
              </MiniCardSubtitle>
            </MiniCardContent>
            <CloseCardButton
              onClick={(e) => {
                e.stopPropagation();
                setShowMiniCard(false);
              }}
            >
              <X size={14} />
            </CloseCardButton>
          </MiniCard>
        )}

        {/* Tooltip */}
        <Tooltip $visible={isHovered && !showMiniCard}>
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
          {!isHovered && currentArticle && (
            <NotificationBadge>!</NotificationBadge>
          )}
        </FloatingButton>
      </FloatingButtonContainer>

      {/* The Modal */}
      <ArticleRecommendationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        currentArticle={currentArticle}
      />
    </ArticleDiscoveryContext.Provider>
  );
}

export default ArticleDiscoveryProvider;
