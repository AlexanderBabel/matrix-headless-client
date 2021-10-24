import {
  Body,
  Controller,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

import { MatrixService } from 'src/matrix/matrix.service';
import { NotificationDto } from './dtos/notification.dto';

@Controller('uptime')
export class UptimeController {
  private readonly VARS = {
    secret: this.configService.get<string>('UPTIME_SECRET'),
    roomId: this.configService.get<string>('UPTIME_ROOM_ID'),
  };

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private configService: ConfigService,
    private matrixService: MatrixService,
  ) {}

  @Post('/notify')
  async notify(
    @Body(new ValidationPipe()) data: NotificationDto,
    @Query('secret') secret: string,
  ) {
    if (!secret || this.VARS.secret !== secret || !this.VARS.roomId) {
      throw new UnauthorizedException();
    }

    await this.matrixService.sendMessage(this.VARS.roomId, data.msg);
    return { success: true };
  }
}
