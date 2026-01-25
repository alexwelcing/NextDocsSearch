import { useState, useEffect, useCallback } from 'react';

export interface WorldInfo {
  id: string;
  name: string;
  path: string;
  type: 'image';
  thumbnail?: string;
  visited?: boolean;
}

export interface WorldTrackerState {
  visitedWorlds: Set<string>;
  allWorldsVisited: boolean;
  cosmicPowerUnlocked: boolean;
  totalWorlds: number;
  visitedCount: number;
}

const STORAGE_KEY = 'nextdocs_visited_worlds';
const POWER_UNLOCKED_KEY = 'nextdocs_cosmic_power_unlocked';

export function useWorldTracker(worlds: WorldInfo[]) {
  const [visitedWorlds, setVisitedWorlds] = useState<Set<string>>(new Set());
  const [cosmicPowerUnlocked, setCosmicPowerUnlocked] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setVisitedWorlds(new Set(parsed));
        }
        const powerUnlocked = localStorage.getItem(POWER_UNLOCKED_KEY);
        if (powerUnlocked === 'true') {
          setCosmicPowerUnlocked(true);
        }
      } catch (e) {
        console.error('Failed to load visited worlds:', e);
      }
      setInitialized(true);
    }
  }, []);

  // Save to localStorage when visited worlds change
  useEffect(() => {
    if (initialized && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visitedWorlds)));
      } catch (e) {
        console.error('Failed to save visited worlds:', e);
      }
    }
  }, [visitedWorlds, initialized]);

  // Check if all worlds are visited
  const allWorldsVisited = worlds.length > 0 && worlds.every(w => visitedWorlds.has(w.id));
  const visitedCount = Array.from(visitedWorlds).filter(id => worlds.some(w => w.id === id)).length;

  // Unlock cosmic power when all worlds visited
  useEffect(() => {
    if (allWorldsVisited && !cosmicPowerUnlocked && initialized) {
      setCosmicPowerUnlocked(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem(POWER_UNLOCKED_KEY, 'true');
      }
    }
  }, [allWorldsVisited, cosmicPowerUnlocked, initialized]);

  const markVisited = useCallback((worldId: string) => {
    setVisitedWorlds(prev => {
      const next = new Set(prev);
      next.add(worldId);
      return next;
    });
  }, []);

  const isVisited = useCallback((worldId: string) => {
    return visitedWorlds.has(worldId);
  }, [visitedWorlds]);

  const resetProgress = useCallback(() => {
    setVisitedWorlds(new Set());
    setCosmicPowerUnlocked(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(POWER_UNLOCKED_KEY);
    }
  }, []);

  return {
    visitedWorlds,
    allWorldsVisited,
    cosmicPowerUnlocked,
    totalWorlds: worlds.length,
    visitedCount,
    markVisited,
    isVisited,
    resetProgress,
    initialized,
  };
}
