export interface Quest {
  id: string;
  phase: number;
  title: string;
  description: string;
  objective: string;
  completed: boolean;
  unlocks?: string[]; // Feature IDs that unlock on completion
  requirement?: string; // Previous quest ID required
}

export interface JourneyPhase {
  id: number;
  name: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface JourneyProgress {
  currentPhase: number;
  completedQuests: string[];
  unlockedFeatures: string[];
  achievements: string[];
  stats: {
    questionsAsked: number;
    articlesRead: string[];
    quizzesTaken: number;
    highestQuizScore: number;
    gamesPlayed: number;
    highestGameScore: number;
  };
}

// Quest definitions
export const QUESTS: Quest[] = [
  // Phase 2: First Contact
  {
    id: 'first-question',
    phase: 2,
    title: 'First Contact',
    description: 'The terminal awaits your voice',
    objective: 'Ask the Oracle a question',
    completed: false,
    unlocks: ['articles'],
  },

  // Phase 3: Exploration
  {
    id: 'read-article',
    phase: 3,
    title: 'Seek Wisdom',
    description: 'Knowledge lies within the archives',
    objective: 'Read an article from the archives',
    completed: false,
    requirement: 'first-question',
    unlocks: ['quiz'],
  },
  {
    id: 'take-quiz',
    phase: 3,
    title: 'Test Your Understanding',
    description: 'Prove you have absorbed the knowledge',
    objective: 'Complete a quiz on any article',
    completed: false,
    requirement: 'read-article',
  },

  // Phase 4: Mastery
  {
    id: 'quiz-mastery',
    phase: 4,
    title: 'Path of Mastery',
    description: 'True understanding requires excellence',
    objective: 'Achieve 80% or higher on a quiz',
    completed: false,
    requirement: 'take-quiz',
    unlocks: ['game'],
  },
  {
    id: 'play-game',
    phase: 4,
    title: 'Trial by Fire',
    description: 'Your reflexes must match your intellect',
    objective: 'Complete the Sphere Hunter challenge',
    completed: false,
    requirement: 'quiz-mastery',
    unlocks: ['leaderboard'],
  },

  // Phase 5: Transcendence
  {
    id: 'leaderboard-rank',
    phase: 5,
    title: 'Ascension',
    description: 'Join the ranks of the enlightened',
    objective: 'Score 5000+ points in Sphere Hunter',
    completed: false,
    requirement: 'play-game',
  },
];

export const PHASES: JourneyPhase[] = [
  {
    id: 1,
    name: 'awakening',
    title: 'Awakening',
    description: 'You have opened your eyes to a new world',
    unlocked: true,
  },
  {
    id: 2,
    name: 'first-contact',
    title: 'First Contact',
    description: 'The Oracle awaits your questions',
    unlocked: false,
  },
  {
    id: 3,
    name: 'exploration',
    title: 'Exploration',
    description: 'Seek wisdom in the knowledge archives',
    unlocked: false,
  },
  {
    id: 4,
    name: 'mastery',
    title: 'Mastery',
    description: 'Prove your understanding and skill',
    unlocked: false,
  },
  {
    id: 5,
    name: 'transcendence',
    title: 'Transcendence',
    description: 'You have become one with the knowledge',
    unlocked: false,
  },
];

// Achievements
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  hidden?: boolean; // Easter egg achievements
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    description: 'Completed your first quest',
    icon: '👣',
    unlocked: false,
  },
  {
    id: 'curious-mind',
    title: 'Curious Mind',
    description: 'Asked 10 questions',
    icon: '🤔',
    unlocked: false,
  },
  {
    id: 'bookworm',
    title: 'Bookworm',
    description: 'Read 5 different articles',
    icon: '📚',
    unlocked: false,
  },
  {
    id: 'scholar',
    title: 'Scholar',
    description: 'Achieved 100% on a quiz',
    icon: '🎓',
    unlocked: false,
  },
  {
    id: 'speed-reader',
    title: 'Speed Reader',
    description: 'Read 3 articles in under 5 minutes',
    icon: '⚡',
    unlocked: false,
    hidden: true,
  },
  {
    id: 'game-master',
    title: 'Game Master',
    description: 'Scored over 10,000 points',
    icon: '🎮',
    unlocked: false,
  },
  {
    id: 'perfectionist',
    title: 'Perfectionist',
    description: 'Completed all quests',
    icon: '✨',
    unlocked: false,
  },
  {
    id: 'seeker',
    title: 'True Seeker',
    description: 'Discovered the hidden message',
    icon: '🔮',
    unlocked: false,
    hidden: true,
  },
];
