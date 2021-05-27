import { Type } from 'class-transformer';
import {
  Equals,
  IsNumber,
  IsObject,
  IsRFC3339,
  IsString,
  ValidateNested,
} from 'class-validator';

export type KeyValue = {
  [key: string]: string;
};

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

export class WebhookAlert {
  @IsString()
  status!: 'resolved' | 'firing' | string;

  @IsObject()
  labels!: KeyValue;

  @IsObject()
  annotations!: KeyValue;

  @IsRFC3339()
  startsAt!: Date;

  @IsRFC3339()
  endsAt!: Date;

  @IsString()
  generatorURL!: string;

  @IsString()
  fingerprint!: string;
}
