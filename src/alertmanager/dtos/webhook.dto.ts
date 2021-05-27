import { Type } from 'class-transformer';
import {
  Equals,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { KeyValue, WebhookAlert } from './webhook.alert.dto';

export class WebhookDto {
  @Equals('4')
  version!: '4';

  @IsString()
  groupKey!: string;

  @IsNumber()
  truncatedAlerts!: number;

  @IsString()
  status!: 'resolved' | 'firing' | string;

  @IsString()
  receiver!: string;

  @IsObject()
  groupLabels!: KeyValue;

  @IsObject()
  commonLabels!: KeyValue;

  @IsObject()
  commonAnnotations!: KeyValue;

  @IsString()
  externalURL!: string;

  @ValidateNested({ each: true })
  @Type(() => WebhookAlert)
  alerts!: WebhookAlert[];
}
