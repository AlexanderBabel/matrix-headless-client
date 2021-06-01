import { IsNumber, IsString } from 'class-validator';

export class ChoreCompleteDto {
  @IsString()
  roomId!: string;

  @IsNumber()
  choreId!: string;
}
