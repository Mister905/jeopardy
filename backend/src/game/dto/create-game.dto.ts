import { IsOptional, IsString, Length } from 'class-validator';

export class CreateGameDto {
  @IsOptional()
  @IsString()
  @Length(3, 50, {
    message: 'Username must be between 3 and 50 characters',
  })
  username?: string;
}
