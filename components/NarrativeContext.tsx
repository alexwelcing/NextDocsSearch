import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CHAPTERS, NarrativeChapter } from '../lib/narrative/chapters';

interface NarrativeProgress {
  unlockedChapterIds: string[];
  currentChapterId: string;
}

interface NarrativeContextValue {
  chapters: NarrativeChapter[];
  currentChapter: NarrativeChapter;
  unlockedChapterIds: string[];
  triggerEvent: (eventId: string) => void;
  setCurrentChapter: (chapterId: string) => void;
  resetNarrative: () => void;
}

const NarrativeContext = createContext<NarrativeContextValue | undefined>(undefined);

const STORAGE_KEY = 'narrativeProgress';

const getDefaultProgress = (): NarrativeProgress => ({
  unlockedChapterIds: [CHAPTERS[0].id],
  currentChapterId: CHAPTERS[0].id,
});

export function NarrativeProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<NarrativeProgress>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved) as NarrativeProgress;
        } catch (error) {
          console.error('Failed to parse narrative progress:', error);
        }
      }
    }
    return getDefaultProgress();
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  }, [progress]);

  const unlockedChapterIds = progress.unlockedChapterIds;

  const currentChapter = useMemo(() => {
    return CHAPTERS.find(chapter => chapter.id === progress.currentChapterId) ?? CHAPTERS[0];
  }, [progress.currentChapterId]);

  const unlockChapter = useCallback((chapterId: string) => {
    setProgress(prev => {
      if (prev.unlockedChapterIds.includes(chapterId)) {
        return prev;
      }
      return {
        unlockedChapterIds: [...prev.unlockedChapterIds, chapterId],
        currentChapterId: chapterId,
      };
    });
  }, []);

  const triggerEvent = useCallback((eventId: string) => {
    const chaptersToUnlock = CHAPTERS.filter(
      chapter => chapter.unlockCondition === eventId && !unlockedChapterIds.includes(chapter.id)
    );

    if (chaptersToUnlock.length === 0) {
      return;
    }

    chaptersToUnlock.forEach(chapter => unlockChapter(chapter.id));
  }, [unlockedChapterIds, unlockChapter]);

  const setCurrentChapter = useCallback((chapterId: string) => {
    setProgress(prev => {
      if (!prev.unlockedChapterIds.includes(chapterId)) {
        return prev;
      }
      return {
        ...prev,
        currentChapterId: chapterId,
      };
    });
  }, []);

  const resetNarrative = useCallback(() => {
    setProgress(getDefaultProgress());
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return (
    <NarrativeContext.Provider
      value={{
        chapters: CHAPTERS,
        currentChapter,
        unlockedChapterIds,
        triggerEvent,
        setCurrentChapter,
        resetNarrative,
      }}
    >
      {children}
    </NarrativeContext.Provider>
  );
}

export function useNarrative() {
  const context = useContext(NarrativeContext);
  if (!context) {
    throw new Error('useNarrative must be used within NarrativeProvider');
  }
  return context;
}
