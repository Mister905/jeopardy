import { BadRequestException } from '@nestjs/common';

export class PassValidationException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
