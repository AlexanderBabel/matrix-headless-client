import {
  Body,
  CACHE_MANAGER,
  Controller,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MatrixService, MessageContent } from 'src/matrix/matrix.service';
import striptags from 'striptags';
import { AlertService } from './alert.service';
import { WebhookDto } from './dtos/webhook.dto';

const ALERTMANAGER_CACHE_PREFIX = 'am-event-id-';

@Controller('alertmanager')
export class AlertManagerController {
  private ALERTMANAGER_SECRET = this.configService.get<string>(
    'ALERTMANAGER_SECRET',
  );

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private configService: ConfigService,
    private alertService: AlertService,
    private matrixService: MatrixService,
  ) {}

  @Post()
  async webhook(
    @Body(new ValidationPipe()) data: WebhookDto,
    @Query('secret') secret: string,
  ) {
    if (!secret || this.ALERTMANAGER_SECRET !== secret) {
      throw new UnauthorizedException();
    }

    const roomId = this.alertService.getRoom(data.receiver);
    if (!roomId) {
      this.logger.warn(
        '[AlertManager] Received webhook call, but no room was found!',
      );
      return { success: false };
    }

    await Promise.all(
      data.alerts.map(async (alert) => {
        const alertCacheId = `${ALERTMANAGER_CACHE_PREFIX}${alert.fingerprint}`;
        const message = this.alertService.formatAlert(alert);
        const eventId = await this.cacheManager.get<string>(alertCacheId);

        const content: MessageContent = {
          msgtype: 'm.text',
          body: striptags(message),
          format: 'org.matrix.custom.html',
          formatted_body: message,
        };

        if (eventId) {
          await this.matrixService.editMessageContent(roomId, eventId, content);
          await this.cacheManager.del(alertCacheId);
        } else {
          const response = await this.matrixService.sendMessageContent(
            roomId,
            content,
          );

          if (response?.event_id) {
            await this.cacheManager.set(alertCacheId, response.event_id, {
              ttl: 604_800, // 7 days ttl
            });
          }
        }
      }),
    );

    return { success: true };
  }
}
