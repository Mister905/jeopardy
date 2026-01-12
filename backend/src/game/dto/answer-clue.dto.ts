import { IsBoolean, IsNotEmpty } from 'class-validator';

export class AnswerClueDto {
  @IsBoolean()
  @IsNotEmpty()
  correct: boolean;
}
