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
   * Select a Final Jeopardy clue randomly
   * Algorithm: Random selection from all available Final Jeopardy clues
   * This provides variety in the questions players see.
   *
   * @returns Selected Final Jeopardy clue
   * @throws Error if no clues are available
   */
  private async selectFinalJeopardyClue() {
    const prisma = this.prismaService.client;

    // Query for all Final Jeopardy clues
    const clues = await prisma.clue.findMany({
      where: {
        round: Round.FINAL,
      },
    });

    if (clues.length === 0) {
      const error: Error = new Error(
        'No Final Jeopardy clues available in database',
      );
      error.name = 'NoCluesAvailable';
      throw error;
    }

    // Randomly select one clue from the available clues
    const randomIndex = Math.floor(Math.random() * clues.length);
    const selectedClue = clues[randomIndex];
    
    this.logger.debug(
      `Selected Final Jeopardy clue: ${selectedClue.id} (category: ${selectedClue.category}) from ${clues.length} available clues`,
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
  ): Promise<{
    gameId: string;
    currentRound: Round | null;
    gameState: GameState;
    score: number;
    board: any | null;
  }> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    // If game is PENDING, no board exists yet
    if (game.state === GameState.PENDING) {
      return {
        gameId: game.id,
        currentRound: null,
        gameState: game.state,
        score: game.score,
        board: null,
      };
    }

    // If game doesn't have GameClues, return null board
    if (!game.gameClues || game.gameClues.length === 0) {
      return {
        gameId: game.id,
        currentRound: null,
        gameState: game.state,
        score: game.score,
        board: null,
      };
    }

    // Determine which round to show
    // If round is specified, use it; otherwise determine from game state
    let targetRound: Round | null = round || null;
    if (!targetRound) {
      // Determine current round based on game state and clues
      const jeopardyClues = game.gameClues.filter((gc) => gc.clue.round === Round.JEOPARDY);
      const doubleJeopardyClues = game.gameClues.filter(
        (gc) => gc.clue.round === Round.DOUBLE_JEOPARDY,
      );

      // If there are unanswered clues in Jeopardy, show Jeopardy
      const unansweredJeopardy = jeopardyClues.some((gc) => gc.state === ClueState.UNANSWERED);
      if (unansweredJeopardy) {
        targetRound = Round.JEOPARDY;
      } else if (doubleJeopardyClues.length > 0) {
        // Otherwise show Double Jeopardy if it exists
        targetRound = Round.DOUBLE_JEOPARDY;
      } else if (jeopardyClues.length > 0) {
        targetRound = Round.JEOPARDY;
      }
    }

    if (!targetRound || (targetRound !== Round.JEOPARDY && targetRound !== Round.DOUBLE_JEOPARDY)) {
      return {
        gameId: game.id,
        currentRound: null,
        gameState: game.state,
        score: game.score,
        board: null,
      };
    }

    // Filter GameClues for the target round
    const roundClues = game.gameClues.filter((gc) => gc.clue.round === targetRound);

    // Group clues by category
    const categoryMap = new Map<string, typeof roundClues>();
    for (const gameClue of roundClues) {
      const category = gameClue.clue.category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category)!.push(gameClue);
    }

    // Build categories array
    const categories = Array.from(categoryMap.entries()).map(([categoryName, clues]) => {
      // Sort clues by value
      const sortedClues = [...clues].sort((a, b) => a.clue.value - b.clue.value);

      return {
        name: categoryName,
        clues: sortedClues.map((gc) => ({
          gameClueId: gc.id,
          clueId: gc.clueId,
          value: gc.clue.value,
          state: gc.state as 'UNANSWERED' | 'ANSWERED' | 'RESOLVED',
          dailyDouble: gc.isDailyDouble || gc.clue.dailyDouble,
          question: gc.state !== ClueState.UNANSWERED ? gc.clue.question : undefined,
          answer: gc.state === ClueState.RESOLVED ? gc.clue.answer : undefined,
          wager: gc.wager ?? undefined,
          scoreDelta: gc.scoreDelta ?? undefined,
        })),
      };
    });

    // Sort categories to ensure consistent ordering (by first clue value or alphabetically)
    categories.sort((a, b) => {
      const aValue = a.clues[0]?.value || 0;
      const bValue = b.clues[0]?.value || 0;
      if (aValue !== bValue) return aValue - bValue;
      return a.name.localeCompare(b.name);
    });

    return {
      gameId: game.id,
      currentRound: targetRound,
      gameState: game.state,
      score: game.score,
      board: {
        round: targetRound,
        categories,
      },
    };
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

    // Find GameClue by ID with clue relation
    const gameClue = await this.prismaService.client.gameClue.findUnique({
      where: { id: clueId },
      include: { clue: true },
    });

    if (!gameClue) {
      throw new Error('Clue not found');
    }

    // Verify GameClue belongs to the game
    if (gameClue.gameId !== gameId) {
      throw new Error('Clue does not belong to this game');
    }

    // Verify clue state
    // For Daily Doubles: must be ANSWERED (wager already submitted)
    // For regular clues: must be UNANSWERED
    if (gameClue.state === ClueState.RESOLVED) {
      throw new Error('Clue has already been resolved');
    }

    const isDailyDouble = gameClue.wager !== null || gameClue.isDailyDouble;
    
    if (isDailyDouble && gameClue.state !== ClueState.ANSWERED) {
      throw new Error('Daily Double wager must be submitted before answering');
    }

    if (!isDailyDouble && gameClue.state !== ClueState.UNANSWERED) {
      throw new Error('Regular clue must be in UNANSWERED state');
    }

    // Calculate score delta
    // For Daily Doubles: use wager amount (required)
    // For regular clues: use clue value
    const baseValue = isDailyDouble
      ? (gameClue.wager ?? gameClue.clue.value)
      : gameClue.clue.value;
    
    if (isDailyDouble && gameClue.wager === null) {
      throw new Error('Daily Double wager is required');
    }
    
    const scoreDelta = correct ? baseValue : -baseValue;
    const newScore = game.score + scoreDelta;

    // Update GameClue and Game in a transaction
    const [updatedGameClue] = await this.prismaService.client.$transaction([
      this.prismaService.client.gameClue.update({
        where: { id: clueId },
        data: {
          state: ClueState.RESOLVED,
          scoreDelta,
          answeredAt: new Date(),
        },
      }),
      this.prismaService.client.game.update({
        where: { id: gameId },
        data: { score: newScore },
      }),
    ]);

    // Check if all clues in both Jeopardy and Double Jeopardy rounds are resolved
    const allGameClues = await this.prismaService.client.gameClue.findMany({
      where: {
        gameId,
        clue: {
          round: { in: [Round.JEOPARDY, Round.DOUBLE_JEOPARDY] },
        },
      },
      include: { clue: true },
    });

    const allResolved = allGameClues.every((gc) => gc.state === ClueState.RESOLVED);

    if (allResolved) {
      // Check if player is eligible for Final Jeopardy (score > 0)
      if (newScore > 0) {
        await this.prismaService.client.game.update({
          where: { id: gameId },
          data: { state: GameState.FINAL_PENDING },
        });
      } else {
        // Player eliminated
        await this.prismaService.client.game.update({
          where: { id: gameId },
          data: { state: GameState.ELIMINATED },
        });
      }
    }

    return {
      gameClue: updatedGameClue,
      newScore,
    };
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

    // Find GameClue by ID with clue relation
    const gameClue = await this.prismaService.client.gameClue.findUnique({
      where: { id: clueId },
      include: { clue: true },
    });

    if (!gameClue) {
      throw new Error('Clue not found');
    }

    // Verify GameClue belongs to the game
    if (gameClue.gameId !== gameId) {
      throw new Error('Clue does not belong to this game');
    }

    // Verify clue is a Daily Double
    if (!gameClue.isDailyDouble && !gameClue.clue.dailyDouble) {
      throw new Error('This clue is not a Daily Double');
    }

    // Verify clue is UNANSWERED
    if (gameClue.state !== ClueState.UNANSWERED) {
      throw new Error(`Clue is not in UNANSWERED state. Current state: ${gameClue.state}`);
    }

    // Validate wager amount
    if (wager < 5) {
      throw new Error('Wager must be at least $5');
    }

    // Calculate max wager: greater of (current score, highest clue value in round)
    const roundHighestValue = gameClue.clue.round === Round.DOUBLE_JEOPARDY ? 2000 : 1000;
    const maxWager = Math.max(game.score, roundHighestValue);

    if (wager > maxWager) {
      throw new Error(`Wager cannot exceed $${maxWager}`);
    }

    // Update GameClue with wager and transition state to ANSWERED
    const updatedGameClue = await this.prismaService.client.gameClue.update({
      where: { id: clueId },
      data: {
        wager,
        state: ClueState.ANSWERED,
      },
    });

    return updatedGameClue;
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
