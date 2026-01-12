import { NotFoundException } from '@nestjs/common';

export class GameNotFoundException extends NotFoundException {
  constructor(gameId: string) {
    super(`Game not found: ${gameId}`);
  }
}
