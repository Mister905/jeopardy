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

    // Compute accuracy percentages
    const overallAccuracy = this.calculateAccuracy(
      user.totalCorrectAnswers,
      user.totalIncorrectAnswers,
    );
    const jeopardyAccuracy = this.calculateAccuracy(
      user.jeopardyCorrect,
      user.jeopardyIncorrect,
    );
    const doubleJeopardyAccuracy = this.calculateAccuracy(
      user.doubleJeopardyCorrect,
      user.doubleJeopardyIncorrect,
    );
    const finalJeopardyAccuracy = this.calculateAccuracy(
      user.finalJeopardyCorrect,
      user.finalJeopardyIncorrect,
    );
    const dailyDoubleAccuracy = this.calculateAccuracy(
      user.dailyDoubleCorrect,
      user.dailyDoubleIncorrect,
    );

    return {
      username: user.username,
      stats: {
        totalGamesPlayed: user.totalGamesPlayed,
        averageScore: user.averageScore,
        bestScore: user.bestScore,
        worstScore: user.worstScore,
        totalWinnings: user.totalWinnings,
        overallAccuracy,
        correctAnswerCount: user.totalCorrectAnswers,
        incorrectAnswerCount: user.totalIncorrectAnswers,
        jeopardyAccuracy,
        doubleJeopardyAccuracy,
        finalJeopardyAccuracy,
        dailyDoubleAccuracy,
        currentCorrectStreak: user.currentCorrectStreak,
        longestCorrectStreak: user.longestCorrectStreak,
        currentIncorrectStreak: user.currentIncorrectStreak,
        longestIncorrectStreak: user.longestIncorrectStreak,
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
    try {
      const round = gameClue.clue.round;
      const isDailyDouble = gameClue.isDailyDouble || gameClue.wager !== null;

      // Fetch current user to get streak state
      const user = await this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: {
          currentCorrectStreak: true,
          currentIncorrectStreak: true,
          longestCorrectStreak: true,
          longestIncorrectStreak: true,
        },
      });

      if (!user) {
        this.logger.warn(`User ${userId} not found for stat update`);
        return;
      }

      // Calculate new streak values
      let newCurrentCorrectStreak = user.currentCorrectStreak;
      let newCurrentIncorrectStreak = user.currentIncorrectStreak;
      let newLongestCorrectStreak = user.longestCorrectStreak;
      let newLongestIncorrectStreak = user.longestIncorrectStreak;

      if (correct) {
        newCurrentCorrectStreak = user.currentCorrectStreak + 1;
        newCurrentIncorrectStreak = 0;
        if (newCurrentCorrectStreak > user.longestCorrectStreak) {
          newLongestCorrectStreak = newCurrentCorrectStreak;
        }
      } else {
        newCurrentIncorrectStreak = user.currentIncorrectStreak + 1;
        newCurrentCorrectStreak = 0;
        if (newCurrentIncorrectStreak > user.longestIncorrectStreak) {
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

      // Update overall counters
      if (correct) {
        updateData.totalCorrectAnswers = { increment: 1 };
      } else {
        updateData.totalIncorrectAnswers = { increment: 1 };
      }

      // Update round-specific counters
      if (round === Round.JEOPARDY) {
        if (correct) {
          updateData.jeopardyCorrect = { increment: 1 };
        } else {
          updateData.jeopardyIncorrect = { increment: 1 };
        }
      } else if (round === Round.DOUBLE_JEOPARDY) {
        if (correct) {
          updateData.doubleJeopardyCorrect = { increment: 1 };
        } else {
          updateData.doubleJeopardyIncorrect = { increment: 1 };
        }
      }

      // Update Daily Double counters if applicable
      if (isDailyDouble) {
        if (correct) {
          updateData.dailyDoubleCorrect = { increment: 1 };
        } else {
          updateData.dailyDoubleIncorrect = { increment: 1 };
        }
      }

      await this.prismaService.client.user.update({
        where: { id: userId },
        data: updateData,
      });
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

      const updateData: Prisma.UserUpdateInput = {};

      if (correct) {
        if (
          !user.largestSuccessfulDailyDoubleWager ||
          wager > user.largestSuccessfulDailyDoubleWager
        ) {
          updateData.largestSuccessfulDailyDoubleWager = wager;
        }
      } else {
        if (
          !user.largestUnsuccessfulDailyDoubleWager ||
          wager > user.largestUnsuccessfulDailyDoubleWager
        ) {
          updateData.largestUnsuccessfulDailyDoubleWager = wager;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await this.prismaService.client.user.update({
          where: { id: userId },
          data: updateData,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to update Daily Double wager stats: ${error.message}`,
      );
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

      const updateData: Prisma.UserUpdateInput = {};

      if (correct) {
        updateData.finalJeopardyCorrect = { increment: 1 };
        if (
          !user.largestSuccessfulFinalJeopardyWager ||
          wager > user.largestSuccessfulFinalJeopardyWager
        ) {
          updateData.largestSuccessfulFinalJeopardyWager = wager;
        }
      } else {
        updateData.finalJeopardyIncorrect = { increment: 1 };
        if (
          !user.largestUnsuccessfulFinalJeopardyWager ||
          wager > user.largestUnsuccessfulFinalJeopardyWager
        ) {
          updateData.largestUnsuccessfulFinalJeopardyWager = wager;
        }
      }

      await this.prismaService.client.user.update({
        where: { id: userId },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update Final Jeopardy wager stats: ${error.message}`,
      );
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

      const newTotalGames = user.totalGamesPlayed + 1;
      const newAverageScore =
        (user.averageScore * user.totalGamesPlayed + finalScore) /
        newTotalGames;

      const updateData: Prisma.UserUpdateInput = {
        totalGamesPlayed: { increment: 1 },
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
      if (finalScore > 0) {
        updateData.totalWinnings = { increment: finalScore };
      }

      await this.prismaService.client.user.update({
        where: { id: userId },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(
        `Failed to update game completion stats: ${error.message}`,
      );
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
