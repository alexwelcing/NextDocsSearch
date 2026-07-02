import { create } from 'zustand';

export type GameState = 'IDLE' | 'STARTING' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER';

export interface GameStats {
  score: number;
  comboMax: number;
  accuracy: number;
  totalClicks: number;
  successfulClicks: number;
}

interface GameStore extends GameStats {
  gameState: GameState;
  timeRemaining: number;
  combo: number;
  countdown: number;
  gameStats: GameStats;

  startGame: () => void;
  beginCountdown: () => void;
  startPlaying: () => void;
  endGame: () => void;
  resetGame: () => void;
  updateScore: (score: number) => void;
  addScore: (points: number) => void;
  updateCombo: (combo: number) => void;
  updateTimeRemaining: (time: number) => void;
  tickCountdown: () => void;
  registerHit: () => void;
  registerMissedClick: () => void;
}

const initialStats: GameStats = {
  score: 0,
  comboMax: 0,
  accuracy: 0,
  totalClicks: 0,
  successfulClicks: 0,
};

export const useGameStore = create<GameStore>((set) => ({
  gameState: 'IDLE',
  timeRemaining: 30,
  combo: 0,
  countdown: 3,
  gameStats: initialStats,
  ...initialStats,

  startGame: () => set({
    gameState: 'STARTING',
    timeRemaining: 30,
    countdown: 3,
    combo: 0,
    gameStats: initialStats,
    ...initialStats,
  }),

  beginCountdown: () => set({ gameState: 'COUNTDOWN' }),

  startPlaying: () => set({ gameState: 'PLAYING' }),

  endGame: () => set((state) => {
    const accuracy = state.totalClicks > 0
      ? Math.round((state.successfulClicks / state.totalClicks) * 100)
      : 0;
    const stats: GameStats = {
      score: state.score,
      comboMax: state.comboMax,
      accuracy,
      totalClicks: state.totalClicks,
      successfulClicks: state.successfulClicks,
    };
    return {
      gameState: 'GAME_OVER',
      accuracy,
      gameStats: stats,
    };
  }),

  resetGame: () => set({
    gameState: 'IDLE',
    timeRemaining: 30,
    countdown: 3,
    combo: 0,
    gameStats: initialStats,
    ...initialStats,
  }),

  updateScore: (score) => set({ score }),
  addScore: (points) => set((state) => ({ score: state.score + points })),
  updateCombo: (combo) => set((state) => ({
    combo,
    comboMax: Math.max(state.comboMax, combo),
  })),
  updateTimeRemaining: (timeRemaining) => set({ timeRemaining }),

  tickCountdown: () => set((state) => {
    const next = state.countdown - 1;
    if (next <= 0) {
      return { countdown: 0, gameState: 'PLAYING' as GameState };
    }
    return { countdown: next };
  }),

  registerHit: () => set((state) => ({
    totalClicks: state.totalClicks + 1,
    successfulClicks: state.successfulClicks + 1,
  })),

  registerMissedClick: () => set((state) => ({
    totalClicks: state.totalClicks + 1,
  })),
}));
