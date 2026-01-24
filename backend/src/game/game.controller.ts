import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { GameService } from './game.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types';
import {
  CreateGameDto,
  StartGameDto,
  AnswerClueDto,
  SubmitWagerDto,
  ListGamesQueryDto,
  GameResponseDto,
  ListGamesResponseDto,
  BoardResponseDto,
  StartGameResponseDto,
  AnswerClueResponseDto,
  SubmitWagerResponseDto,
  FinalJeopardyWagerResponseDto,
  FinalJeopardyAnswerResponseDto,
} from './dto';
import {
  GameNotFoundException,
  GameStateException,
  ClueNotFoundException,
  WagerValidationException,
  UnauthorizedGameAccessException,
} from './exceptions';
import { GameState, Round, Game, GameClue, FinalJeopardy, Clue } from '@prisma/client';

// Type for game with relations as returned by getGameById
type GameWithRelations = Game & {
  gameClues?: (GameClue & { clue: Clue })[];
  finalJeopardy?: (FinalJeopardy & { clue: Clue }) | null;
};

@Controller('games')
@UseGuards(AuthGuard)
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private readonly gameService: GameService) {}

  /**
   * Verify game ownership and throw appropriate exceptions if not found or unauthorized
   */
  private async verifyGameOwnership(
    gameId: string,
    userId: string,
  ): Promise<GameWithRelations> {
    const game = await this.gameService.getGameById(gameId, userId);
    
    if (!game) {
      // Check if game exists but doesn't belong to user
      const gameExists = await this.gameService.getGameById(gameId, '');
      if (gameExists) {
        throw new UnauthorizedGameAccessException();
      }
      throw new GameNotFoundException(gameId);
    }
    
    if (game.userId !== userId) {
      throw new UnauthorizedGameAccessException();
    }
    
    return game;
  }

  /**
   * Handle service errors and convert to appropriate exceptions
   */
  private handleServiceError(error: unknown, gameId: string, userId: string): never {
    // Re-throw known exceptions as-is
    if (
      error instanceof GameNotFoundException ||
      error instanceof GameStateException ||
      error instanceof WagerValidationException ||
      error instanceof ClueNotFoundException ||
      error instanceof UnauthorizedGameAccessException
    ) {
      throw error;
    }

    // For unknown errors, check if it's a known error pattern
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
      throw new GameNotFoundException(gameId);
    }
    
    // Re-throw unknown errors - let NestJS handle them
    throw error;
  }

  /**
   * POST /games
   * Create a new game for the authenticated user
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGame(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGameDto,
  ): Promise<GameResponseDto> {
    this.logger.log(`Creating game for user: ${user.userId}`);

    try {
      const result = await this.gameService.createGame(user.userId, user.email);
      // CreateGameResult.game has finalJeopardy with clue, but no gameClues
      // Map it to match GameWithRelations structure
      const gameData = {
        ...result.game,
        gameClues: undefined,
        finalJeopardy: result.game.finalJeopardy
          ? {
              ...result.game.finalJeopardy,
              clue: result.game.finalJeopardy.clue,
            }
          : null,
      } as GameWithRelations;
      return this.mapGameToResponseDto(gameData);
    } catch (error) {
      this.logger.error(`Failed to create game: ${error.message}`);
      throw error;
    }
  }

  /**
   * GET /games
   * List all games for the authenticated user
   */
  @Get()
  async listGames(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListGamesQueryDto,
  ): Promise<ListGamesResponseDto> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const result = await this.gameService.listGames(
      user.userId,
      query.status,
      limit,
      offset,
    );

    return {
      games: result.games.map((game) => ({
        id: game.id,
        userId: game.userId,
        state: game.state,
        score: game.score,
        createdAt: game.createdAt.toISOString(),
        updatedAt: game.updatedAt.toISOString(),
      })),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  /**
   * GET /games/:id
   * Get detailed information about a specific game
   */
  @Get(':id')
  async getGame(
    @Param('id') gameId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GameResponseDto> {
    const game = await this.gameService.getGameById(gameId, user.userId);

    if (!game) {
      throw new GameNotFoundException(gameId);
    }

    return this.mapGameToResponseDto(game);
  }

  /**
   * POST /games/:id/start
   * Start a game by creating Jeopardy and Double Jeopardy boards
   */
  @Post(':id/start')
  async startGame(
    @Param('id') gameId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartGameDto,
  ): Promise<StartGameResponseDto> {
    this.logger.log(`Starting game ${gameId} for user: ${user.userId}`);

    // Verify ownership before proceeding
    const game = await this.verifyGameOwnership(gameId, user.userId);
    
    // Verify game state
    if (game.state !== GameState.PENDING) {
      throw new GameStateException(game.state, GameState.PENDING);
    }

    try {
      const updatedGame = await this.gameService.startGame(gameId, user.userId);
      return {
        message: 'Game started successfully',
        game: this.mapGameToResponseDto(updatedGame),
      };
    } catch (error) {
      this.logger.error(`Failed to start game: ${error instanceof Error ? error.message : String(error)}`);
      this.handleServiceError(error, gameId, user.userId);
    }
  }

  /**
   * GET /games/:id/board
   * Get the current round's board state
   */
  @Get(':id/board')
  async getBoard(
    @Param('id') gameId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('round') round?: Round,
  ): Promise<BoardResponseDto> {
    const board = await this.gameService.getBoard(gameId, user.userId, round);
    
    // The service already returns the correct format, just cast it
    return board as BoardResponseDto;
  }

  /**
   * POST /games/:id/clues/:clueId/answer
   * Answer a regular clue or submit Daily Double answer
   */
  @Post(':id/clues/:clueId/answer')
  async answerClue(
    @Param('id') gameId: string,
    @Param('clueId') clueId: string,
    @Body() dto: AnswerClueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AnswerClueResponseDto> {
    this.logger.log(
      `Answering clue ${clueId} in game ${gameId} for user: ${user.userId}`,
    );

    // Verify ownership before proceeding
    const game = await this.verifyGameOwnership(gameId, user.userId);
    
    // Verify game state
    if (game.state !== GameState.ACTIVE) {
      throw new GameStateException(game.state, GameState.ACTIVE);
    }

    try {
      const result = await this.gameService.answerClue(
        gameId,
        clueId,
        user.userId,
        dto.correct,
      );

      return {
        gameClueId: result.gameClue.id,
        clueId: result.gameClue.clueId,
        state: result.gameClue.state,
        correct: dto.correct,
        scoreDelta: result.gameClue.scoreDelta ?? 0,
        newScore: result.newScore,
        answeredAt: result.gameClue.answeredAt?.toISOString() ?? new Date().toISOString(),
        message: 'Clue answered successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to answer clue: ${error instanceof Error ? error.message : String(error)}`);
      // ClueNotFoundException is already handled by handleServiceError
      // Check for "already resolved" error and convert to BadRequest
      if (error instanceof Error && error.message.includes('already been resolved')) {
        throw new BadRequestException(error.message);
      }
      this.handleServiceError(error, gameId, user.userId);
    }
  }

  /**
   * POST /games/:id/clues/:clueId/wager
   * Submit a wager for a Daily Double clue
   */
  @Post(':id/clues/:clueId/wager')
  async submitClueWager(
    @Param('id') gameId: string,
    @Param('clueId') clueId: string,
    @Body() dto: SubmitWagerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubmitWagerResponseDto> {
    this.logger.log(
      `Submitting wager for clue ${clueId} in game ${gameId} for user: ${user.userId}`,
    );

    // Verify ownership before proceeding
    const game = await this.verifyGameOwnership(gameId, user.userId);
    
    // Verify game state
    if (game.state !== GameState.ACTIVE) {
      throw new GameStateException(game.state, GameState.ACTIVE);
    }

    // Validate minimum wager for Daily Doubles
    if (dto.wager < 5) {
      throw new WagerValidationException('Wager must be at least $5');
    }

    try {
      const result = await this.gameService.submitClueWager(
        gameId,
        clueId,
        user.userId,
        dto.wager,
      );

      // Calculate maxWager: greater of (current score, highest clue value in round)
      // For now, use a placeholder until we can determine the round and highest value
      // This will be properly implemented when board creation is complete
      const maxWager = Math.max(game.score, 1000); // Placeholder - will be calculated from round

      return {
        gameClueId: result.id,
        clueId: result.clueId,
        wager: result.wager ?? 0,
        currentScore: game.score,
        maxWager,
        message: 'Wager submitted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to submit wager: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.message.includes('Clue not found')) {
        throw new ClueNotFoundException(clueId);
      }
      if (error instanceof Error && (error.message.includes('wager') || error.message.includes('Wager'))) {
        throw new WagerValidationException(error.message);
      }
      this.handleServiceError(error, gameId, user.userId);
    }
  }

  /**
   * POST /games/:id/final-jeopardy/wager
   * Submit a wager for Final Jeopardy
   */
  @Post(':id/final-jeopardy/wager')
  async submitFinalJeopardyWager(
    @Param('id') gameId: string,
    @Body() dto: SubmitWagerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinalJeopardyWagerResponseDto> {
    this.logger.log(
      `Submitting Final Jeopardy wager for game ${gameId} for user: ${user.userId}`,
    );

    // Verify ownership before proceeding
    const game = await this.verifyGameOwnership(gameId, user.userId);
    
    // Verify game state
    if (game.state !== GameState.FINAL_PENDING) {
      throw new GameStateException(game.state, GameState.FINAL_PENDING);
    }

    try {
      const result = await this.gameService.submitFinalJeopardyWager(
        gameId,
        user.userId,
        dto.wager,
      );

      return {
        gameId,
        finalJeopardyId: result.id,
        wager: result.wager,
        currentScore: game.score,
        message: 'Final Jeopardy wager submitted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to submit Final Jeopardy wager: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && (error.message.includes('Wager') || error.message.includes('score'))) {
        throw new WagerValidationException(error.message);
      }
      this.handleServiceError(error, gameId, user.userId);
    }
  }

  /**
   * POST /games/:id/final-jeopardy/answer
   * Submit the answer (correct/incorrect) for Final Jeopardy
   */
  @Post(':id/final-jeopardy/answer')
  async answerFinalJeopardy(
    @Param('id') gameId: string,
    @Body() dto: AnswerClueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FinalJeopardyAnswerResponseDto> {
    this.logger.log(
      `Answering Final Jeopardy for game ${gameId} for user: ${user.userId}`,
    );

    // Verify ownership before proceeding
    const game = await this.verifyGameOwnership(gameId, user.userId);
    
    // Verify game state
    if (game.state !== GameState.FINAL_ACTIVE) {
      throw new GameStateException(game.state, GameState.FINAL_ACTIVE);
    }

    try {
      const result = await this.gameService.answerFinalJeopardy(
        gameId,
        user.userId,
        dto.correct,
      );

      return {
        gameId,
        finalJeopardyId: result.finalJeopardy.id,
        correct: result.finalJeopardy.correct ?? false,
        wager: result.finalJeopardy.wager,
        scoreDelta: result.finalJeopardy.scoreDelta ?? 0,
        finalScore: result.finalScore,
        gameState: result.game.state,
        answeredAt: result.finalJeopardy.answeredAt?.toISOString() ?? new Date().toISOString(),
        message: 'Final Jeopardy answered successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to answer Final Jeopardy: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && (error.message.includes('Wager') || error.message.includes('already been answered'))) {
        throw new WagerValidationException(error.message);
      }
      this.handleServiceError(error, gameId, user.userId);
    }
  }

  /**
   * Map game entity to response DTO
   */
  private mapGameToResponseDto(game: GameWithRelations): GameResponseDto {
    return {
      id: game.id,
      userId: game.userId,
      state: game.state,
      score: game.score,
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
      gameClues: game.gameClues?.map((gc) => ({
        id: gc.id,
        gameId: gc.gameId,
        clueId: gc.clueId,
        state: gc.state,
        wager: gc.wager,
        scoreDelta: gc.scoreDelta,
        answeredAt: gc.answeredAt?.toISOString() ?? null,
        clue: {
          id: gc.clue.id,
          category: gc.clue.category,
          round: gc.clue.round,
          value: gc.clue.value,
          question: gc.clue.question,
          answer: gc.clue.answer,
          // Daily Double status: Use isDailyDouble from GameClue as the source of truth for this game
          // The Clue table's dailyDouble field indicates if a clue CAN be a Daily Double,
          // but isDailyDouble in GameClue indicates if it IS a Daily Double in this specific game.
          // This ensures we show exactly 1 Daily Double for Jeopardy and 2 for Double Jeopardy
          // for new games, even if the database has more Daily Doubles in the selected categories.
          // NOTE: Games created before the isDailyDouble field was added will have isDailyDouble: false
          // for all clues, so they should create a new game to get the correct Daily Double count.
          dailyDouble: gc.isDailyDouble,
          createdAt: gc.clue.createdAt.toISOString(),
        },
      })),
      finalJeopardy: game.finalJeopardy
        ? {
            id: game.finalJeopardy.id,
            gameId: game.finalJeopardy.gameId,
            clueId: game.finalJeopardy.clueId,
            wager: game.finalJeopardy.wager,
            correct: game.finalJeopardy.correct,
            scoreDelta: game.finalJeopardy.scoreDelta,
            answeredAt: game.finalJeopardy.answeredAt?.toISOString() ?? null,
            clue: {
              id: game.finalJeopardy.clue.id,
              category: game.finalJeopardy.clue.category,
              round: game.finalJeopardy.clue.round,
              value: game.finalJeopardy.clue.value,
              question: game.finalJeopardy.clue.question,
              answer: game.finalJeopardy.clue.answer,
              dailyDouble: game.finalJeopardy.clue.dailyDouble,
              createdAt: game.finalJeopardy.clue.createdAt.toISOString(),
            },
          }
        : undefined,
    };
  }

  /**
   * POST /games/:id/end
   * End/abandon a game that is in progress
   */
  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async endGame(
    @Param('id') gameId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<GameResponseDto> {
    this.logger.log(`Ending game ${gameId} for user: ${user.userId}`);

    // Verify ownership before proceeding
    const game = await this.verifyGameOwnership(gameId, user.userId);

    try {
      const updatedGame = await this.gameService.endGame(gameId, user.userId);
      return this.mapGameToResponseDto(updatedGame);
    } catch (error) {
      this.logger.error(
        `Failed to end game: ${error instanceof Error ? error.message : String(error)}`,
      );
      this.handleServiceError(error, gameId, user.userId);
    }
  }
}
