import { IsNumber, IsNotEmpty, Min } from 'class-validator';

export class SubmitWagerDto {
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  wager: number;
}
