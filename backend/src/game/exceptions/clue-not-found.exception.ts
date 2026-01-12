import { NotFoundException } from '@nestjs/common';

export class ClueNotFoundException extends NotFoundException {
  constructor(clueId: string) {
    super(`Clue not found in this game: ${clueId}`);
  }
}
