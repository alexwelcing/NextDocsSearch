export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface ArticleData {
  title: string;
  date: string;
  author: string[];
  filename?: string;
  length?: number;
  slug?: string;
  description?: string;
}

export interface BackgroundImageResponse {
  image: string;
}

export interface SplatsResponse {
  files: string[];
}

export interface VectorSearchRequest {
  prompt: string;
  history?: { question: string; response: string }[];
  questContext?: {
    currentQuest?: string;
    currentPhase?: number;
    completedQuests?: string[];
    missionBrief?: string;
  };
}
