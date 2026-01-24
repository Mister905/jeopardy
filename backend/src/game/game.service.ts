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
import { ClueNotFoundException } from './exceptions/clue-not-found.exception';
import { GameStateException } from './exceptions/game-state.exception';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(
    private readonly prismaService: PrismaService,
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

    // Step 1: Select 6 unique categories for Jeopardy round (from database)
    const jeopardyCategories = await this.selectCategoriesForRound(Round.JEOPARDY, 6);
    this.logger.debug(`Selected ${jeopardyCategories.length} categories for Jeopardy`);

    // Step 2: Select 6 unique categories for Double Jeopardy round (from database)
    const doubleJeopardyCategories = await this.selectCategoriesForRound(Round.DOUBLE_JEOPARDY, 6);
    this.logger.debug(`Selected ${doubleJeopardyCategories.length} categories for Double Jeopardy`);

    // Step 3: Get all clues for selected categories with Daily Doubles
    // Jeopardy: exactly 1 Daily Double
    // Double Jeopardy: exactly 2 Daily Doubles
    // If not enough Daily Doubles are found in the database, they will be dynamically assigned
    // to clues in positions 3-5 (values 600, 800, 1000 for Jeopardy or 1200, 1600, 2000 for Double Jeopardy)
    const jeopardyClues = await this.getCluesForCategories(jeopardyCategories, Round.JEOPARDY, 1);
    const doubleJeopardyClues = await this.getCluesForCategories(doubleJeopardyCategories, Round.DOUBLE_JEOPARDY, 2);
    
    // Debug: Verify the clues returned have the correct Daily Double counts
    const jeopardyDDCount = jeopardyClues.filter(c => c.dailyDouble).length;
    const doubleJeopardyDDCount = doubleJeopardyClues.filter(c => c.dailyDouble).length;
    this.logger.log(
      `[DEBUG] Clues returned from getCluesForCategories: ` +
      `Jeopardy: ${jeopardyClues.length} clues, ${jeopardyDDCount} Daily Doubles (expected 1), ` +
      `Double Jeopardy: ${doubleJeopardyClues.length} clues, ${doubleJeopardyDDCount} Daily Doubles (expected 2)`,
    );
    
    if (jeopardyDDCount !== 1 || doubleJeopardyDDCount !== 2) {
      this.logger.error(
        `[CRITICAL] getCluesForCategories returned incorrect Daily Double counts! ` +
        `Jeopardy: ${jeopardyDDCount} (expected 1), Double Jeopardy: ${doubleJeopardyDDCount} (expected 2)`,
      );
      // Log sample clues to debug
      this.logger.error(
        `Sample Jeopardy clues dailyDouble values: ${jeopardyClues.slice(0, 5).map(c => c.dailyDouble).join(', ')}`,
      );
      this.logger.error(
        `Sample Double Jeopardy clues dailyDouble values: ${doubleJeopardyClues.slice(0, 5).map(c => c.dailyDouble).join(', ')}`,
      );
    }

    // Validate that we have clues before proceeding
    if (jeopardyClues.length === 0 || doubleJeopardyClues.length === 0) {
      const errorMsg = `Cannot start game: insufficient clues. Jeopardy: ${jeopardyClues.length}, Double Jeopardy: ${doubleJeopardyClues.length}`;
      this.logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Step 4: Create GameClue records and update game state in transaction
    const updatedGame = await prisma.$transaction(async (tx) => {
      // Debug: Count Daily Doubles before creating GameClue records
      const jeopardyDailyDoubleCount = jeopardyClues.filter(c => c.dailyDouble).length;
      const doubleJeopardyDailyDoubleCount = doubleJeopardyClues.filter(c => c.dailyDouble).length;
      this.logger.log(
        `[VALIDATION] Creating GameClue records: Jeopardy Daily Doubles: ${jeopardyDailyDoubleCount}/1 (expected 1), ` +
        `Double Jeopardy Daily Doubles: ${doubleJeopardyDailyDoubleCount}/2 (expected 2)`,
      );
      
      // Log sample clues to debug
      if (jeopardyDailyDoubleCount > 1 || doubleJeopardyDailyDoubleCount > 2) {
        this.logger.error(
          `[VALIDATION FAILED] Too many Daily Doubles detected! ` +
          `Jeopardy: ${jeopardyDailyDoubleCount} clues with dailyDouble=true, ` +
          `Double Jeopardy: ${doubleJeopardyDailyDoubleCount} clues with dailyDouble=true. ` +
          `Sample Jeopardy clues: ${jeopardyClues.slice(0, 3).map(c => `{id: ${c.id}, dailyDouble: ${c.dailyDouble}}`).join(', ')}`,
        );
      }

      // Validate Daily Double counts
      if (jeopardyDailyDoubleCount !== 1) {
        this.logger.error(
          `[VALIDATION ERROR] Invalid Daily Double count for Jeopardy round: ${jeopardyDailyDoubleCount} (expected 1)`,
        );
        throw new Error(
          `Invalid Daily Double count for Jeopardy round: ${jeopardyDailyDoubleCount} (expected 1). ` +
          `This indicates a bug in clue selection or all database clues are marked as Daily Doubles.`,
        );
      }
      if (doubleJeopardyDailyDoubleCount !== 2) {
        this.logger.error(
          `[VALIDATION ERROR] Invalid Daily Double count for Double Jeopardy round: ${doubleJeopardyDailyDoubleCount} (expected 2)`,
        );
        throw new Error(
          `Invalid Daily Double count for Double Jeopardy round: ${doubleJeopardyDailyDoubleCount} (expected 2). ` +
          `This indicates a bug in clue selection or all database clues are marked as Daily Doubles.`,
        );
      }
      
      this.logger.log(`[VALIDATION PASSED] Daily Double counts are correct`);

      // Create GameClue records for Jeopardy round
      // Create GameClue records with isDailyDouble flag to track Daily Doubles
      // This handles both database Daily Doubles and dynamically assigned ones
      const jeopardyGameClues = jeopardyClues.map((clue) => ({
        gameId,
        clueId: clue.id,
        state: ClueState.UNANSWERED,
        isDailyDouble: clue.dailyDouble,
        wager: clue.dailyDouble ? null : undefined, // Only set wager for Daily Doubles
      }));

      // Create GameClue records for Double Jeopardy round
      const doubleJeopardyGameClues = doubleJeopardyClues.map((clue) => ({
        gameId,
        clueId: clue.id,
        state: ClueState.UNANSWERED,
        isDailyDouble: clue.dailyDouble,
        wager: clue.dailyDouble ? null : undefined, // Only set wager for Daily Doubles
      }));

      const totalClues = jeopardyGameClues.length + doubleJeopardyGameClues.length;

      // Create all GameClue records
      const createResult = await tx.gameClue.createMany({
        data: [...jeopardyGameClues, ...doubleJeopardyGameClues],
      });

      // Verify that GameClues were actually created
      if (createResult.count === 0) {
        throw new Error(`Failed to create GameClue records. Expected ${totalClues} clues.`);
      }

      if (createResult.count !== totalClues) {
        this.logger.warn(
          `Created ${createResult.count} GameClue records but expected ${totalClues} for game ${gameId}`,
        );
      }

      // Verify GameClues exist before updating state
      const createdClues = await tx.gameClue.findMany({
        where: { gameId },
        take: 1,
      });

      if (createdClues.length === 0) {
        throw new Error(`GameClue records were not created for game ${gameId}`);
      }

      // Update game state to ACTIVE
      const updated = await tx.game.update({
        where: { id: gameId },
        data: { state: GameState.ACTIVE },
      });

      this.logger.log(
        `Created ${createResult.count} GameClue records for game ${gameId} and set state to ACTIVE`,
      );

      return updated;
    });

    return updatedGame;
  }

  /**
   * Select unique categories for a round
   * Only selects categories that have clues for all required values
   * @param round - Round to select categories for
   * @param count - Number of categories to select
   * @returns Array of unique category names
   * @throws Error with helpful message if not enough categories/clues available
   */
  private async selectCategoriesForRound(round: Round, count: number): Promise<string[]> {
    const prisma = this.prismaService.client;
    const requiredValues = round === Round.JEOPARDY ? [200, 400, 600, 800, 1000] : [400, 800, 1200, 1600, 2000];

    // Optimize: Use a single query to get category:value counts and check for valid categories
    // This replaces the previous 3 separate queries (count, findMany, groupBy)
    const categoryValueCounts = await prisma.clue.groupBy({
      by: ['category', 'value'],
      where: {
        round,
        value: { in: requiredValues },
      },
      _count: { id: true },
    });

    if (categoryValueCounts.length === 0) {
      throw new Error(
        `No clues found in database for ${round} round. ` +
        `Please run the Jeopardy ingestion script: npm run ingest:jeopardy`,
      );
    }

    // Group by category and check if each has all required values
    const categoryValueMap = new Map<string, Set<number>>();
    for (const item of categoryValueCounts) {
      if (!categoryValueMap.has(item.category)) {
        categoryValueMap.set(item.category, new Set());
      }
      categoryValueMap.get(item.category)!.add(item.value);
    }

    // Only include categories that have all required values
    const validCategories = Array.from(categoryValueMap.entries())
      .filter(([_, values]) => {
        return requiredValues.every((value) => values.has(value));
      })
      .map(([category]) => category);

    if (validCategories.length < count) {
      throw new Error(
        `Not enough complete categories available for ${round} round. ` +
        `Found ${validCategories.length} categories with all required values, need ${count}. ` +
        `Please run the Jeopardy ingestion script: npm run ingest:jeopardy`,
      );
    }

    // Randomly select categories
    const shuffled = validCategories.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
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
    const selectedRegularClues: Clue[] = [];
    
    for (const category of categories) {
      for (const value of values) {
        const clues = clueMap.get(`${category}:${value}`)!;
        
        // Debug: Check how many Daily Doubles are in the database for this category:value
        const dailyDoubleCount = clues.filter(c => c.dailyDouble).length;
        const nonDailyDoubleCount = clues.filter(c => !c.dailyDouble).length;
        
        if (dailyDoubleCount === clues.length) {
          this.logger.warn(
            `All clues in database are Daily Doubles for category "${category}", value ${value}, round ${round}. ` +
            `This may indicate a data issue.`,
          );
        }
        
        const nonDailyDouble = clues.find((c) => !c.dailyDouble);
        
        if (nonDailyDouble) {
          allClues.push(nonDailyDouble);
          selectedRegularClues.push(nonDailyDouble);
        } else {
          // Only Daily Doubles available, use one
          const dailyDouble = clues.find((c) => c.dailyDouble)!;
          allClues.push(dailyDouble);
          selectedDailyDoubles.push(dailyDouble);
          this.logger.warn(
            `No non-Daily Double clue available for category "${category}", value ${value}, round ${round}. ` +
            `Using Daily Double clue ${dailyDouble.id}`,
          );
        }
      }
    }
    
    // If we had to use too many Daily Doubles because some category:value pairs only have Daily Doubles,
    // try to replace some of the Daily Doubles we selected with regular clues from other category:value pairs
    let currentDailyDoubleCount = allClues.filter((c) => c.dailyDouble).length;
    if (currentDailyDoubleCount > requiredDailyDoubles) {
      const excess = currentDailyDoubleCount - requiredDailyDoubles;
      this.logger.warn(
        `Too many Daily Doubles selected (${currentDailyDoubleCount}) due to limited availability. ` +
        `Attempting to replace ${excess} Daily Double(s) with regular clues by swapping within categories.`,
      );
      
      // Strategy: For each excess Daily Double, try to replace it with a regular clue from the SAME category:value pair
      // If that's not possible (because the pair only has DDs), we need to use dynamic assignment to "un-mark" it
      // by finding a regular clue from another category:value and swapping positions
      let replaced = 0;
      const dailyDoublesToReplace = selectedDailyDoubles.slice(0, excess);
      
      for (const dailyDoubleToReplace of dailyDoublesToReplace) {
        if (replaced >= excess) break;
        
        const category = dailyDoubleToReplace.category;
        const originalValue = dailyDoubleToReplace.value;
        const originalKey = `${category}:${originalValue}`;
        
        // First, try to find a regular clue from the SAME category:value pair
        const alternatives = clueMap.get(originalKey);
        if (alternatives) {
          const regularAlternative = alternatives.find(
            (c) => !c.dailyDouble && c.id !== dailyDoubleToReplace.id,
          );
          
          if (regularAlternative) {
            // Perfect! Replace the Daily Double with a regular clue from the same category:value
            const dailyDoubleIndex = allClues.findIndex((c) => c.id === dailyDoubleToReplace.id);
            if (dailyDoubleIndex > -1) {
              allClues[dailyDoubleIndex] = regularAlternative;
              replaced++;
              this.logger.debug(
                `Replaced Daily Double ${dailyDoubleToReplace.id} (${category}, ${originalValue}) ` +
                `with regular clue ${regularAlternative.id} from same category:value pair`,
              );
              continue; // Successfully replaced, move to next
            }
          }
        }
        
        // If no regular clue available in the same category:value, we'll use dynamic "un-assignment"
        // in the "too many Daily Doubles" section below to convert it back to a regular clue
      }
      
      // Recalculate count after replacements
      currentDailyDoubleCount = allClues.filter((c) => c.dailyDouble).length;
      this.logger.debug(
        `After initial replacement attempt: ${currentDailyDoubleCount} Daily Doubles (replaced ${replaced} of ${excess} excess)`,
      );
      
      if (replaced < excess) {
        const stillNeeded = excess - replaced;
        this.logger.warn(
          `Could only replace ${replaced} of ${excess} excess Daily Doubles through same-category:value replacement. ` +
          `Still need to reduce ${stillNeeded} more. Will use dynamic un-assignment.`,
        );
      }
    }

    // Count Daily Doubles we have (after any replacements)
    // currentDailyDoubleCount is already set above, either from initial count or after replacement

    if (currentDailyDoubleCount === requiredDailyDoubles) {
      // Perfect!
      return allClues;
    } else if (currentDailyDoubleCount < requiredDailyDoubles) {
      // Need more Daily Doubles - replace some regular clues with Daily Doubles
      const needed = requiredDailyDoubles - currentDailyDoubleCount;
      
      // First, collect all available Daily Doubles from the clueMap
      // and count how many are available per category:value combination
      const availableDailyDoublesByKey = new Map<string, Clue[]>();
      let totalAvailableDailyDoubles = 0;
      
      for (const [key, clues] of clueMap.entries()) {
        const dailyDoubles = clues.filter((c) => c.dailyDouble);
        if (dailyDoubles.length > 0) {
          availableDailyDoublesByKey.set(key, dailyDoubles);
          totalAvailableDailyDoubles += dailyDoubles.length;
        }
      }

      // Try to replace regular clues with Daily Doubles from the database
      // We can only replace within the same category:value pair to maintain board structure
      let replaced = 0;
      
      if (totalAvailableDailyDoubles > 0) {
        const regularClues = allClues.filter((c) => !c.dailyDouble);
        const shuffled = regularClues.sort(() => Math.random() - 0.5);

        for (const clueToReplace of shuffled) {
          if (replaced >= needed) break;
          
          const key = `${clueToReplace.category}:${clueToReplace.value}`;
          const availableDailyDoubles = availableDailyDoublesByKey.get(key);
          
          if (availableDailyDoubles && availableDailyDoubles.length > 0) {
            // Find a Daily Double that's not already in allClues
            const dailyDoubleAlternative = availableDailyDoubles.find(
              (c) => c.id !== clueToReplace.id && !allClues.some((ac) => ac.id === c.id),
            );

            if (dailyDoubleAlternative) {
              const index = allClues.indexOf(clueToReplace);
              allClues[index] = dailyDoubleAlternative;
              replaced++;
              
              // Remove the used Daily Double from available list
              const indexInAvailable = availableDailyDoubles.indexOf(dailyDoubleAlternative);
              availableDailyDoubles.splice(indexInAvailable, 1);
              if (availableDailyDoubles.length === 0) {
                availableDailyDoublesByKey.delete(key);
              }
            }
          }
        }
      } else {
        // No Daily Doubles available in database for selected categories
        // We'll use dynamic assignment to create Daily Doubles from regular clues
        this.logger.warn(
          `No Daily Doubles available in database for selected ${round} categories. ` +
          `Will use dynamic assignment to create ${needed} Daily Double(s) from regular clues.`,
        );
      }
      
      // If we don't have enough Daily Doubles from the database, use dynamic assignment
      // This handles cases where selected categories have no Daily Doubles in the database
      const finalCount = allClues.filter((c) => c.dailyDouble).length;
      if (finalCount < requiredDailyDoubles) {
        const stillNeeded = requiredDailyDoubles - finalCount;
        
        // Get eligible clues for dynamic Daily Double assignment
        // Only assign to clues in positions 3-5 (values 600, 800, 1000 for Jeopardy or 1200, 1600, 2000 for Double Jeopardy)
        const eligibleValues = round === Round.JEOPARDY ? [600, 800, 1000] : [1200, 1600, 2000];
        const eligibleClues = allClues.filter(
          (c) => !c.dailyDouble && eligibleValues.includes(c.value),
        );
        
        if (eligibleClues.length < stillNeeded) {
          // Log which category:value pairs have Daily Doubles available for debugging
          const availableKeys = Array.from(availableDailyDoublesByKey.keys());
          this.logger.warn(
            `Failed to assign required Daily Doubles for ${round} round. ` +
            `Required: ${requiredDailyDoubles}, Achieved: ${finalCount}, Still need: ${stillNeeded}. ` +
            `Eligible clues for dynamic assignment: ${eligibleClues.length}. ` +
            `Category:value pairs with available Daily Doubles: ${availableKeys.join(', ')}`,
          );
          
          throw new Error(
            `Failed to assign required Daily Doubles for ${round} round. ` +
            `Required: ${requiredDailyDoubles}, Achieved: ${finalCount}. ` +
            `Not enough eligible clues (values ${eligibleValues.join(', ')}) available for dynamic Daily Double assignment.`,
          );
        }
        
        // Randomly select clues from eligible positions and mark them as Daily Doubles
        const shuffledEligible = eligibleClues.sort(() => Math.random() - 0.5);
        const cluesToMarkAsDailyDouble = shuffledEligible.slice(0, stillNeeded);
        
        for (const clue of cluesToMarkAsDailyDouble) {
          // Mark this clue as a Daily Double (modify in memory)
          // Create a new object to avoid mutating the original if it's shared
          const clueIndex = allClues.indexOf(clue);
          if (clueIndex > -1) {
            allClues[clueIndex] = { ...clue, dailyDouble: true };
            this.logger.debug(
              `Dynamically assigned Daily Double status to clue ${clue.id} ` +
              `(category: ${clue.category}, value: ${clue.value})`,
            );
          }
        }
        
        // Verify the count after assignment
        const verifyCount = allClues.filter((c) => c.dailyDouble).length;
        if (verifyCount !== requiredDailyDoubles) {
          this.logger.error(
            `Daily Double assignment verification failed for ${round} round. ` +
            `Required: ${requiredDailyDoubles}, After assignment: ${verifyCount}`,
          );
          throw new Error(
            `Failed to correctly assign Daily Doubles for ${round} round. ` +
            `Required: ${requiredDailyDoubles}, Achieved: ${verifyCount}`,
          );
        }
        
        this.logger.log(
          `Dynamically assigned ${cluesToMarkAsDailyDouble.length} Daily Double(s) ` +
          `for ${round} round to reach required count of ${requiredDailyDoubles}`,
        );
      }
    } else {
      // Too many Daily Doubles - replace some with regular clues
      const excess = currentDailyDoubleCount - requiredDailyDoubles;
      this.logger.warn(
        `Too many Daily Doubles (${currentDailyDoubleCount}, required ${requiredDailyDoubles}). ` +
        `Attempting to replace ${excess} Daily Double(s) with regular clues.`,
      );
      
      const dailyDoubleClues = allClues.filter((c) => c.dailyDouble);
      const shuffled = dailyDoubleClues.sort(() => Math.random() - 0.5);
      let replaced = 0;

      for (let i = 0; i < excess && i < shuffled.length; i++) {
        const clueToReplace = shuffled[i];
        const key = `${clueToReplace.category}:${clueToReplace.value}`;
        const alternatives = clueMap.get(key)!;
        const regularAlternative = alternatives.find((c) => !c.dailyDouble && c.id !== clueToReplace.id);

        if (regularAlternative) {
          // Replace with a regular version from the same category:value pair
          const index = allClues.indexOf(clueToReplace);
          allClues[index] = regularAlternative;
          replaced++;
          this.logger.debug(
            `Replaced Daily Double ${clueToReplace.id} (${clueToReplace.category}, ${clueToReplace.value}) ` +
            `with regular clue ${regularAlternative.id}`,
          );
        } else {
          // No regular clue available in this category:value pair
          // Use dynamic "un-assignment" - convert this Daily Double back to regular by removing the dailyDouble flag
          // This is safe because we know we have too many Daily Doubles
          const index = allClues.indexOf(clueToReplace);
          if (index > -1) {
            // Create a new clue object without the dailyDouble flag
            allClues[index] = { ...clueToReplace, dailyDouble: false };
            replaced++;
            this.logger.debug(
              `Dynamically un-assigned Daily Double status from clue ${clueToReplace.id} ` +
              `(${clueToReplace.category}, ${clueToReplace.value}) to reduce excess count`,
            );
          }
        }
      }
      
      // Verify the count after replacement
      const countAfterReplacement = allClues.filter((c) => c.dailyDouble).length;
      this.logger.debug(
        `After replacement: ${countAfterReplacement} Daily Doubles (replaced ${replaced} of ${excess} excess)`,
      );
      
      if (countAfterReplacement !== requiredDailyDoubles) {
        this.logger.error(
          `Failed to correct Daily Double count through replacement. ` +
          `Current: ${countAfterReplacement}, Required: ${requiredDailyDoubles}, ` +
          `Replaced: ${replaced} of ${excess} excess.`,
        );
        // This will be caught by the final validation
      }
    }

    // Final validation: ensure we have exactly the required number (runs for both too few and too many cases)
    const finalDailyDoubleCount = allClues.filter((c) => c.dailyDouble).length;
    if (finalDailyDoubleCount !== requiredDailyDoubles) {
      this.logger.error(
        `Daily Double count mismatch for ${round} round. ` +
        `Required: ${requiredDailyDoubles}, Found: ${finalDailyDoubleCount}`,
      );
      throw new Error(
        `Daily Double count mismatch for ${round} round. ` +
        `Required: ${requiredDailyDoubles}, Found: ${finalDailyDoubleCount}`,
      );
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

      // If game is ACTIVE but no clues found, this indicates the game wasn't properly started
      if (gameClues.length === 0 && game.state === GameState.ACTIVE) {
        this.logger.warn(`Game ${gameId} is ACTIVE but has no gameClues for round ${targetRound}. Game may not have been properly started. Attempting to recover...`);
        
        // Check if there are ANY gameClues for this game
        const allGameClues = await prisma.gameClue.findMany({
          where: { gameId },
          take: 1,
        });

        // If no gameClues exist at all, reset game to PENDING state
        if (allGameClues.length === 0) {
          this.logger.warn(`Game ${gameId} is ACTIVE but has no gameClues. Resetting state to PENDING.`);
          await prisma.game.update({
            where: { id: gameId },
            data: { state: GameState.PENDING },
          });
          
          return {
            gameId,
            currentRound: null,
            gameState: GameState.PENDING,
            score: game.score,
            board: null,
          };
        }

        // Return null board to indicate the board isn't available yet
        return {
          gameId,
          currentRound: null,
          gameState: game.state,
          score: game.score,
          board: null,
        };
      }

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

          // Determine Daily Double status:
          // 1. For UNANSWERED clues, always return false (hide Daily Doubles)
          // 2. For ANSWERED/RESOLVED clues, use isDailyDouble field (which matches clue.dailyDouble
          //    at creation time, or is set to true for dynamically assigned Daily Doubles)
          const isDailyDouble = gc.isDailyDouble;
          
          return {
            gameClueId: gc.id,
            clueId: clue.id,
            value: clue.value,
            state: gc.state as 'UNANSWERED' | 'ANSWERED' | 'RESOLVED',
            // Only reveal Daily Double status for ANSWERED or RESOLVED clues
            // This prevents telegraphing which clues are Daily Doubles before selection
            dailyDouble: gc.state === ClueState.UNANSWERED ? false : isDailyDouble,
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
      throw new GameStateException(game.state, GameState.ACTIVE);
    }

    const prisma = this.prismaService.client;

    // Find GameClue by ID with related clue and game
    const gameClue = await prisma.gameClue.findUnique({
      where: { id: clueId },
      include: {
        clue: true,
        game: true,
      },
    });

    if (!gameClue) {
      throw new ClueNotFoundException(clueId);
    }

    // Validate GameClue belongs to the game
    if (gameClue.gameId !== gameId) {
      throw new ClueNotFoundException(clueId);
    }

    // Validate GameClue is not already resolved
    if (gameClue.state === ClueState.RESOLVED) {
      throw new Error(`Clue ${clueId} has already been resolved`);
    }

    // Validate GameClue is UNANSWERED or ANSWERED (ANSWERED for Daily Doubles that have wager submitted)
    if (gameClue.state !== ClueState.UNANSWERED && gameClue.state !== ClueState.ANSWERED) {
      throw new Error(`Clue ${clueId} is in invalid state: ${gameClue.state}. Expected UNANSWERED or ANSWERED`);
    }

    // Validate that Daily Doubles have a wager set before answering
    if (gameClue.wager !== null && gameClue.wager <= 0) {
      throw new Error(`Daily Double clue ${clueId} must have a valid wager amount before answering`);
    }

    // Calculate score delta
    // For Daily Doubles: always use wager amount (wager should be set before answering)
    // For regular clues: use clue value
    // Check if it's a Daily Double by checking if wager is not null (Daily Doubles have wager set after wager submission)
    const isDailyDouble = gameClue.wager !== null;
    const baseValue = isDailyDouble 
      ? gameClue.wager! // Use wager amount for Daily Doubles (wager is guaranteed to be set)
      : gameClue.clue.value; // Use clue value for regular clues
    
    this.logger.log(
      `[answerClue] Calculating score delta: isDailyDouble=${isDailyDouble}, ` +
      `wager=${gameClue.wager}, clueValue=${gameClue.clue.value}, baseValue=${baseValue}, correct=${correct}`,
    );
    
    const scoreDelta = correct ? baseValue : -baseValue;
    const newScore = game.score + scoreDelta; // Scores may be negative

    // Get the round of the clue for round completion check
    const clueRound = gameClue.clue.round;

    // Update GameClue and Game score in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update GameClue
      const updatedGameClue = await tx.gameClue.update({
        where: { id: clueId },
        data: {
          state: ClueState.RESOLVED,
          scoreDelta,
          answeredAt: new Date(),
        },
      });

      // Update game score
      await tx.game.update({
        where: { id: gameId },
        data: { score: newScore },
      });

      // Check if all clues in both Jeopardy and Double Jeopardy rounds are resolved
      // Only transition to FINAL_PENDING when BOTH rounds are complete
      if (clueRound !== Round.FINAL) {
        // Get all GameClues for Jeopardy round
        const jeopardyClues = await tx.gameClue.findMany({
          where: {
            gameId,
            clue: {
              round: Round.JEOPARDY,
            },
          },
        });

        // Get all GameClues for Double Jeopardy round
        const doubleJeopardyClues = await tx.gameClue.findMany({
          where: {
            gameId,
            clue: {
              round: Round.DOUBLE_JEOPARDY,
            },
          },
        });

        // Check if all clues in both rounds are resolved
        const jeopardyComplete = jeopardyClues.length > 0 && 
          jeopardyClues.every((gc) => gc.state === ClueState.RESOLVED);
        const doubleJeopardyComplete = doubleJeopardyClues.length > 0 && 
          doubleJeopardyClues.every((gc) => gc.state === ClueState.RESOLVED);

        // Only transition if both rounds are complete
        if (jeopardyComplete && doubleJeopardyComplete) {
          await tx.game.update({
            where: { id: gameId },
            data: { state: GameState.FINAL_PENDING },
          });
          this.logger.log(
            `All clues in both Jeopardy and Double Jeopardy rounds resolved. Game ${gameId} transitioned to FINAL_PENDING`,
          );
        }
      }

      return updatedGameClue;
    });

    this.logger.log(
      `Clue ${clueId} answered: ${correct ? 'correct' : 'incorrect'}. Score delta: ${scoreDelta}, New score: ${newScore}`,
    );

    return {
      gameClue: result,
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

    const prisma = this.prismaService.client;

    // Find GameClue by ID with related clue and game
    const gameClue = await prisma.gameClue.findUnique({
      where: { id: clueId },
      include: {
        clue: true,
        game: true,
      },
    });

    if (!gameClue) {
      throw new Error(`Clue not found: ${clueId}`);
    }

    // Validate GameClue belongs to the game
    if (gameClue.gameId !== gameId) {
      throw new Error(`Clue ${clueId} does not belong to game ${gameId}`);
    }

    // Verify clue is a Daily Double (check isDailyDouble field)
    if (!gameClue.isDailyDouble) {
      throw new Error(`Clue ${clueId} is not a Daily Double`);
    }

    // Verify clue is UNANSWERED
    if (gameClue.state !== ClueState.UNANSWERED) {
      throw new Error(`Clue ${clueId} is not in UNANSWERED state. Current state: ${gameClue.state}`);
    }

    // Validate wager amount
    if (wager < 5) {
      throw new Error('Wager must be at least $5');
    }

    // Calculate max wager: greater of (current score, round highest value)
    const roundHighestValue = gameClue.clue.round === Round.DOUBLE_JEOPARDY ? 2000 : 1000;
    const maxWager = Math.max(game.score, roundHighestValue);

    if (wager > maxWager) {
      throw new Error(`Wager cannot exceed maximum of $${maxWager}`);
    }

    // Update GameClue with wager and transition state to ANSWERED
    const updatedGameClue = await prisma.gameClue.update({
      where: { id: clueId },
      data: {
        wager,
        state: ClueState.ANSWERED,
      },
    });

    this.logger.log(
      `Wager submitted for Daily Double clue ${clueId}: $${wager} (max: $${maxWager}, score: $${game.score})`,
    );

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

  /**
   * End/abandon a game that is in progress
   * Transitions the game to COMPLETED state
   * @param gameId - Game ID
   * @param userId - User ID for authorization
   * @returns Updated game
   */
  async endGame(gameId: string, userId: string): Promise<Game> {
    const game = await this.getGameById(gameId, userId);
    if (!game) {
      throw new Error('Game not found or access denied');
    }

    // Only allow ending games that are in progress
    const endableStates: GameState[] = [
      GameState.PENDING,
      GameState.ACTIVE,
      GameState.FINAL_PENDING,
      GameState.FINAL_ACTIVE,
    ];

    if (!endableStates.includes(game.state)) {
      throw new Error(
        `Cannot end game in ${game.state} state. Game must be in progress.`,
      );
    }

    const updatedGame = await this.prismaService.client.game.update({
      where: { id: gameId },
      data: { state: GameState.COMPLETED },
    });

    this.logger.log(
      `Game ${gameId} ended by user ${userId}. Previous state: ${game.state}`,
    );

    return updatedGame;
  }
}
