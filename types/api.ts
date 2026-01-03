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
  questContext?: any; // Define stricter type if possible
}

export interface GameLeaderboardEntry {
  id: number;
  player_name: string;
  score: number;
  combo_max: number;
  accuracy: number;
  created_at: string;
}

export interface LeaderboardResponse {
  leaderboard: GameLeaderboardEntry[];
}
