import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { JourneyProgress, Quest, QUESTS, Achievement, ACHIEVEMENTS } from '../lib/journey/types';
import { ShipSignal } from '../lib/ai/shipPersona';

interface JourneyContextType {
  progress: JourneyProgress;
  currentQuest: Quest | null;
  availableQuests: Quest[];
  completeQuest: (questId: string) => void;
  unlockFeature: (featureId: string) => void;
  isFeatureUnlocked: (featureId: string) => boolean;
  updateStats: (stat: keyof JourneyProgress['stats'], value: any) => void;
  achievements: Achievement[];
  unlockAchievement: (achievementId: string) => void;
  resetJourney: () => void;
  updateCreationProgress: (type: 'generated' | 'saved' | 'template_used', count: number) => void;
  missionBriefs: Record<string, string>;
  applyAiSignals: (signals: ShipSignal[]) => void;
}

const JourneyContext = createContext<JourneyContextType | undefined>(undefined);

const INITIAL_PROGRESS: JourneyProgress = {
  currentPhase: 1,
  completedQuests: [],
  unlockedFeatures: ['chat'], // Chat always unlocked
  achievements: [],
  stats: {
    questionsAsked: 0,
    articlesRead: [],
    quizzesTaken: 0,
    highestQuizScore: 0,
    gamesPlayed: 0,
    highestGameScore: 0,
    creationsGenerated: 0,
    creationsSaved: 0,
    templatesUsed: 0,
  },
};

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<JourneyProgress>(() => {
    // Load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('journeyProgress');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse journey progress:', e);
        }
      }
    }
    return INITIAL_PROGRESS;
  });

  const [achievements, setAchievements] = useState<Achievement[]>(() => {
    return ACHIEVEMENTS.map(ach => ({
      ...ach,
      unlocked: progress.achievements.includes(ach.id),
    }));
  });

  const [missionBriefs, setMissionBriefs] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('journeyMissionBriefs');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse mission briefs:', e);
        }
      }
    }
    return {};
  });

  // Save to localStorage whenever progress changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('journeyProgress', JSON.stringify(progress));
    }
  }, [progress]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('journeyMissionBriefs', JSON.stringify(missionBriefs));
    }
  }, [missionBriefs]);

  // Get current active quest
  const currentQuest = QUESTS.find(q =>
    !progress.completedQuests.includes(q.id) &&
    (!q.requirement || progress.completedQuests.includes(q.requirement))
  ) || null;

  // Get all available quests (unlocked but not completed)
  const availableQuests = QUESTS.filter(q =>
    !progress.completedQuests.includes(q.id) &&
    (!q.requirement || progress.completedQuests.includes(q.requirement))
  );

  const completeQuest = useCallback((questId: string) => {
    const quest = QUESTS.find(q => q.id === questId);
    if (!quest || progress.completedQuests.includes(questId)) return;

    setProgress(prev => {
      const newProgress = {
        ...prev,
        completedQuests: [...prev.completedQuests, questId],
        currentPhase: Math.max(prev.currentPhase, quest.phase),
        unlockedFeatures: quest.unlocks
          ? [...prev.unlockedFeatures, ...quest.unlocks]
          : prev.unlockedFeatures,
      };

      // Check for phase completion achievements
      if (quest.phase === 2 && prev.completedQuests.length === 0) {
        unlockAchievement('first-steps');
      }

      // Check for perfectionist achievement
      if (newProgress.completedQuests.length === QUESTS.length) {
        unlockAchievement('perfectionist');
      }

      return newProgress;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.completedQuests]);

  const unlockFeature = useCallback((featureId: string) => {
    setProgress(prev => {
      if (prev.unlockedFeatures.includes(featureId)) return prev;
      return {
        ...prev,
        unlockedFeatures: [...prev.unlockedFeatures, featureId],
      };
    });
  }, []);

  const isFeatureUnlocked = useCallback((featureId: string) => {
    return progress.unlockedFeatures.includes(featureId);
  }, [progress.unlockedFeatures]);

  const updateStats = useCallback((stat: keyof JourneyProgress['stats'], value: any) => {
    setProgress(prev => {
      const newStats = { ...prev.stats };

      if (stat === 'articlesRead' && Array.isArray(value)) {
        newStats.articlesRead = Array.from(new Set([...newStats.articlesRead, ...value]));

        // Check bookworm achievement
        if (newStats.articlesRead.length >= 5) {
          unlockAchievement('bookworm');
        }
      } else if (stat === 'questionsAsked') {
        newStats.questionsAsked = (newStats.questionsAsked || 0) + 1;

        // Check curious mind achievement
        if (newStats.questionsAsked >= 10) {
          unlockAchievement('curious-mind');
        }
      } else if (stat === 'highestQuizScore') {
        newStats.highestQuizScore = Math.max(newStats.highestQuizScore || 0, value);

        // Check scholar achievement
        if (value === 100) {
          unlockAchievement('scholar');
        }
      } else if (stat === 'highestGameScore') {
        newStats.highestGameScore = Math.max(newStats.highestGameScore || 0, value);

        // Check game master achievement
        if (value >= 10000) {
          unlockAchievement('game-master');
        }
      } else {
        (newStats as any)[stat] = value;
      }

      return {
        ...prev,
        stats: newStats,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlockAchievement = useCallback((achievementId: string) => {
    if (progress.achievements.includes(achievementId)) return;

    setProgress(prev => ({
      ...prev,
      achievements: [...prev.achievements, achievementId],
    }));

    setAchievements(prev => prev.map(ach =>
      ach.id === achievementId ? { ...ach, unlocked: true } : ach
    ));
  }, [progress.achievements]);

  const updateCreationProgress = useCallback((type: 'generated' | 'saved' | 'template_used', count: number) => {
    setProgress(prev => {
      const newStats = { ...prev.stats };

      if (type === 'generated') {
        newStats.creationsGenerated = (newStats.creationsGenerated || 0) + count;

        // Complete first-creation quest
        if (newStats.creationsGenerated === 1) {
          completeQuest('first-creation');
        }

        // Check prolific creator achievement
        if (newStats.creationsGenerated >= 10) {
          unlockAchievement('prolific-creator');
        }
      } else if (type === 'saved') {
        newStats.creationsSaved = (newStats.creationsSaved || 0) + count;

        // Complete save-creation quest
        if (newStats.creationsSaved === 1) {
          completeQuest('save-creation');
        }
      } else if (type === 'template_used') {
        newStats.templatesUsed = (newStats.templatesUsed || 0) + count;

        // Check template master achievement
        if (newStats.templatesUsed >= 5) {
          unlockAchievement('template-master');
        }
      }

      return {
        ...prev,
        stats: newStats,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyAiSignals = useCallback((signals: ShipSignal[]) => {
    if (!signals.length) return;

    setMissionBriefs(prev => {
      const updated = { ...prev };

      signals.forEach(signal => {
        if ((signal.type === 'MISSION_BRIEF' || signal.type === 'MISSION_HINT') && signal.text) {
          const targetQuest = signal.questId || currentQuest?.id;
          if (targetQuest) {
            updated[targetQuest] = signal.text.trim();
          }
        }
      });

      return updated;
    });

    signals
      .filter(signal => signal.type === 'UNLOCK_QUEST')
      .forEach(signal => {
        if (signal.questId) {
          completeQuest(signal.questId);
        }
      });
  }, [completeQuest, currentQuest?.id]);

  const resetJourney = useCallback(() => {
    setProgress(INITIAL_PROGRESS);
    setAchievements(ACHIEVEMENTS.map(ach => ({ ...ach, unlocked: false })));
    setMissionBriefs({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('journeyProgress');
      localStorage.removeItem('journeyMissionBriefs');
    }
  }, []);

  return (
    <JourneyContext.Provider
      value={{
        progress,
        currentQuest,
        availableQuests,
        completeQuest,
        unlockFeature,
        isFeatureUnlocked,
        updateStats,
        achievements,
        unlockAchievement,
        resetJourney,
        updateCreationProgress,
        missionBriefs,
        applyAiSignals,
      }}
    >
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  const context = useContext(JourneyContext);
  if (!context) {
    throw new Error('useJourney must be used within JourneyProvider');
  }
  return context;
}
