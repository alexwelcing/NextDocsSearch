/**
 * Trophy System - Session-based progress tracking for content exploration
 *
 * Replaces the complex Journey/Quest system with simple trophy unlocks:
 * 1. World Master - Unlock any complete world (read all articles in a world)
 * 2. Universe Explorer - Unlock all worlds
 * 3. High Score - Hit score threshold
 *
 * All progress stored in sessionStorage (clears on browser close/refresh)
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { WORLDS, getWorldByArticle } from '../config/worlds';

export interface TrophyProgress {
  // Articles read (by slug)
  articlesRead: string[];
  // Worlds completed (by world ID)
  worldsCompleted: number[];
  // High score
  highScore: number;
  // Trophies unlocked
  trophies: {
    worldMaster: boolean;      // Completed any world
    universeExplorer: boolean;  // Completed all worlds
    highScorer: boolean;        // Hit high score threshold
  };
  // Session start time
  sessionStart: number;
}

interface TrophyContextType {
  progress: TrophyProgress;
  markArticleRead: (slug: string) => void;
  updateHighScore: (score: number) => void;
  getWorldProgress: (worldId: number) => { read: number; total: number; percentage: number };
  isWorldCompleted: (worldId: number) => boolean;
  resetProgress: () => void;
  // Fog reveal data for 360 backgrounds
  getFogRevealData: (worldId: number) => { articlesRead: string[]; totalArticles: number };
}

const STORAGE_KEY = 'trophy_progress';
const HIGH_SCORE_THRESHOLD = 10000;

const defaultProgress: TrophyProgress = {
  articlesRead: [],
  worldsCompleted: [],
  highScore: 0,
  trophies: {
    worldMaster: false,
    universeExplorer: false,
    highScorer: false,
  },
  sessionStart: Date.now(),
};

const TrophyContext = createContext<TrophyContextType | undefined>(undefined);

export const TrophyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<TrophyProgress>(defaultProgress);
  const [initialized, setInitialized] = useState(false);

  // Load progress from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProgress(parsed);
      }
    } catch (error) {
      console.error('Failed to load trophy progress:', error);
    }
    setInitialized(true);
  }, []);

  // Save progress to sessionStorage whenever it changes
  useEffect(() => {
    if (!initialized || typeof window === 'undefined') return;

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (error) {
      console.error('Failed to save trophy progress:', error);
    }
  }, [progress, initialized]);

  // Mark article as read and check for trophy unlocks
  const markArticleRead = useCallback((slug: string) => {
    setProgress((prev) => {
      // Don't re-add if already read
      if (prev.articlesRead.includes(slug)) return prev;

      const newArticlesRead = [...prev.articlesRead, slug];
      const newProgress = { ...prev, articlesRead: newArticlesRead };

      // Check which worlds are now completed
      const completedWorlds: number[] = [];
      WORLDS.forEach((world) => {
        const worldArticles = world.articles.map((a) => a.slug);
        const allRead = worldArticles.every((slug) => newArticlesRead.includes(slug));
        if (allRead && !completedWorlds.includes(world.id)) {
          completedWorlds.push(world.id);
        }
      });

      newProgress.worldsCompleted = completedWorlds;

      // Check trophy unlocks
      const trophies = { ...prev.trophies };

      // World Master - completed at least one world
      if (completedWorlds.length > 0 && !trophies.worldMaster) {
        trophies.worldMaster = true;
        console.log('🏆 Trophy Unlocked: World Master!');
        showTrophyNotification('World Master', 'You\'ve mastered your first world!');
      }

      // Universe Explorer - completed all worlds
      if (completedWorlds.length === WORLDS.length && !trophies.universeExplorer) {
        trophies.universeExplorer = true;
        console.log('🏆 Trophy Unlocked: Universe Explorer!');
        showTrophyNotification('Universe Explorer', 'You\'ve explored the entire universe!');
      }

      newProgress.trophies = trophies;

      return newProgress;
    });
  }, []);

  // Update high score and check for trophy
  const updateHighScore = useCallback((score: number) => {
    setProgress((prev) => {
      if (score <= prev.highScore) return prev;

      const newProgress = { ...prev, highScore: score };
      const trophies = { ...prev.trophies };

      // High Scorer trophy
      if (score >= HIGH_SCORE_THRESHOLD && !trophies.highScorer) {
        trophies.highScorer = true;
        console.log('🏆 Trophy Unlocked: High Scorer!');
        showTrophyNotification('High Scorer', `You scored ${score.toLocaleString()} points!`);
      }

      newProgress.trophies = trophies;

      return newProgress;
    });
  }, []);

  // Get progress for a specific world
  const getWorldProgress = useCallback((worldId: number) => {
    const world = WORLDS.find((w) => w.id === worldId);
    if (!world) return { read: 0, total: 0, percentage: 0 };

    const total = world.articles.length;
    const read = world.articles.filter((article) =>
      progress.articlesRead.includes(article.slug)
    ).length;
    const percentage = total > 0 ? (read / total) * 100 : 0;

    return { read, total, percentage };
  }, [progress.articlesRead]);

  // Check if a world is completed
  const isWorldCompleted = useCallback((worldId: number) => {
    return progress.worldsCompleted.includes(worldId);
  }, [progress.worldsCompleted]);

  // Get fog reveal data for a world (for shader)
  const getFogRevealData = useCallback((worldId: number) => {
    const world = WORLDS.find((w) => w.id === worldId);
    if (!world) return { articlesRead: [], totalArticles: 0 };

    const articlesRead = world.articles
      .filter((article) => progress.articlesRead.includes(article.slug))
      .map((article) => article.slug);

    return {
      articlesRead,
      totalArticles: world.articles.length,
    };
  }, [progress.articlesRead]);

  // Reset all progress
  const resetProgress = useCallback(() => {
    const freshProgress = {
      ...defaultProgress,
      sessionStart: Date.now(),
    };
    setProgress(freshProgress);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    console.log('Progress reset');
  }, []);

  const value: TrophyContextType = {
    progress,
    markArticleRead,
    updateHighScore,
    getWorldProgress,
    isWorldCompleted,
    resetProgress,
    getFogRevealData,
  };

  return <TrophyContext.Provider value={value}>{children}</TrophyContext.Provider>;
};

// Hook to use trophy context
export const useTrophy = (): TrophyContextType => {
  const context = useContext(TrophyContext);
  if (!context) {
    throw new Error('useTrophy must be used within TrophyProvider');
  }
  return context;
};

// Trophy notification (can be replaced with a nice UI component later)
const showTrophyNotification = (title: string, message: string) => {
  if (typeof window === 'undefined') return;

  // For now, just log. Later we can add a toast/modal
  console.log(`🏆 ${title}: ${message}`);

  // Could dispatch a custom event for a notification system
  window.dispatchEvent(
    new CustomEvent('trophy-unlocked', {
      detail: { title, message },
    })
  );
};
