import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CluebaseService } from '../data/cluebase/cluebase.service';
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

  constructor(
    private readonly prismaService: PrismaService,
    private readonly cluebaseService: CluebaseService,
  ) {}

  /**
   * Create a new game with a Final Jeopardy clue
   * @param userId - The authenticated user creating the game (Supabase user ID)
   * @param userEmail - Optional user email for user creation
   * @returns Created game with associated Final Jeopardy clue
   * @throws Error if userId is invalid, no clues available, or database operation fails
   */
  async createGame(userId: string, userEmail?: string): Promise<CreateGameResult> {
    this.logger.log(`Creating game for user: ${userId}`);

    // Step 1: Validate User
    this.validateUserId(userId);

    // Step 2: Ensure user exists in database (create if not exists)
    await this.ensureUserExists(userId, userEmail);

    // Step 3: Select Final Jeopardy Clue
    const selectedClue = await this.selectFinalJeopardyClue();

    // Step 4 & 5: Create Game and FinalJeopardy Association in transaction
    const result = await this.prismaService.client.$transaction(
      async (prisma) => {
        // Step 4: Create Game Record
        const game = await prisma.game.create({
          data: {
            userId,
            state: GameState.PENDING,
            score: 0,
          },
        });

        this.logger.log(`Created game: ${game.id}`);

        // Step 5: Create FinalJeopardy Association
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

        // Step 6: Fetch complete game with relations
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
   * Ensure user exists in database, create if not exists
   * @param userId - Supabase user ID
   * @param userEmail - Optional user email
   * @throws Error if user creation fails
   */
  private async ensureUserExists(userId: string, userEmail?: string): Promise<void> {
    const prisma = this.prismaService.client;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (existingUser) {
      this.logger.debug(`User already exists: ${userId}`);
      return;
    }

    // Create user if not exists
    if (!userEmail) {
      // If no email provided, use a placeholder (user can update later)
      this.logger.warn(`Creating user without email: ${userId}`);
    }

    try {
      await prisma.user.create({
        data: {
          id: userId, // Use Supabase user ID as the primary key
          email: userEmail || `user-${userId}@placeholder.local`,
        },
      });
      this.logger.log(`Created user record: ${userId}`);
    } catch (error) {
      // If user was created by another request between check and create, that's okay
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Unique constraint') || errorMessage.includes('P2002')) {
        this.logger.debug(`User was created by another request: ${userId}`);
        return;
      }
      this.logger.error(`Failed to create user: ${errorMessage}`);
      throw new Error(`Failed to ensure user exists: ${errorMessage}`);
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

    const prisma = this.prismaService.client;

    // Step 1: Fetch and persist clues from Cluebase API for Jeopardy round
    // Need at least 6 categories × 5 clues = 30 clues, but fetch more to ensure we have enough
    const jeopardyCluesRequired = 6 * 5; // Minimum for one complete board
    this.logger.log(`Fetching clues from Cluebase API for Jeopardy round`);
    await this.cluebaseService.fetchAndPersistClues(
      Round.JEOPARDY,
      jeopardyCluesRequired * 2, // Fetch extra to have variety
    );

    // Step 2: Fetch and persist clues from Cluebase API for Double Jeopardy round
    const doubleJeopardyCluesRequired = 6 * 5; // Minimum for one complete board
    this.logger.log(`Fetching clues from Cluebase API for Double Jeopardy round`);
    await this.cluebaseService.fetchAndPersistClues(
      Round.DOUBLE_JEOPARDY,
      doubleJeopardyCluesRequired * 2, // Fetch extra to have variety
    );

    // Step 3: Select 6 unique categories for Jeopardy round (from persisted clues)
    const jeopardyCategories = await this.selectCategoriesForRound(Round.JEOPARDY, 6);
    this.logger.debug(`Selected ${jeopardyCategories.length} categories for Jeopardy`);

    // Step 4: Select 6 unique categories for Double Jeopardy round (from persisted clues)
    const doubleJeopardyCategories = await this.selectCategoriesForRound(Round.DOUBLE_JEOPARDY, 6);
    this.logger.debug(`Selected ${doubleJeopardyCategories.length} categories for Double Jeopardy`);

    // Step 5: Get all clues for selected categories with Daily Doubles
    // Jeopardy: exactly 1 Daily Double
    // Double Jeopardy: exactly 2 Daily Doubles
    const jeopardyClues = await this.getCluesForCategories(jeopardyCategories, Round.JEOPARDY, 1);
    const doubleJeopardyClues = await this.getCluesForCategories(doubleJeopardyCategories, Round.DOUBLE_JEOPARDY, 2);

    // Step 6: Create GameClue records and update game state in transaction
    const updatedGame = await prisma.$transaction(async (tx) => {
      // Create GameClue records for Jeopardy round
      const jeopardyGameClues = jeopardyClues.map((clue) => ({
        gameId,
        clueId: clue.id,
        state: ClueState.UNANSWERED,
        wager: clue.dailyDouble ? null : undefined, // Daily Doubles will have wager set later
      }));

      // Create GameClue records for Double Jeopardy round
      const doubleJeopardyGameClues = doubleJeopardyClues.map((clue) => ({
        gameId,
        clueId: clue.id,
        state: ClueState.UNANSWERED,
        wager: clue.dailyDouble ? null : undefined,
      }));

      // Create all GameClue records
      await tx.gameClue.createMany({
        data: [...jeopardyGameClues, ...doubleJeopardyGameClues],
      });

      // Update game state to ACTIVE
      const updated = await tx.game.update({
        where: { id: gameId },
        data: { state: GameState.ACTIVE },
      });

      this.logger.log(
        `Created ${jeopardyGameClues.length + doubleJeopardyGameClues.length} GameClue records for game ${gameId}`,
      );

      return updated;
    });

    return updatedGame;
  }

  /**
   * Select unique categories for a round
   * @param round - Round to select categories for
   * @param count - Number of categories to select
   * @returns Array of unique category names
   * @throws Error with helpful message if not enough categories/clues available
   */
  private async selectCategoriesForRound(round: Round, count: number): Promise<string[]> {
    const prisma = this.prismaService.client;

    // First check if any clues exist for this round
    const totalClues = await prisma.clue.count({
      where: { round },
    });

    if (totalClues === 0) {
      throw new Error(
        `No clues found in database for ${round} round. ` +
        `Cluebase API may be unavailable or returned no valid clues. ` +
        `Please check your CLUEBASE_API_URL configuration and ensure the API is accessible.`,
      );
    }

    // Get distinct categories for the round
    const categories = await prisma.clue.findMany({
      where: { round },
      select: { category: true },
      distinct: ['category'],
    });

    if (categories.length < count) {
      // Check how many clues we have per category to provide better error
      const cluesPerCategory = await prisma.clue.groupBy({
        by: ['category'],
        where: { round },
        _count: { id: true },
      });

      throw new Error(
        `Not enough categories available for ${round} round. Found ${categories.length} categories, need ${count}. ` +
        `Total clues in database: ${totalClues}. ` +
        `The Cluebase API may not have returned enough clues with distinct categories. ` +
        `Please try starting the game again, or check if the API is returning sufficient clue data.`,
      );
    }

    // Randomly select categories
    const shuffled = categories.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((c) => c.category);
  }

  /**
   * Get clues for selected categories, ensuring we have all 5 values
   * Also ensures we have the required number of Daily Doubles
   * @param categories - Category names
   * @param round - Round (JEOPARDY or DOUBLE_JEOPARDY)
   * @param requiredDailyDoubles - Number of Daily Doubles required
   * @returns Array of clues with Daily Doubles properly selected
   */
  private async getCluesForCategories(
    categories: string[],
    round: Round,
    requiredDailyDoubles: number,
  ): Promise<Clue[]> {
    const prisma = this.prismaService.client;
    const values = round === Round.JEOPARDY ? [200, 400, 600, 800, 1000] : [400, 800, 1200, 1600, 2000];

    const allClues: Clue[] = [];
    const clueMap = new Map<string, Clue[]>(); // category:value -> clues

    // Collect all potential clues for each category:value combination
    for (const category of categories) {
      for (const value of values) {
        const clues = await prisma.clue.findMany({
          where: {
            round,
            category,
            value,
          },
        });

        if (clues.length === 0) {
          throw new Error(`No clue found for category "${category}", value ${value}, round ${round}`);
        }

        clueMap.set(`${category}:${value}`, clues);
      }
    }

    // First pass: select clues, preferring non-Daily Doubles
    const selectedDailyDoubles: Clue[] = [];
    
    for (const category of categories) {
      for (const value of values) {
        const clues = clueMap.get(`${category}:${value}`)!;
        const nonDailyDouble = clues.find((c) => !c.dailyDouble);
        
        if (nonDailyDouble) {
          allClues.push(nonDailyDouble);
        } else {
          // Only Daily Doubles available, use one
          const dailyDouble = clues.find((c) => c.dailyDouble)!;
          allClues.push(dailyDouble);
          selectedDailyDoubles.push(dailyDouble);
        }
      }
    }

    // Count Daily Doubles we have
    const currentDailyDoubleCount = allClues.filter((c) => c.dailyDouble).length;

    if (currentDailyDoubleCount === requiredDailyDoubles) {
      // Perfect!
      return allClues;
    } else if (currentDailyDoubleCount < requiredDailyDoubles) {
      // Need more Daily Doubles - replace some regular clues with Daily Doubles
      const needed = requiredDailyDoubles - currentDailyDoubleCount;
      const regularClues = allClues.filter((c) => !c.dailyDouble);
      const shuffled = regularClues.sort(() => Math.random() - 0.5);

      for (let i = 0; i < needed && i < shuffled.length; i++) {
        const clueToReplace = shuffled[i];
        const key = `${clueToReplace.category}:${clueToReplace.value}`;
        const alternatives = clueMap.get(key)!;
        const dailyDoubleAlternative = alternatives.find((c) => c.dailyDouble && c.id !== clueToReplace.id);

        if (dailyDoubleAlternative) {
          // Replace with a Daily Double version
          const index = allClues.indexOf(clueToReplace);
          allClues[index] = dailyDoubleAlternative;
        }
      }
    } else {
      // Too many Daily Doubles - replace some with regular clues
      const excess = currentDailyDoubleCount - requiredDailyDoubles;
      const dailyDoubleClues = allClues.filter((c) => c.dailyDouble);
      const shuffled = dailyDoubleClues.sort(() => Math.random() - 0.5);

      for (let i = 0; i < excess && i < shuffled.length; i++) {
        const clueToReplace = shuffled[i];
        const key = `${clueToReplace.category}:${clueToReplace.value}`;
        const alternatives = clueMap.get(key)!;
        const regularAlternative = alternatives.find((c) => !c.dailyDouble && c.id !== clueToReplace.id);

        if (regularAlternative) {
          // Replace with a regular version
          const index = allClues.indexOf(clueToReplace);
          allClues[index] = regularAlternative;
        }
      }
    }

    return allClues;
  }

  /**
   * Get the current round's board state
   * @param gameId - Game ID
   * @param userId - User ID for authorization
   * @param round - Optional specific round to retrieve
   * @returns Board state
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
    board: {
      round: 'JEOPARDY' | 'DOUBLE_JEOPARDY' | 'FINAL';
      categories?: Array<{
        name: string;
        clues: Array<{
          gameClueId: string;
          clueId: string;
          value: number;
          state: 'UNANSWERED' | 'ANSWERED' | 'RESOLVED';
          dailyDouble: boolean;
          question?: string;
          answer?: string;
          wager?: number;
          scoreDelta?: number;
        }>;
      }>;
      clue?: {
        clueId: string;
        category: string;
        value: number;
        question: string;
        answer?: string;
        wager: number;
        correct: boolean | null;
        scoreDelta: number | null;
        answeredAt: string | null;
      };
    } | null;
  }> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    const prisma = this.prismaService.client;

    // Determine which round to show
    let targetRound: Round | null = round || null;

    if (!targetRound) {
      // Determine current round based on game state
      if (game.state === GameState.PENDING || game.state === GameState.ACTIVE) {
        // Check if we have any answered clues to determine which round we're in
        const gameClues = await prisma.gameClue.findMany({
          where: { gameId },
          include: { clue: true },
        });

        const jeopardyClues = gameClues.filter((gc) => gc.clue.round === Round.JEOPARDY);
        const doubleJeopardyClues = gameClues.filter((gc) => gc.clue.round === Round.DOUBLE_JEOPARDY);

        // If all Jeopardy clues are resolved, we're in Double Jeopardy
        const allJeopardyResolved = jeopardyClues.length > 0 && jeopardyClues.every((gc) => gc.state === ClueState.RESOLVED);
        targetRound = allJeopardyResolved ? Round.DOUBLE_JEOPARDY : Round.JEOPARDY;
      } else if (game.state === GameState.FINAL_PENDING || game.state === GameState.FINAL_ACTIVE) {
        targetRound = Round.FINAL;
      }
    }

    // Build board based on round
    if (targetRound === Round.FINAL) {
      // Return Final Jeopardy board
      const finalJeopardy = await prisma.finalJeopardy.findUnique({
        where: { gameId },
        include: { clue: true },
      });

      if (!finalJeopardy) {
        throw new Error('Final Jeopardy not found for this game');
      }

      return {
        gameId,
        currentRound: Round.FINAL,
        gameState: game.state,
        score: game.score,
        board: {
          round: 'FINAL',
          clue: {
            clueId: finalJeopardy.clue.id,
            category: finalJeopardy.clue.category,
            value: finalJeopardy.clue.value,
            question: finalJeopardy.clue.question,
            answer: finalJeopardy.answeredAt ? finalJeopardy.clue.answer : undefined,
            wager: finalJeopardy.wager,
            correct: finalJeopardy.correct,
            scoreDelta: finalJeopardy.scoreDelta,
            answeredAt: finalJeopardy.answeredAt?.toISOString() || null,
          },
        },
      };
    } else if (targetRound === Round.JEOPARDY || targetRound === Round.DOUBLE_JEOPARDY) {
      // Get all GameClues for the specified round
      const gameClues = await prisma.gameClue.findMany({
        where: {
          gameId,
          clue: {
            round: targetRound,
          },
        },
        include: {
          clue: true,
        },
        orderBy: [
          { clue: { category: 'asc' } },
          { clue: { value: 'asc' } },
        ],
      });

      // Group clues by category
      const categoryMap = new Map<string, typeof gameClues>();

      for (const gameClue of gameClues) {
        const category = gameClue.clue.category;
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(gameClue);
      }

      // Build categories array
      const categories = Array.from(categoryMap.entries()).map(([name, clues]) => ({
        name,
        clues: clues.map((gc) => {
          const clue = gc.clue;
          const isAnswered = gc.state === ClueState.ANSWERED || gc.state === ClueState.RESOLVED;

          return {
            gameClueId: gc.id,
            clueId: clue.id,
            value: clue.value,
            state: gc.state as 'UNANSWERED' | 'ANSWERED' | 'RESOLVED',
            dailyDouble: clue.dailyDouble,
            question: isAnswered ? clue.question : undefined,
            answer: gc.state === ClueState.RESOLVED ? clue.answer : undefined,
            wager: gc.wager || undefined,
            scoreDelta: gc.scoreDelta || undefined,
          };
        }),
      }));

      return {
        gameId,
        currentRound: targetRound,
        gameState: game.state,
        score: game.score,
        board: {
          round: targetRound as 'JEOPARDY' | 'DOUBLE_JEOPARDY',
          categories,
        },
      };
    }

    // No board available (game not started)
    return {
      gameId,
      currentRound: null,
      gameState: game.state,
      score: game.score,
      board: null,
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
