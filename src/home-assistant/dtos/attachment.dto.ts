import { IsString } from 'class-validator';

export class AttachmentDto {
  @IsString()
  contentType!: string;

  @IsString()
  content!: string;

  @IsString()
  name?: string;
}
