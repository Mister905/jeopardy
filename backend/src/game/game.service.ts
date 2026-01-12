import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GameState,
  Round,
  ClueState,
  Game,
  GameClue,
  FinalJeopardy,
  Clue,
} from '@prisma/client';
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

  /**
   * Get a game by ID with all relations
   * @param gameId - Game ID
   * @param userId - User ID for authorization check
   * @returns Game with relations or null if not found
   */
  async getGameById(
    gameId: string,
    userId: string,
  ): Promise<
    | (Game & {
        gameClues?: (GameClue & { clue: Clue })[];
        finalJeopardy?: (FinalJeopardy & { clue: Clue }) | null;
      })
    | null
  > {
    const game = await this.prismaService.client.game.findUnique({
      where: { id: gameId },
      include: {
        gameClues: {
          include: {
            clue: true,
          },
        },
        finalJeopardy: {
          include: {
            clue: true,
          },
        },
      },
    });

    if (!game) {
      return null;
    }

    // Verify ownership
    if (game.userId !== userId) {
      return null;
    }

    return game;
  }

  /**
   * List games for a user with optional filtering and pagination
   * @param userId - User ID
   * @param status - Optional game state filter
   * @param limit - Maximum number of results (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns List of games with total count
   */
  async listGames(
    userId: string,
    status?: GameState,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{
    games: Game[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const maxLimit = Math.min(limit, 100);
    const where = {
      userId,
      ...(status && { state: status }),
    };

    const [games, total] = await Promise.all([
      this.prismaService.client.game.findMany({
        where,
        take: maxLimit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.client.game.count({ where }),
    ]);

    return {
      games,
      total,
      limit: maxLimit,
      offset,
    };
  }

  /**
   * Start a game by creating Jeopardy and Double Jeopardy boards
   * @param gameId - Game ID
   * @param userId - User ID for authorization
   * @throws Error if game not found, wrong user, or invalid state
   */
  async startGame(gameId: string, userId: string): Promise<Game> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    if (game.state !== GameState.PENDING) {
      throw new Error(`Game cannot be started. Current state: ${game.state}`);
    }

    // TODO: Implement board creation logic
    // This requires:
    // 1. Select 6 categories × 5 clues for Jeopardy round
    // 2. Select 6 categories × 5 clues for Double Jeopardy round
    // 3. Ensure Jeopardy has exactly 1 Daily Double
    // 4. Ensure Double Jeopardy has exactly 2 Daily Doubles
    // 5. Create GameClue records for all clues
    // 6. Transition game state to ACTIVE

    throw new Error('Game board creation not yet implemented');
  }

  /**
   * Get the current round's board state
   * @param gameId - Game ID
   * @param userId - User ID for authorization
   * @param round - Optional specific round to retrieve
   * @returns Board state or null
   */
  async getBoard(
    gameId: string,
    userId: string,
    round?: Round,
  ): Promise<any> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    // TODO: Implement board retrieval logic
    // This requires building the board structure based on game state and round

    throw new Error('Board retrieval not yet implemented');
  }

  /**
   * Answer a clue (regular or Daily Double)
   * @param gameId - Game ID
   * @param clueId - GameClue ID
   * @param userId - User ID for authorization
   * @param correct - Whether the answer was correct
   * @returns Updated game clue and new score
   */
  async answerClue(
    gameId: string,
    clueId: string,
    userId: string,
    correct: boolean,
  ): Promise<{
    gameClue: GameClue;
    newScore: number;
  }> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    if (game.state !== GameState.ACTIVE) {
      throw new Error(`Game is not in an active state: ${game.state}`);
    }

    // TODO: Implement clue answering logic
    // This requires:
    // 1. Find GameClue by ID
    // 2. Verify clue belongs to game
    // 3. Verify clue is not already resolved
    // 4. Calculate score delta
    // 5. Update game score
    // 6. Update clue state to RESOLVED
    // 7. Check if all clues resolved, transition to FINAL_PENDING if so

    throw new Error('Clue answering not yet implemented');
  }

  /**
   * Submit a wager for a Daily Double clue
   * @param gameId - Game ID
   * @param clueId - GameClue ID
   * @param userId - User ID for authorization
   * @param wager - Wager amount
   * @returns Updated game clue
   */
  async submitClueWager(
    gameId: string,
    clueId: string,
    userId: string,
    wager: number,
  ): Promise<GameClue> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    if (game.state !== GameState.ACTIVE) {
      throw new Error(`Game is not in an active state: ${game.state}`);
    }

    // TODO: Implement wager submission logic
    // This requires:
    // 1. Find GameClue by ID
    // 2. Verify clue is a Daily Double
    // 3. Verify clue is UNANSWERED
    // 4. Validate wager amount (min $5, max based on score and round)
    // 5. Update GameClue with wager
    // 6. Transition clue state to ANSWERED

    throw new Error('Clue wager submission not yet implemented');
  }

  /**
   * Submit a wager for Final Jeopardy
   * @param gameId - Game ID
   * @param userId - User ID for authorization
   * @param wager - Wager amount
   * @returns Updated Final Jeopardy record
   */
  async submitFinalJeopardyWager(
    gameId: string,
    userId: string,
    wager: number,
  ): Promise<FinalJeopardy> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    if (game.state !== GameState.FINAL_PENDING) {
      throw new Error(`Game is not eligible for Final Jeopardy. Current state: ${game.state}`);
    }

    if (game.score <= 0) {
      throw new Error('Player was eliminated after Double Jeopardy');
    }

    if (wager < 0 || wager > game.score) {
      throw new Error(`Wager cannot exceed current score of $${game.score}`);
    }

    // Update Final Jeopardy wager and transition to FINAL_ACTIVE
    const updated = await this.prismaService.client.$transaction(
      async (prisma) => {
        const finalJeopardy = await prisma.finalJeopardy.update({
          where: { gameId },
          data: { wager },
        });

        await prisma.game.update({
          where: { id: gameId },
          data: { state: GameState.FINAL_ACTIVE },
        });

        return finalJeopardy;
      },
    );

    return updated;
  }

  /**
   * Submit the answer for Final Jeopardy
   * @param gameId - Game ID
   * @param userId - User ID for authorization
   * @param correct - Whether the answer was correct
   * @returns Updated game and final score
   */
  async answerFinalJeopardy(
    gameId: string,
    userId: string,
    correct: boolean,
  ): Promise<{
    game: Game;
    finalJeopardy: FinalJeopardy;
    finalScore: number;
  }> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    if (game.state !== GameState.FINAL_ACTIVE) {
      throw new Error(`Game is not in Final Jeopardy active state: ${game.state}`);
    }

    if (!game.finalJeopardy) {
      throw new Error('Final Jeopardy record not found');
    }

    if (game.finalJeopardy.wager <= 0) {
      throw new Error('Wager must be submitted first');
    }

    if (game.finalJeopardy.answeredAt !== null) {
      throw new Error('Final Jeopardy has already been answered');
    }

    const wager = game.finalJeopardy.wager;
    const scoreDelta = correct ? wager : -wager;
    const finalScore = game.score + scoreDelta;

    // Update Final Jeopardy and game state
    const result = await this.prismaService.client.$transaction(
      async (prisma) => {
        const finalJeopardy = await prisma.finalJeopardy.update({
          where: { gameId },
          data: {
            correct,
            scoreDelta,
            answeredAt: new Date(),
          },
        });

        const updatedGame = await prisma.game.update({
          where: { id: gameId },
          data: {
            score: finalScore,
            state: GameState.COMPLETED,
          },
        });

        return { game: updatedGame, finalJeopardy };
      },
    );

    return {
      game: result.game,
      finalJeopardy: result.finalJeopardy,
      finalScore,
    };
  }
}
