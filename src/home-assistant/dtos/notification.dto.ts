import { IsString } from 'class-validator';

export class NotificationDto {
  @IsString()
  roomId!: string;

  @IsString()
  message!: string;
}
