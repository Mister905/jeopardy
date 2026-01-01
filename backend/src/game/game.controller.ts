import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GameService } from './game.service';
import { CreateGameDto } from './dto/create-game.dto';
import { GameResponseDto } from './dto/game-response.dto';
import { CurrentUser } from './dto/user.decorator';

@Controller('games')
export class GameController {
  private readonly logger = new Logger(GameController.name);

  constructor(private readonly gameService: GameService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createGame(
    @CurrentUser() userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _dto: CreateGameDto,
  ): Promise<GameResponseDto> {
    try {
      this.logger.log(`Creating game for user ${userId}`);
      return await this.gameService.createGame(userId);
    } catch (error) {
      this.logger.error(`Failed to create game for user ${userId}`, error);

      // Re-throw known exceptions
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }

      // For unknown errors, throw 500
      throw error;
    }
  }
}

