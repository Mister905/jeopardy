import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GameState, Round } from '@prisma/client';
import { CreateGameResult } from './types';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Create a new game with a Final Jeopardy clue
   * @param userId - The authenticated user creating the game
   * @returns Created game with associated Final Jeopardy clue
   * @throws Error if userId is invalid, no clues available, or database operation fails
   */
  async createGame(userId: string): Promise<CreateGameResult> {
    this.logger.log(`Creating game for user: ${userId}`);

    // Step 1: Validate User
    this.validateUserId(userId);

    // Step 2: Select Final Jeopardy Clue
    const selectedClue = await this.selectFinalJeopardyClue();

    // Step 3 & 4: Create Game and FinalJeopardy Association in transaction
    const result = await this.prismaService.client.$transaction(
      async (prisma) => {
        // Step 3: Create Game Record
        const game = await prisma.game.create({
          data: {
            userId,
            state: GameState.PENDING,
            score: 0,
          },
        });

        this.logger.log(`Created game: ${game.id}`);

        // Step 4: Create FinalJeopardy Association
        const finalJeopardy = await prisma.finalJeopardy.create({
          data: {
            gameId: game.id,
            clueId: selectedClue.id,
            wager: 0, // Initial value, updated when player submits wager
          },
        });

        this.logger.log(
          `Created FinalJeopardy association: ${finalJeopardy.id} for clue: ${selectedClue.id}`,
        );

        // Step 5: Fetch complete game with relations
        const gameWithRelations = await prisma.game.findUnique({
          where: { id: game.id },
          include: {
            finalJeopardy: {
              include: {
                clue: true,
              },
            },
          },
        });

        if (!gameWithRelations || !gameWithRelations.finalJeopardy) {
          throw new Error('Failed to fetch created game with relations');
        }

        return {
          game: {
            id: gameWithRelations.id,
            userId: gameWithRelations.userId,
            state: gameWithRelations.state,
            score: gameWithRelations.score,
            createdAt: gameWithRelations.createdAt,
            updatedAt: gameWithRelations.updatedAt,
            finalJeopardy: {
              id: gameWithRelations.finalJeopardy.id,
              gameId: gameWithRelations.finalJeopardy.gameId,
              clueId: gameWithRelations.finalJeopardy.clueId,
              wager: gameWithRelations.finalJeopardy.wager,
              correct: gameWithRelations.finalJeopardy.correct,
              scoreDelta: gameWithRelations.finalJeopardy.scoreDelta,
              answeredAt: gameWithRelations.finalJeopardy.answeredAt,
              clue: {
                id: gameWithRelations.finalJeopardy.clue.id,
                category: gameWithRelations.finalJeopardy.clue.category,
                round: gameWithRelations.finalJeopardy.clue.round,
                value: gameWithRelations.finalJeopardy.clue.value,
                question: gameWithRelations.finalJeopardy.clue.question,
                answer: gameWithRelations.finalJeopardy.clue.answer,
                dailyDouble: gameWithRelations.finalJeopardy.clue.dailyDouble,
                createdAt: gameWithRelations.finalJeopardy.clue.createdAt,
              },
            },
          },
        };
      },
    );

    this.logger.log(`Game creation complete: ${result.game.id}`);
    return result;
  }

  /**
   * Validate that userId is provided and non-empty
   * @param userId - User ID to validate
   * @throws Error if userId is missing or empty
   */
  private validateUserId(userId: string): void {
    if (!userId || userId.trim().length === 0) {
      const error: Error = new Error('User ID is required');
      error.name = 'ValidationError';
      throw error;
    }
  }

  /**
   * Select a Final Jeopardy clue deterministically
   * Algorithm: First Available - selects the first clue from query results
   * This is deterministic (same query = same result) and simple to implement.
   * Can be enhanced later for variety if needed.
   *
   * @returns Selected Final Jeopardy clue
   * @throws Error if no clues are available
   */
  private async selectFinalJeopardyClue() {
    const prisma = this.prismaService.client;

    // Query for Final Jeopardy clues
    const clues = await prisma.clue.findMany({
      where: {
        round: Round.FINAL,
      },
      take: 1, // Only need first clue for "First Available" algorithm
    });

    if (clues.length === 0) {
      const error: Error = new Error(
        'No Final Jeopardy clues available in database',
      );
      error.name = 'NoCluesAvailable';
      throw error;
    }

    const selectedClue = clues[0];
    this.logger.debug(
      `Selected Final Jeopardy clue: ${selectedClue.id} (category: ${selectedClue.category})`,
    );

    return selectedClue;
  }
}
