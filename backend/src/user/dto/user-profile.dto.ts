export interface UserStats {
  totalGamesPlayed: number | null;
  averageScore: number | null;
  bestScore: number | null;
  worstScore: number | null;
  totalWinnings: number | null;
  overallAccuracy: number | null;
  correctAnswerCount: number | null;
  incorrectAnswerCount: number | null;
  jeopardyAccuracy: number | null;
  doubleJeopardyAccuracy: number | null;
  finalJeopardyAccuracy: number | null;
  dailyDoubleAccuracy: number | null;
  currentCorrectStreak: number | null;
  longestCorrectStreak: number | null;
  currentIncorrectStreak: number | null;
  longestIncorrectStreak: number | null;
  largestSuccessfulDailyDoubleWager: number | null;
  largestSuccessfulFinalJeopardyWager: number | null;
  largestUnsuccessfulDailyDoubleWager: number | null;
  largestUnsuccessfulFinalJeopardyWager: number | null;
}

export interface UserProfileResponse {
  username: string;
  stats: UserStats;
}
