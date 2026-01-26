import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, GameClue, Round, Prisma } from '@prisma/client';
import { UserProfileResponse } from './dto/user-profile.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Ensure User exists, creating if necessary or updating username if missing
   */
  async ensureUserExists(
    userId: string,
    email: string,
    username?: string,
  ): Promise<User> {
    // Validate username if provided
    if (username !== undefined && username !== null) {
      if (typeof username !== 'string' || username.trim().length === 0) {
        throw new Error('Username must be a non-empty string');
      }
      if (username.length < 3 || username.length > 50) {
        throw new Error('Username must be between 3 and 50 characters');
      }
    }

    const existingUser = await this.prismaService.client.user.findUnique({
      where: { id: userId },
    });

    if (existingUser) {
      // If user exists but username is missing, update it
      if (!existingUser.username && username) {
        return this.prismaService.client.user.update({
          where: { id: userId },
          data: { username: username.trim() },
        });
      }
      return existingUser;
    }

    // User doesn't exist - create with username (required for new users)
    if (!username) {
      throw new Error('Username is required for new users');
    }

    // Validate email is not empty for new users
    if (!email || email.trim().length === 0) {
      throw new Error('Email is required for new users');
    }

    return this.prismaService.client.user.create({
      data: {
        id: userId,
        email: email.trim(),
        username: username.trim(),
      },
    });
  }

  /**
   * Get user profile with computed statistics
   */
  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.prismaService.client.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Compute accuracy percentages - handle null values by treating as 0
    const overallAccuracy = this.calculateAccuracy(
      user.totalCorrectAnswers ?? 0,
      user.totalIncorrectAnswers ?? 0,
    );
    const jeopardyAccuracy = this.calculateAccuracy(
      user.jeopardyCorrect ?? 0,
      user.jeopardyIncorrect ?? 0,
    );
    const doubleJeopardyAccuracy = this.calculateAccuracy(
      user.doubleJeopardyCorrect ?? 0,
      user.doubleJeopardyIncorrect ?? 0,
    );
    const finalJeopardyAccuracy = this.calculateAccuracy(
      user.finalJeopardyCorrect ?? 0,
      user.finalJeopardyIncorrect ?? 0,
    );
    const dailyDoubleAccuracy = this.calculateAccuracy(
      user.dailyDoubleCorrect ?? 0,
      user.dailyDoubleIncorrect ?? 0,
    );

    return {
      username: user.username,
      stats: {
        totalGamesPlayed: user.totalGamesPlayed ?? null,
        averageScore: user.averageScore ?? null,
        bestScore: user.bestScore,
        worstScore: user.worstScore,
        totalWinnings: user.totalWinnings ?? 0,
        overallAccuracy,
        correctAnswerCount: user.totalCorrectAnswers ?? null,
        incorrectAnswerCount: user.totalIncorrectAnswers ?? null,
        jeopardyAccuracy,
        doubleJeopardyAccuracy,
        finalJeopardyAccuracy,
        dailyDoubleAccuracy,
        currentCorrectStreak: user.currentCorrectStreak ?? null,
        longestCorrectStreak: user.longestCorrectStreak ?? null,
        currentIncorrectStreak: user.currentIncorrectStreak ?? null,
        longestIncorrectStreak: user.longestIncorrectStreak ?? null,
        largestSuccessfulDailyDoubleWager: user.largestSuccessfulDailyDoubleWager,
        largestSuccessfulFinalJeopardyWager:
          user.largestSuccessfulFinalJeopardyWager,
        largestUnsuccessfulDailyDoubleWager:
          user.largestUnsuccessfulDailyDoubleWager,
        largestUnsuccessfulFinalJeopardyWager:
          user.largestUnsuccessfulFinalJeopardyWager,
      },
    };
  }

  /**
   * Update user statistics when a clue is resolved
   */
  async updateUserStatsOnClueResolved(
    userId: string,
    gameClue: GameClue & { clue: { round: Round } },
    correct: boolean,
  ): Promise<void> {
    this.logger.log(
      `Updating stats for clue resolution - User: ${userId}, Round: ${gameClue.clue.round}, Daily Double: ${gameClue.isDailyDouble || gameClue.wager !== null}, Correct: ${correct}`,
    );
    try {
      const round = gameClue.clue.round;
      const isDailyDouble = gameClue.isDailyDouble || gameClue.wager !== null;

      // Fetch current user to get streak state and current counters
      const user = await this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          currentCorrectStreak: true,
          currentIncorrectStreak: true,
          longestCorrectStreak: true,
          longestIncorrectStreak: true,
          totalCorrectAnswers: true,
          totalIncorrectAnswers: true,
          jeopardyCorrect: true,
          jeopardyIncorrect: true,
          doubleJeopardyCorrect: true,
          doubleJeopardyIncorrect: true,
          dailyDoubleCorrect: true,
          dailyDoubleIncorrect: true,
        },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found for stat update`);
        return;
      }

      this.logger.log(
        `Current stats - Total: ${user.totalCorrectAnswers ?? 'null'}/${user.totalIncorrectAnswers ?? 'null'}, Jeopardy: ${user.jeopardyCorrect ?? 'null'}/${user.jeopardyIncorrect ?? 'null'}, Double: ${user.doubleJeopardyCorrect ?? 'null'}/${user.doubleJeopardyIncorrect ?? 'null'}, DD: ${user.dailyDoubleCorrect ?? 'null'}/${user.dailyDoubleIncorrect ?? 'null'}`,
      );

      // Handle null values - treat as 0 for calculations
      const currentCorrectStreak = user.currentCorrectStreak ?? 0;
      const currentIncorrectStreak = user.currentIncorrectStreak ?? 0;
      const longestCorrectStreak = user.longestCorrectStreak ?? 0;
      const longestIncorrectStreak = user.longestIncorrectStreak ?? 0;

      // Calculate new streak values
      let newCurrentCorrectStreak = currentCorrectStreak;
      let newCurrentIncorrectStreak = currentIncorrectStreak;
      let newLongestCorrectStreak = longestCorrectStreak;
      let newLongestIncorrectStreak = longestIncorrectStreak;

      if (correct) {
        newCurrentCorrectStreak = currentCorrectStreak + 1;
        newCurrentIncorrectStreak = 0;
        if (newCurrentCorrectStreak > longestCorrectStreak) {
          newLongestCorrectStreak = newCurrentCorrectStreak;
        }
      } else {
        newCurrentIncorrectStreak = currentIncorrectStreak + 1;
        newCurrentCorrectStreak = 0;
        if (newCurrentIncorrectStreak > longestIncorrectStreak) {
          newLongestIncorrectStreak = newCurrentIncorrectStreak;
        }
      }

      // Build update data with proper typing
      const updateData: Prisma.UserUpdateInput = {
        currentCorrectStreak: newCurrentCorrectStreak,
        currentIncorrectStreak: newCurrentIncorrectStreak,
        longestCorrectStreak: newLongestCorrectStreak,
        longestIncorrectStreak: newLongestIncorrectStreak,
      };

      // Update overall counters - handle null by treating as 0
      if (correct) {
        const currentTotal = user.totalCorrectAnswers ?? 0;
        updateData.totalCorrectAnswers = currentTotal + 1;
      } else {
        const currentTotal = user.totalIncorrectAnswers ?? 0;
        updateData.totalIncorrectAnswers = currentTotal + 1;
      }

      // Update round-specific counters
      if (round === Round.JEOPARDY) {
        if (correct) {
          const current = user.jeopardyCorrect ?? 0;
          updateData.jeopardyCorrect = current + 1;
        } else {
          const current = user.jeopardyIncorrect ?? 0;
          updateData.jeopardyIncorrect = current + 1;
        }
      } else if (round === Round.DOUBLE_JEOPARDY) {
        if (correct) {
          const current = user.doubleJeopardyCorrect ?? 0;
          updateData.doubleJeopardyCorrect = current + 1;
        } else {
          const current = user.doubleJeopardyIncorrect ?? 0;
          updateData.doubleJeopardyIncorrect = current + 1;
        }
      }

      // Update Daily Double counters if applicable
      if (isDailyDouble) {
        if (correct) {
          const current = user.dailyDoubleCorrect ?? 0;
          updateData.dailyDoubleCorrect = current + 1;
        } else {
          const current = user.dailyDoubleIncorrect ?? 0;
          updateData.dailyDoubleIncorrect = current + 1;
        }
      }

      this.logger.log(`Updating stats with: ${JSON.stringify(updateData)}`);

      const updatedUser = await this.prismaService.client.user.update({
        where: { id: userId },
        data: updateData,
      });

      this.logger.log(
        `Updated stats - Total: ${updatedUser.totalCorrectAnswers ?? 'null'}/${updatedUser.totalIncorrectAnswers ?? 'null'}, Jeopardy: ${updatedUser.jeopardyCorrect ?? 'null'}/${updatedUser.jeopardyIncorrect ?? 'null'}, Double: ${updatedUser.doubleJeopardyCorrect ?? 'null'}/${updatedUser.doubleJeopardyIncorrect ?? 'null'}, DD: ${updatedUser.dailyDoubleCorrect ?? 'null'}/${updatedUser.dailyDoubleIncorrect ?? 'null'}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update user stats on clue resolution: ${error.message}`,
      );
      // Don't throw - stats are secondary to game operations
    }
  }

  /**
   * Update user statistics when a Daily Double wager is resolved
   */
  async updateUserStatsOnDailyDoubleWager(
    userId: string,
    wager: number,
    correct: boolean,
  ): Promise<void> {
    this.logger.log(
      `Updating Daily Double wager stats for user ${userId}: wager=${wager}, correct=${correct}`,
    );
    try {
      const user = await this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          largestSuccessfulDailyDoubleWager: true,
          largestUnsuccessfulDailyDoubleWager: true,
        },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found for Daily Double stat update`);
        return;
      }

      this.logger.log(
        `Current Daily Double stats - Successful: ${user.largestSuccessfulDailyDoubleWager ?? 'null'}, Unsuccessful: ${user.largestUnsuccessfulDailyDoubleWager ?? 'null'}`,
      );

      const updateData: Prisma.UserUpdateInput = {};

      if (correct) {
        if (
          !user.largestSuccessfulDailyDoubleWager ||
          wager > user.largestSuccessfulDailyDoubleWager
        ) {
          updateData.largestSuccessfulDailyDoubleWager = wager;
          this.logger.log(`Updating largest successful Daily Double wager to ${wager}`);
        } else {
          this.logger.log(`Wager ${wager} not larger than current ${user.largestSuccessfulDailyDoubleWager}, skipping update`);
        }
      } else {
        if (
          !user.largestUnsuccessfulDailyDoubleWager ||
          wager > user.largestUnsuccessfulDailyDoubleWager
        ) {
          updateData.largestUnsuccessfulDailyDoubleWager = wager;
          this.logger.log(`Updating largest unsuccessful Daily Double wager to ${wager}`);
        } else {
          this.logger.log(`Wager ${wager} not larger than current ${user.largestUnsuccessfulDailyDoubleWager}, skipping update`);
        }
      }

      if (Object.keys(updateData).length > 0) {
        await this.prismaService.client.user.update({
          where: { id: userId },
          data: updateData,
        });
        this.logger.log(`Successfully updated Daily Double wager stats`);
      } else {
        this.logger.log(`No update needed for Daily Double wager stats`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to update Daily Double wager stats for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      // Don't throw - stats are secondary
    }
  }

  /**
   * Update user statistics when Final Jeopardy is answered
   */
  async updateUserStatsOnFinalJeopardyWager(
    userId: string,
    wager: number,
    correct: boolean,
  ): Promise<void> {
    this.logger.log(
      `Updating Final Jeopardy wager stats for user ${userId}: wager=${wager}, correct=${correct}`,
    );
    try {
      const user = await this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          largestSuccessfulFinalJeopardyWager: true,
          largestUnsuccessfulFinalJeopardyWager: true,
          finalJeopardyCorrect: true,
          finalJeopardyIncorrect: true,
        },
      });

      if (!user) {
        this.logger.warn(
          `User ${userId} not found for Final Jeopardy stat update`,
        );
        return;
      }

      this.logger.log(
        `Current Final Jeopardy stats - Successful: ${user.largestSuccessfulFinalJeopardyWager ?? 'null'}, Unsuccessful: ${user.largestUnsuccessfulFinalJeopardyWager ?? 'null'}`,
      );

      this.logger.log(
        `Current Final Jeopardy stats - Correct: ${user.finalJeopardyCorrect ?? 'null'}, Incorrect: ${user.finalJeopardyIncorrect ?? 'null'}`,
      );

      const updateData: Prisma.UserUpdateInput = {};

      if (correct) {
        const current = user.finalJeopardyCorrect ?? 0;
        updateData.finalJeopardyCorrect = current + 1;
        if (
          !user.largestSuccessfulFinalJeopardyWager ||
          wager > user.largestSuccessfulFinalJeopardyWager
        ) {
          updateData.largestSuccessfulFinalJeopardyWager = wager;
          this.logger.log(`Updating largest successful Final Jeopardy wager to ${wager}`);
        } else {
          this.logger.log(`Wager ${wager} not larger than current ${user.largestSuccessfulFinalJeopardyWager}, skipping update`);
        }
      } else {
        const current = user.finalJeopardyIncorrect ?? 0;
        updateData.finalJeopardyIncorrect = current + 1;
        if (
          !user.largestUnsuccessfulFinalJeopardyWager ||
          wager > user.largestUnsuccessfulFinalJeopardyWager
        ) {
          updateData.largestUnsuccessfulFinalJeopardyWager = wager;
          this.logger.log(`Updating largest unsuccessful Final Jeopardy wager to ${wager}`);
        } else {
          this.logger.log(`Wager ${wager} not larger than current ${user.largestUnsuccessfulFinalJeopardyWager}, skipping update`);
        }
      }

      await this.prismaService.client.user.update({
        where: { id: userId },
        data: updateData,
      });
      this.logger.log(`Successfully updated Final Jeopardy wager stats`);
    } catch (error) {
      this.logger.error(
        `Failed to update Final Jeopardy wager stats for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      // Don't throw - stats are secondary
    }
  }

  /**
   * Update user statistics when a game is completed
   */
  async updateUserStatsOnGameComplete(
    userId: string,
    finalScore: number,
  ): Promise<void> {
    this.logger.log(
      `Updating game completion stats for user ${userId} with final score ${finalScore}`,
    );
    try {
      const user = await this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          totalGamesPlayed: true,
          averageScore: true,
          bestScore: true,
          worstScore: true,
          totalWinnings: true,
        },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found for game completion stat update`);
        return;
      }

      this.logger.log(
        `Current stats - Games: ${user.totalGamesPlayed ?? 'null'}, Avg: ${user.averageScore ?? 'null'}, Best: ${user.bestScore ?? 'null'}, Worst: ${user.worstScore ?? 'null'}, Winnings: ${user.totalWinnings ?? 'null'}`,
      );

      // Handle null values - treat as 0 for calculations
      const currentGamesPlayed = user.totalGamesPlayed ?? 0;
      const currentAverageScore = user.averageScore ?? 0;
      const newTotalGames = currentGamesPlayed + 1;
      const newAverageScore =
        (currentAverageScore * currentGamesPlayed + finalScore) /
        newTotalGames;

      const updateData: Prisma.UserUpdateInput = {
        totalGamesPlayed: newTotalGames,
        averageScore: newAverageScore,
      };

      // Update best score
      if (user.bestScore === null || finalScore > user.bestScore) {
        updateData.bestScore = finalScore;
      }

      // Update worst score
      if (user.worstScore === null || finalScore < user.worstScore) {
        updateData.worstScore = finalScore;
      }

      // Update total winnings (only if positive)
      // Always ensure totalWinnings is set (not null) - 0 if score is negative or zero
      const currentWinnings = user.totalWinnings ?? 0;
      if (finalScore > 0) {
        updateData.totalWinnings = currentWinnings + finalScore;
      } else {
        // Set to current winnings (or 0 if null) - ensures field is never null
        updateData.totalWinnings = currentWinnings;
      }

      this.logger.log(`Updating user stats with: ${JSON.stringify(updateData)}`);

      const updatedUser = await this.prismaService.client.user.update({
        where: { id: userId },
        data: updateData,
      });

      this.logger.log(
        `Successfully updated stats - Games: ${updatedUser.totalGamesPlayed}, Avg: ${updatedUser.averageScore}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update game completion stats for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.logger.error(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      // Don't throw - stats are secondary
    }
  }

  /**
   * Calculate accuracy percentage, handling division by zero
   */
  private calculateAccuracy(
    correct: number,
    incorrect: number,
  ): number | null {
    const total = correct + incorrect;
    if (total === 0) {
      return null;
    }
    return (correct / total) * 100;
  }
}
