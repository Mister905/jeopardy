import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
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
    private readonly userService: UserService,
  ) {}

  /**
   * Create a new game with a Final Jeopardy clue
   * @param userId - The authenticated user creating the game
   * @param email - The user's email address (optional, will be fetched from existing user if missing)
   * @param username - Optional username (required for new users)
   * @returns Created game with associated Final Jeopardy clue
   * @throws Error if userId is invalid, no clues available, or database operation fails
   */
  async createGame(
    userId: string,
    email?: string,
    username?: string,
  ): Promise<CreateGameResult> {
    this.logger.log(`Creating game for user: ${userId}`);

    // Step 1: Validate User
    this.validateUserId(userId);

    // Step 1.5: Ensure User exists (create if needed)
    // If email is not provided, try to get it from existing user record
    let userEmail = email;
    if (!userEmail || userEmail.trim().length === 0) {
      const existingUser = await this.prismaService.client.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (existingUser) {
        userEmail = existingUser.email;
        this.logger.debug(`Retrieved email from existing user record: ${userEmail}`);
      } else {
        // Email is required for new users
        throw new Error(
          'Email is required for user creation. Please ensure your authentication token includes an email claim.',
        );
      }
    }

    await this.userService.ensureUserExists(userId, userEmail, username);

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
   * Retries category selection until all required clues are found
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

    // Jeopardy round values: 200, 400, 600, 800, 1000
    const jeopardyValues = [200, 400, 600, 800, 1000];
    // Double Jeopardy round values: 400, 800, 1200, 1600, 2000
    const doubleJeopardyValues = [400, 800, 1200, 1600, 2000];

    const expectedJeopardyClues = 6 * jeopardyValues.length; // 30 clues
    const expectedDoubleJeopardyClues = 6 * doubleJeopardyValues.length; // 30 clues

    // Retry logic: Keep selecting categories until we find ones with all required clues
    const maxRetries = 50; // Prevent infinite loops
    let jeopardyClues: Clue[] = [];
    let doubleJeopardyClues: Clue[] = [];
    let jeopardyCategories: string[] = [];
    let doubleJeopardyCategories: string[] = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Step 1: Select 6 unique categories for Jeopardy round
      jeopardyCategories = await this.selectRandomCategories(
        Round.JEOPARDY,
        6,
      );

      // Step 2: Select 6 unique categories for Double Jeopardy round
      doubleJeopardyCategories = await this.selectRandomCategories(
        Round.DOUBLE_JEOPARDY,
        6,
      );

      // Step 3: Select clues for Jeopardy round (5 clues per category)
      jeopardyClues = [];
      let jeopardyComplete = true;
      for (const category of jeopardyCategories) {
        for (const value of jeopardyValues) {
          const clue = await this.selectClueForCategoryAndValue(
            Round.JEOPARDY,
            category,
            value,
          );
          if (clue) {
            jeopardyClues.push(clue);
          } else {
            jeopardyComplete = false;
            break;
          }
        }
        if (!jeopardyComplete) break;
      }

      // Step 4: Select clues for Double Jeopardy round (5 clues per category)
      doubleJeopardyClues = [];
      let doubleJeopardyComplete = true;
      for (const category of doubleJeopardyCategories) {
        for (const value of doubleJeopardyValues) {
          const clue = await this.selectClueForCategoryAndValue(
            Round.DOUBLE_JEOPARDY,
            category,
            value,
          );
          if (clue) {
            doubleJeopardyClues.push(clue);
          } else {
            doubleJeopardyComplete = false;
            break;
          }
        }
        if (!doubleJeopardyComplete) break;
      }

      // If we found all required clues, break out of retry loop
      if (
        jeopardyClues.length === expectedJeopardyClues &&
        doubleJeopardyClues.length === expectedDoubleJeopardyClues
      ) {
        this.logger.log(
          `Successfully found all required clues on attempt ${attempt + 1}`,
        );
        break;
      }

      // Log retry attempt
      if (attempt < maxRetries - 1) {
        this.logger.warn(
          `Attempt ${attempt + 1}: Missing clues. Jeopardy: ${jeopardyClues.length}/${expectedJeopardyClues}, Double Jeopardy: ${doubleJeopardyClues.length}/${expectedDoubleJeopardyClues}. Retrying with new categories...`,
        );
      }
    }

    // Final validation - should never reach here if database has enough clues
    if (
      jeopardyClues.length < expectedJeopardyClues ||
      doubleJeopardyClues.length < expectedDoubleJeopardyClues
    ) {
      this.logger.error(
        `Failed to find all required clues after ${maxRetries} attempts. Jeopardy: ${jeopardyClues.length}/${expectedJeopardyClues}, Double Jeopardy: ${doubleJeopardyClues.length}/${expectedDoubleJeopardyClues}`,
      );
      throw new Error(
        `Cannot start game: Database does not have enough clues. Found ${jeopardyClues.length}/${expectedJeopardyClues} Jeopardy clues and ${doubleJeopardyClues.length}/${expectedDoubleJeopardyClues} Double Jeopardy clues after ${maxRetries} attempts. Please ensure the database has sufficient clues for all rounds.`,
      );
    }

    // Step 5: Randomly assign 1 Daily Double in Jeopardy
    // Rules: Must be in 3rd, 4th, or 5th position of a category (not 1st or 2nd)
    const jeopardyDailyDoubleIndices = new Set<number>();
    if (jeopardyClues.length === 0) {
      this.logger.error('Cannot assign Daily Double: no Jeopardy clues available');
      throw new Error('Cannot assign Daily Double: No Jeopardy clues available');
    }
    
    // Clues are organized as: 6 categories × 5 values
    // For each category, positions are: 0=200, 1=400, 2=600, 3=800, 4=1000
    // Daily Double must be at position 2, 3, or 4 (3rd, 4th, or 5th clue)
    const validJeopardyPositions: number[] = [];
    for (let i = 0; i < jeopardyClues.length; i++) {
      const positionInCategory = i % 5; // 0-4 for each category
      if (positionInCategory >= 2) { // 3rd, 4th, or 5th clue (indices 2, 3, 4)
        validJeopardyPositions.push(i);
      }
    }
    
    if (validJeopardyPositions.length === 0) {
      throw new Error('Cannot assign Daily Double: No valid positions available (need 3rd, 4th, or 5th clue in category)');
    }
    
    const dailyDoubleIndex = validJeopardyPositions[Math.floor(Math.random() * validJeopardyPositions.length)];
    jeopardyDailyDoubleIndices.add(dailyDoubleIndex);
    
    const category = jeopardyClues[dailyDoubleIndex]?.category;
    const value = jeopardyClues[dailyDoubleIndex]?.value;
    const positionInCategory = (dailyDoubleIndex % 5) + 1; // 1-5 (human readable)
    this.logger.log(
      `Assigned 1 Daily Double in Jeopardy at index: ${dailyDoubleIndex} (out of ${jeopardyClues.length} clues)`,
    );
    this.logger.log(
      `Jeopardy Daily Double will be: ${category} - $${value} (${positionInCategory}${positionInCategory === 1 ? 'st' : positionInCategory === 2 ? 'nd' : positionInCategory === 3 ? 'rd' : 'th'} clue in category)`,
    );

    // Step 6: Randomly assign 2 Daily Doubles in Double Jeopardy
    // Rules: 
    // 1. Must be in 3rd, 4th, or 5th position of a category (not 1st or 2nd)
    // 2. Must be in different categories
    const doubleJeopardyDailyDoubleIndices = new Set<number>();
    if (doubleJeopardyClues.length < 2) {
      this.logger.error(
        `Cannot assign 2 Daily Doubles: only ${doubleJeopardyClues.length} Double Jeopardy clues available`,
      );
      throw new Error(
        `Cannot assign Daily Doubles: Need at least 2 Double Jeopardy clues, but only have ${doubleJeopardyClues.length}`,
      );
    }
    
    // Find valid positions (3rd, 4th, or 5th clue in each category)
    const validDoubleJeopardyPositions: number[] = [];
    for (let i = 0; i < doubleJeopardyClues.length; i++) {
      const positionInCategory = i % 5; // 0-4 for each category
      if (positionInCategory >= 2) { // 3rd, 4th, or 5th clue (indices 2, 3, 4)
        validDoubleJeopardyPositions.push(i);
      }
    }
    
    if (validDoubleJeopardyPositions.length < 2) {
      throw new Error(`Cannot assign 2 Daily Doubles: Only ${validDoubleJeopardyPositions.length} valid positions available (need at least 2)`);
    }
    
    // Group valid positions by category to ensure we pick from different categories
    const positionsByCategory = new Map<string, number[]>();
    for (const index of validDoubleJeopardyPositions) {
      const category = doubleJeopardyClues[index]?.category;
      if (category) {
        if (!positionsByCategory.has(category)) {
          positionsByCategory.set(category, []);
        }
        positionsByCategory.get(category)!.push(index);
      }
    }
    
    // Ensure we have at least 2 different categories
    if (positionsByCategory.size < 2) {
      throw new Error(`Cannot assign 2 Daily Doubles in different categories: Only ${positionsByCategory.size} category(ies) have valid positions`);
    }
    
    // Select 2 Daily Doubles from different categories
    const categories = Array.from(positionsByCategory.keys());
    const shuffledCategories = categories.sort(() => Math.random() - 0.5);
    
    // Pick first Daily Double from first category
    const firstCategoryPositions = positionsByCategory.get(shuffledCategories[0])!;
    const firstDDIndex = firstCategoryPositions[Math.floor(Math.random() * firstCategoryPositions.length)];
    doubleJeopardyDailyDoubleIndices.add(firstDDIndex);
    
    // Pick second Daily Double from a different category
    for (let i = 1; i < shuffledCategories.length; i++) {
      const category = shuffledCategories[i];
      const categoryPositions = positionsByCategory.get(category)!;
      const secondDDIndex = categoryPositions[Math.floor(Math.random() * categoryPositions.length)];
      doubleJeopardyDailyDoubleIndices.add(secondDDIndex);
      break; // Only need one more
    }
    
    const doubleJeopardyIndicesArray = Array.from(doubleJeopardyDailyDoubleIndices);
    this.logger.log(
      `Assigned ${doubleJeopardyDailyDoubleIndices.size} Daily Doubles in Double Jeopardy at indices: ${doubleJeopardyIndicesArray.join(', ')} (out of ${doubleJeopardyClues.length} clues)`,
    );
    
    // Verify they're in different categories
    const selectedCategories = doubleJeopardyIndicesArray.map(idx => doubleJeopardyClues[idx]?.category);
    const uniqueCategories = new Set(selectedCategories);
    if (uniqueCategories.size !== 2) {
      this.logger.error(
        `Daily Double validation failed: Both Daily Doubles are in the same category. Categories: ${Array.from(uniqueCategories).join(', ')}`,
      );
      throw new Error(
        `Daily Double assignment failed: Both Daily Doubles must be in different categories, but both are in: ${Array.from(uniqueCategories).join(', ')}`,
      );
    }
    
    doubleJeopardyIndicesArray.forEach((idx) => {
      const category = doubleJeopardyClues[idx]?.category;
      const value = doubleJeopardyClues[idx]?.value;
      const positionInCategory = (idx % 5) + 1; // 1-5 (human readable)
      this.logger.log(
        `Double Jeopardy Daily Double ${idx + 1}: ${category} - $${value} (${positionInCategory}${positionInCategory === 1 ? 'st' : positionInCategory === 2 ? 'nd' : positionInCategory === 3 ? 'rd' : 'th'} clue in category)`,
      );
    });

    // Validate Daily Double counts before creating GameClues
    if (jeopardyDailyDoubleIndices.size !== 1) {
      this.logger.error(
        `Invalid Daily Double count for Jeopardy: expected 1, got ${jeopardyDailyDoubleIndices.size}`,
      );
      throw new Error(
        `Failed to assign Daily Doubles: Jeopardy should have exactly 1, but got ${jeopardyDailyDoubleIndices.size}`,
      );
    }

    if (doubleJeopardyDailyDoubleIndices.size !== 2) {
      this.logger.error(
        `Invalid Daily Double count for Double Jeopardy: expected 2, got ${doubleJeopardyDailyDoubleIndices.size}`,
      );
      throw new Error(
        `Failed to assign Daily Doubles: Double Jeopardy should have exactly 2, but got ${doubleJeopardyDailyDoubleIndices.size}`,
      );
    }

    // Step 7: Create GameClue records for all clues in a transaction
    const updatedGame = await this.prismaService.client.$transaction(
      async (prisma) => {
        // Create GameClue records for Jeopardy clues
        // IMPORTANT: Only set isDailyDouble based on our random assignment,
        // NOT based on clue.dailyDouble from the database
        const jeopardyGameClues = await Promise.all(
          jeopardyClues.map((clue, index) => {
            const isDD = jeopardyDailyDoubleIndices.has(index);
            this.logger.log(
              `Creating Jeopardy GameClue ${index}: ${clue.category} - $${clue.value}, isDailyDouble: ${isDD}`,
            );
            return prisma.gameClue.create({
              data: {
                gameId,
                clueId: clue.id,
                isDailyDouble: isDD, // Only use our assignment
                state: ClueState.UNANSWERED,
              },
            });
          }),
        );

        // Verify Jeopardy Daily Double count
        const jeopardyDailyDoubleCount = jeopardyGameClues.filter(
          (gc) => gc.isDailyDouble,
        ).length;
        if (jeopardyDailyDoubleCount !== 1) {
          this.logger.error(
            `Jeopardy Daily Double count mismatch: expected 1, got ${jeopardyDailyDoubleCount} in database`,
          );
          throw new Error(
            `Daily Double assignment failed: Jeopardy has ${jeopardyDailyDoubleCount} instead of 1`,
          );
        }

        // Create GameClue records for Double Jeopardy clues
        // IMPORTANT: Only set isDailyDouble based on our random assignment,
        // NOT based on clue.dailyDouble from the database
        const doubleJeopardyGameClues = await Promise.all(
          doubleJeopardyClues.map((clue, index) => {
            const isDD = doubleJeopardyDailyDoubleIndices.has(index);
            this.logger.log(
              `Creating Double Jeopardy GameClue ${index}: ${clue.category} - $${clue.value}, isDailyDouble: ${isDD}`,
            );
            return prisma.gameClue.create({
              data: {
                gameId,
                clueId: clue.id,
                isDailyDouble: isDD, // Only use our assignment
                state: ClueState.UNANSWERED,
              },
            });
          }),
        );

        // Verify Double Jeopardy Daily Double count
        const doubleJeopardyDailyDoubleCount = doubleJeopardyGameClues.filter(
          (gc) => gc.isDailyDouble,
        ).length;
        if (doubleJeopardyDailyDoubleCount !== 2) {
          this.logger.error(
            `Double Jeopardy Daily Double count mismatch: expected 2, got ${doubleJeopardyDailyDoubleCount} in database`,
          );
          throw new Error(
            `Daily Double assignment failed: Double Jeopardy has ${doubleJeopardyDailyDoubleCount} instead of 2`,
          );
        }

        // Step 8: Transition game state to ACTIVE
        const game = await prisma.game.update({
          where: { id: gameId },
          data: { state: GameState.ACTIVE },
        });

        return game;
      },
    );

    // Final verification: Query the database to ensure Daily Double counts are correct
    const allGameClues = await this.prismaService.client.gameClue.findMany({
      where: { gameId },
      include: { clue: true },
    });

    const jeopardyDDCount = allGameClues.filter(
      (gc) => gc.clue.round === Round.JEOPARDY && gc.isDailyDouble,
    ).length;
    const doubleJeopardyDDCount = allGameClues.filter(
      (gc) => gc.clue.round === Round.DOUBLE_JEOPARDY && gc.isDailyDouble,
    ).length;

    if (jeopardyDDCount !== 1) {
      this.logger.error(
        `Final verification failed: Jeopardy has ${jeopardyDDCount} Daily Doubles instead of 1`,
      );
      throw new Error(
        `Daily Double verification failed: Jeopardy has ${jeopardyDDCount} Daily Doubles instead of 1`,
      );
    }

    if (doubleJeopardyDDCount !== 2) {
      this.logger.error(
        `Final verification failed: Double Jeopardy has ${doubleJeopardyDDCount} Daily Doubles instead of 2`,
      );
      throw new Error(
        `Daily Double verification failed: Double Jeopardy has ${doubleJeopardyDDCount} Daily Doubles instead of 2`,
      );
    }

    this.logger.log(
      `Game ${gameId} started successfully with ${jeopardyDDCount} Jeopardy and ${doubleJeopardyDDCount} Double Jeopardy Daily Doubles`,
    );
    return updatedGame;
  }

  /**
   * Select random unique categories for a round
   */
  private async selectRandomCategories(
    round: Round,
    count: number,
  ): Promise<string[]> {
    const categories = await this.prismaService.client.clue.findMany({
      where: { round },
      select: { category: true },
      distinct: ['category'],
    });

    if (categories.length < count) {
      throw new Error(
        `Not enough categories available for ${round} round. Found ${categories.length}, need ${count}`,
      );
    }

    // Shuffle and select
    const shuffled = categories.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((c) => c.category);
  }

  /**
   * Select a clue for a specific category and value
   * Prefers clues that are not marked as Daily Doubles in the database
   * to ensure we have full control over Daily Double assignment per game.
   * Falls back to Daily Double clues if no non-Daily Double clues are available.
   */
  private async selectClueForCategoryAndValue(
    round: Round,
    category: string,
    value: number,
  ): Promise<Clue | null> {
    // First, try to find clues that are NOT marked as Daily Doubles
    let clues = await this.prismaService.client.clue.findMany({
      where: {
        round,
        category,
        value,
        dailyDouble: false,
      },
    });

    // If no non-Daily Double clues found, fall back to Daily Double clues
    // This ensures we can still create games even if some category/value combos
    // only have Daily Double clues in the database
    if (clues.length === 0) {
      this.logger.warn(
        `No non-Daily Double clues found for ${round} round, category "${category}", value ${value}. Falling back to Daily Double clues.`,
      );
      clues = await this.prismaService.client.clue.findMany({
        where: {
          round,
          category,
          value,
          dailyDouble: true,
        },
      });
    }

    if (clues.length === 0) {
      this.logger.error(
        `No clues found for ${round} round, category "${category}", value ${value}`,
      );
      return null;
    }

    // Randomly select one clue
    const randomIndex = Math.floor(Math.random() * clues.length);
    return clues[randomIndex];
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
          dailyDouble: gc.isDailyDouble, // Only use GameClue's isDailyDouble for per-game control
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
    if (isDailyDouble && gameClue.wager === null) {
      this.logger.error(
        `Daily Double clue ${clueId} has no wager. GameClue state: ${gameClue.state}, isDailyDouble: ${gameClue.isDailyDouble}`,
      );
      throw new Error('Daily Double wager is required');
    }
    
    const baseValue = isDailyDouble
      ? (gameClue.wager as number) // Cast to number since we've validated it's not null
      : gameClue.clue.value;
    
    if (isDailyDouble) {
      this.logger.log(
        `Daily Double answered: wager=${gameClue.wager}, baseValue=${baseValue}, correct=${correct}`,
      );
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
        include: { clue: true },
      }),
      this.prismaService.client.game.update({
        where: { id: gameId },
        data: { score: newScore },
      }),
    ]);

    // Update user statistics for clue resolution
    await this.userService.updateUserStatsOnClueResolved(
      userId,
      updatedGameClue,
      correct,
    );

    // Update Daily Double wager stats if applicable
    if (isDailyDouble && gameClue.wager !== null) {
      await this.userService.updateUserStatsOnDailyDoubleWager(
        userId,
        gameClue.wager,
        correct,
      );
    }

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

    // Verify clue is a Daily Double (only check GameClue's isDailyDouble for per-game control)
    if (!gameClue.isDailyDouble) {
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

    // Update user statistics for Final Jeopardy and game completion (use game owner id)
    const gameOwnerId = result.game.userId;
    await this.userService.updateUserStatsOnFinalJeopardyWager(
      gameOwnerId,
      wager,
      correct,
    );
    await this.userService.updateUserStatsOnGameComplete(gameOwnerId, finalScore);

    return {
      game: result.game,
      finalJeopardy: result.finalJeopardy,
      finalScore,
    };
  }

  /**
   * End/abandon a game that is in progress
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
    if (
      game.state === GameState.COMPLETED ||
      game.state === GameState.ELIMINATED
    ) {
      throw new Error(`Game is already ${game.state}`);
    }

    // Transition to ELIMINATED state (abandoned game)
    const updatedGame = await this.prismaService.client.game.update({
      where: { id: gameId },
      data: { state: GameState.ELIMINATED },
    });

    // Do not update Games Played or completion stats for abandoned games.
    // Only games completed via Final Jeopardy (COMPLETED state) are counted.

    return updatedGame;
  }
}
