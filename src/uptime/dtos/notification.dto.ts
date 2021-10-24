import { IsString } from 'class-validator';

export class NotificationDto {
  @IsString()
  msg!: string;
}
