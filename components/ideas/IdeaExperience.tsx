/**
 * IdeaExperience - Main entry point for the idea experience
 *
 * Combines:
 * - IdeaHub (central hub with orbs)
 * - IdeaContent (engaged content display)
 * - Progress tracking
 * - Game integration
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import IdeaHub from './IdeaHub';
import IdeaContent from './IdeaContent';
import IdeaProgress from './IdeaProgress';
import type { IdeaOrbData, OrbContent, IdeaGameStats, ConstellationNode } from './types';
import { useJourney } from '@/components/JourneyContext';

interface IdeaExperienceProps {
  /** Articles data for orb generation */
  articles?: Array<{
    title: string;
    date: string;
    author: string[];
    filename?: string;
    length?: number;
  }>;
  /** Hub position in scene */
  position?: [number, number, number];
  /** Callback when game state changes (for external HUD) */
  onGameStateChange?: (state: string) => void;
  /** Whether experience is active */
  isActive?: boolean;
}

/**
 * Generate initial orbs from articles
 */
function generateInitialOrbs(
  articles: IdeaExperienceProps['articles']
): IdeaOrbData[] {
  const orbs: IdeaOrbData[] = [];

  // Chat orb (always present, at core)
  orbs.push({
    id: 'chat-core',
    state: 'active',
    content: {
      type: 'chat',
      id: 'main-chat',
      title: 'Ask the Oracle',
    },
    position: [0, 0.5, 2],
    size: 0.6,
  });

  // Article orbs (from data)
  if (articles) {
    articles.slice(0, 5).forEach((article, i) => {
      const angle = (i / 5) * Math.PI * 2;
      const radius = 4;
      orbs.push({
        id: `article-${i}`,
        state: 'active',
        content: {
          type: 'article',
          id: article.filename || `article-${i}`,
          title: article.title,
          preview: `By ${article.author.join(', ')} - ${article.date}`,
          data: article,
        },
        position: [
          Math.cos(angle) * radius,
          Math.sin(angle * 2) * 0.5,
          Math.sin(angle) * radius,
        ],
        size: 0.5,
      });
    });
  }

  // Quiz orb
  orbs.push({
    id: 'quiz-challenge',
    state: 'active',
    content: {
      type: 'quiz',
      id: 'main-quiz',
      title: 'Knowledge Challenge',
    },
    position: [-3, 1, -3],
    size: 0.5,
  });

  // Creation orb
  orbs.push({
    id: 'creation-studio',
    state: 'active',
    content: {
      type: 'creation',
      id: 'main-creation',
      title: 'Creation Studio',
    },
    position: [3, 1, -3],
    size: 0.5,
  });

  return orbs;
}

export default function IdeaExperience({
  articles = [],
  position = [0, 2, 0],
  onGameStateChange,
  isActive = true,
}: IdeaExperienceProps) {
  // Journey integration
  const { progress, completeQuest, updateStats } = useJourney();

  // State
  const [engagedContent, setEngagedContent] = useState<OrbContent | null>(null);
  const [gameActive, setGameActive] = useState(false);
  const [orbs, setOrbs] = useState<IdeaOrbData[]>([]);

  // Initialize orbs
  useEffect(() => {
    setOrbs(generateInitialOrbs(articles));
  }, [articles]);

  // Generate constellation nodes from journey progress
  const constellationNodes = useMemo(() => {
    const nodes: ConstellationNode[] = [];
    const radius = 12;

    // Articles read
    progress.stats.articlesRead.forEach((articleId, i) => {
      const angle = (i / 10) * Math.PI * 2;
      nodes.push({
        id: `node-article-${articleId}`,
        type: 'article',
        position: [
          Math.cos(angle) * radius,
          Math.sin(angle * 2) * 2,
          Math.sin(angle) * radius,
        ],
        connectedTo: i > 0 ? [`node-article-${progress.stats.articlesRead[i-1]}`] : [],
        brightness: 0.8,
        exploredAt: Date.now(),
      });
    });

    // Quests completed
    progress.completedQuests.forEach((questId, i) => {
      const angle = (i / 8) * Math.PI * 2 + Math.PI / 4;
      const qRadius = 15;
      nodes.push({
        id: `node-quest-${questId}`,
        type: 'quiz',
        position: [
          Math.cos(angle) * qRadius,
          3 + Math.sin(angle) * 2,
          Math.sin(angle) * qRadius,
        ],
        connectedTo: i > 0 ? [`node-quest-${progress.completedQuests[i-1]}`] : [],
        brightness: 1.0,
        exploredAt: Date.now(),
      });
    });

    return nodes;
  }, [progress]);

  // Handle content engagement
  const handleContentEngage = useCallback(
    (content: OrbContent) => {
      setEngagedContent(content);

      // Track based on content type
      if (content.type === 'chat') {
        // Chat engagement tracked on actual question
      } else if (content.type === 'article') {
        updateStats('articlesRead', [content.id]);
        // Delay quest completion for actual reading
        setTimeout(() => {
          completeQuest('read-article');
        }, 2000);
      }
    },
    [updateStats, completeQuest]
  );

  // Handle content actions
  const handleContentAction = useCallback(
    (action: string, data?: unknown) => {
      if (action === 'ask' && typeof data === 'string') {
        updateStats('questionsAsked', 1);
        completeQuest('first-question');
      }

      if (action === 'read') {
        // Open article in new window
        const articleData = data as { filename?: string };
        if (articleData?.filename) {
          window.open(`/articles/${articleData.filename}`, '_blank');
        }
      }

      if (action === 'answer') {
        const answerData = data as { correct: boolean };
        if (answerData?.correct) {
          updateStats('quizzesTaken', 1);
          completeQuest('take-quiz');
        }
      }

      if (action === 'create') {
        updateStats('creationsGenerated', 1);
        completeQuest('first-creation');
      }
    },
    [updateStats, completeQuest]
  );

  // Handle content close
  const handleContentClose = useCallback(() => {
    setEngagedContent(null);
  }, []);

  // Handle game completion
  const handleGameComplete = useCallback(
    (stats: IdeaGameStats) => {
      setGameActive(false);
      onGameStateChange?.('idle');

      updateStats('gamesPlayed', 1);
      updateStats('highestGameScore', stats.ideasAwakened * 10 + stats.insightLevel * 50);
      completeQuest('play-game');

      if (stats.insightLevel >= 5) {
        completeQuest('leaderboard-rank');
      }

      // Unlock more orbs based on performance
      if (stats.rareDiscoveries > 0) {
        setOrbs((current) => [
          ...current,
          {
            id: `mystery-${Date.now()}`,
            state: 'active' as const,
            content: {
              type: 'mystery' as const,
              id: `mystery-${Date.now()}`,
              title: 'Rare Discovery',
              isRare: true,
            },
            position: [
              (Math.random() - 0.5) * 4,
              Math.random() * 2,
              (Math.random() - 0.5) * 4,
            ],
            size: 0.6,
          },
        ]);
      }
    },
    [updateStats, completeQuest, onGameStateChange]
  );

  // Handle orb awakening
  const handleOrbAwakened = useCallback((id: string) => {
    // Could trigger particle effects, sounds, etc.
  }, []);

  if (!isActive) return null;

  return (
    <group position={position}>
      {/* Background Constellation */}
      <IdeaProgress nodes={constellationNodes} position={[0, 0, 0]} opacity={0.4} />

      {/* Main Hub */}
      <IdeaHub
        initialOrbs={orbs}
        position={[0, 0, 0]}
        onContentEngage={handleContentEngage}
        onGameComplete={handleGameComplete}
        onOrbAwakened={handleOrbAwakened}
        isActive={!engagedContent}
      />

      {/* Engaged Content Panel */}
      <IdeaContent
        content={engagedContent}
        position={[0, 0.5, 4]}
        onClose={handleContentClose}
        onAction={handleContentAction}
      />
    </group>
  );
}

export type { IdeaExperienceProps };
