import { IsObject, IsRFC3339, IsString } from "class-validator";

export type KeyValue = {
  [key: string]: string;
};

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
