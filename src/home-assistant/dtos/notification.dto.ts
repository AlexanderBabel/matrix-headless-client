import { IsString, ValidateNested } from 'class-validator';
import { AttachmentDto } from './attachment.dto';

export class NotificationDto {
  @IsString()
  roomId!: string;

  @IsString()
  message!: string;

  @ValidateNested()
  attachment?: AttachmentDto;
}
