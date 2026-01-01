import {
  Injectable,
  Logger,
  ConflictException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CluebaseService, CluebaseClue } from '../cluebase/cluebase.service';
import { GameState, Round, ClueState } from '@prisma/client';
import { GameResponseDto } from './dto/game-response.dto';

interface BoardConstructionResult {
  categories: string[];
  clues: CluebaseClue[];
  dailyDoubleCount: number;
}

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private readonly JEOPARDY_VALUES = [200, 400, 600, 800, 1000];
  private readonly DOUBLE_JEOPARDY_VALUES = [400, 800, 1200, 1600, 2000];

  constructor(
    private readonly prisma: PrismaService,
    private readonly cluebaseService: CluebaseService,
  ) {}

  /**
   * Creates a new game for a user
   */
  async createGame(userId: string): Promise<GameResponseDto> {
    try {
      // Step 1: Validate user and check for active game
      await this.validateNoActiveGame(userId);

      // Step 2: Fetch and filter clues from Cluebase API
      const allClues = await this.cluebaseService.fetchClues();
      const validClues = this.cluebaseService.filterValidClues(allClues);
      const { jeopardy, doubleJeopardy } =
        this.cluebaseService.groupCluesByRoundAndCategory(validClues);

    // Step 3: Construct Jeopardy round board
    const jeopardyBoard = this.constructBoard(
      jeopardy,
      this.JEOPARDY_VALUES,
      Round.JEOPARDY,
      1, // Exactly 1 Daily Double
    );

    // Step 4: Construct Double Jeopardy round board
    const doubleJeopardyBoard = this.constructBoard(
      doubleJeopardy,
      this.DOUBLE_JEOPARDY_VALUES,
      Round.DOUBLE_JEOPARDY,
      2, // Exactly 2 Daily Doubles
    );

    // Step 5: Persist game and clues in transaction
    const game = await this.persistGame(
      userId,
      jeopardyBoard,
      doubleJeopardyBoard,
    );

      // Step 6: Return game response
      return await this.buildGameResponse(game);
    } catch (error) {
      // Re-throw known exceptions (ServiceUnavailableException, UnprocessableEntityException, ConflictException)
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof UnprocessableEntityException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      // Log and re-throw unknown errors
      this.logger.error('Unexpected error creating game', error);
      throw error;
    }
  }

  /**
   * Validates that user has no active game
   */
  private async validateNoActiveGame(userId: string): Promise<void> {
    const activeGame = await this.prisma.client.game.findFirst({
      where: {
        userId,
        state: {
          in: [
            GameState.PENDING,
            GameState.ACTIVE,
            GameState.FINAL_PENDING,
            GameState.FINAL_ACTIVE,
          ],
        },
      },
    });

    if (activeGame) {
      throw new ConflictException(
        'User already has an active game. Please complete or abandon the existing game.',
      );
    }
  }

  /**
   * Constructs a game board for a round
   */
  private constructBoard(
    cluesByCategory: Map<string, CluebaseClue[]>,
    requiredValues: number[],
    round: Round,
    requiredDailyDoubles: number,
  ): BoardConstructionResult {
    const selectedCategories: string[] = [];
    const selectedClues: CluebaseClue[] = [];
    let dailyDoubleCount = 0;

    // Select 6 categories
    const availableCategories = Array.from(cluesByCategory.keys());
    if (availableCategories.length < 6) {
      throw new UnprocessableEntityException(
        `Insufficient categories for ${round} round. Found ${availableCategories.length}, need 6.`,
      );
    }

    // Shuffle and take first 6 categories
    const shuffledCategories = this.shuffleArray([...availableCategories]);
    const categoriesToUse = shuffledCategories.slice(0, 6);

    // For each category, select clues matching required values
    for (const category of categoriesToUse) {
      const categoryClues = cluesByCategory.get(category) || [];
      const cluesByValue = new Map<number, CluebaseClue[]>();

      // Group clues by value
      for (const clue of categoryClues) {
        if (requiredValues.includes(clue.value)) {
          if (!cluesByValue.has(clue.value)) {
            cluesByValue.set(clue.value, []);
          }
          cluesByValue.get(clue.value)!.push(clue);
        }
      }

      // Select one clue for each required value
      const categorySelectedClues: CluebaseClue[] = [];
      for (const value of requiredValues) {
        const cluesForValue = cluesByValue.get(value) || [];
        if (cluesForValue.length === 0) {
          throw new UnprocessableEntityException(
            `Cannot find clue for ${round} round, category "${category}", value $${value}`,
          );
        }

        // Select a random clue for this value
        const selectedClue =
          cluesForValue[Math.floor(Math.random() * cluesForValue.length)];
        categorySelectedClues.push(selectedClue);

        if (selectedClue.daily_double) {
          dailyDoubleCount++;
        }
      }

      selectedCategories.push(category);
      selectedClues.push(...categorySelectedClues);
    }

    // Validate Daily Double count
    if (dailyDoubleCount !== requiredDailyDoubles) {
      throw new UnprocessableEntityException(
        `Invalid Daily Double count for ${round} round. Found ${dailyDoubleCount}, need ${requiredDailyDoubles}.`,
      );
    }

    return {
      categories: selectedCategories,
      clues: selectedClues,
      dailyDoubleCount,
    };
  }

  /**
   * Persists game and all clues in a transaction
   */
  private async persistGame(
    userId: string,
    jeopardyBoard: BoardConstructionResult,
    doubleJeopardyBoard: BoardConstructionResult,
  ) {
    try {
      return await this.prisma.client.$transaction(async (tx) => {
        // Create game
        const game = await tx.game.create({
          data: {
            userId,
            state: GameState.PENDING,
            score: 0,
          },
        });

        // Process all clues with their rounds
        const jeopardyCluesWithRound = jeopardyBoard.clues.map((c) => ({
          ...c,
          round: 'Jeopardy!' as string,
        }));
        const doubleJeopardyCluesWithRound = doubleJeopardyBoard.clues.map((c) => ({
          ...c,
          round: 'Double Jeopardy!' as string,
        }));
        const allClues = [...jeopardyCluesWithRound, ...doubleJeopardyCluesWithRound];

        // Create or find clues and link to game
        for (const cluebaseClue of allClues) {
          // Map Cluebase round to our Round enum
          const roundEnum =
            cluebaseClue.round === 'Jeopardy!' ? Round.JEOPARDY : Round.DOUBLE_JEOPARDY;

          // Find or create Clue record
          let clue = await tx.clue.findFirst({
            where: {
              category: cluebaseClue.category,
              round: roundEnum,
              value: cluebaseClue.value,
              question: cluebaseClue.clue,
              answer: cluebaseClue.answer,
              dailyDouble: cluebaseClue.daily_double,
            },
          });

          if (!clue) {
            clue = await tx.clue.create({
              data: {
                category: cluebaseClue.category,
                round: roundEnum,
                value: cluebaseClue.value,
                question: cluebaseClue.clue,
                answer: cluebaseClue.answer,
                dailyDouble: cluebaseClue.daily_double,
              },
            });
          }

          // Create GameClue link
          await tx.gameClue.create({
            data: {
              gameId: game.id,
              clueId: clue.id,
              state: ClueState.UNANSWERED,
            },
          });
        }

        // Create audit log
        await tx.gameAudit.create({
          data: {
            gameId: game.id,
            action: 'GAME_CREATED',
            details: {
              jeopardyCategories: jeopardyBoard.categories,
              jeopardyDailyDoubles: jeopardyBoard.dailyDoubleCount,
              doubleJeopardyCategories: doubleJeopardyBoard.categories,
              doubleJeopardyDailyDoubles: doubleJeopardyBoard.dailyDoubleCount,
            },
          },
        });

        return game;
      });
    } catch (error) {
      this.logger.error('Failed to persist game', error);
      throw error;
    }
  }

  /**
   * Builds the game response DTO
   */
  private async buildGameResponse(game: any): Promise<GameResponseDto> {
    const gameWithRelations = await this.prisma.client.game.findUnique({
      where: { id: game.id },
      include: {
        gameClues: {
          include: {
            clue: true,
          },
        },
      },
    });

    if (!gameWithRelations) {
      throw new Error('Game not found after creation');
    }

    // Organize clues by round and category
    const jeopardyClues = gameWithRelations.gameClues.filter(
      (gc) => gc.clue.round === Round.JEOPARDY,
    );
    const doubleJeopardyClues = gameWithRelations.gameClues.filter(
      (gc) => gc.clue.round === Round.DOUBLE_JEOPARDY,
    );

    const jeopardyBoard = this.organizeCluesIntoBoard(jeopardyClues, Round.JEOPARDY);
    const doubleJeopardyBoard = this.organizeCluesIntoBoard(
      doubleJeopardyClues,
      Round.DOUBLE_JEOPARDY,
    );

    return {
      id: gameWithRelations.id,
      state: gameWithRelations.state,
      score: gameWithRelations.score,
      boards: [jeopardyBoard, doubleJeopardyBoard],
      createdAt: gameWithRelations.createdAt,
      updatedAt: gameWithRelations.updatedAt,
    };
  }

  /**
   * Organizes clues into board structure by category
   */
  private organizeCluesIntoBoard(
    gameClues: Array<{
      id: string;
      state: ClueState;
      clue: {
        id: string;
        category: string;
        value: number;
        dailyDouble: boolean;
      };
    }>,
    round: Round,
  ) {
    const categoriesMap = new Map<string, typeof gameClues>();

    for (const gameClue of gameClues) {
      const category = gameClue.clue.category;
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, []);
      }
      categoriesMap.get(category)!.push(gameClue);
    }

    const categories = Array.from(categoriesMap.entries()).map(([name, clues]) => ({
      name,
      clues: clues
        .sort((a, b) => a.clue.value - b.clue.value)
        .map((gc) => ({
          id: gc.clue.id,
          category: gc.clue.category,
          value: gc.clue.value,
          dailyDouble: gc.clue.dailyDouble,
          state: gc.state,
        })),
    }));

    return {
      round,
      categories,
    };
  }

  /**
   * Shuffles an array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

