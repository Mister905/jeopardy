export interface UserStats {
  totalGamesPlayed: number;
  averageScore: number;
  bestScore: number | null;
  worstScore: number | null;
  totalWinnings: number;
  overallAccuracy: number | null;
  correctAnswerCount: number;
  incorrectAnswerCount: number;
  jeopardyAccuracy: number | null;
  doubleJeopardyAccuracy: number | null;
  finalJeopardyAccuracy: number | null;
  dailyDoubleAccuracy: number | null;
  currentCorrectStreak: number;
  longestCorrectStreak: number;
  currentIncorrectStreak: number;
  longestIncorrectStreak: number;
  largestSuccessfulDailyDoubleWager: number | null;
  largestSuccessfulFinalJeopardyWager: number | null;
  largestUnsuccessfulDailyDoubleWager: number | null;
  largestUnsuccessfulFinalJeopardyWager: number | null;
}

export interface UserProfileResponse {
  username: string;
  stats: UserStats;
}
