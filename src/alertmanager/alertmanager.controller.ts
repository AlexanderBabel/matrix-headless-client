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
import { AlertService } from './alert.service';
import { WebhookDto } from './dtos/webhook.dto';
import { PushService } from './push.service';

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
    private pushService: PushService,
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

        if (eventId) {
          // edit previous message
          await this.pushService.sendPush(roomId, message, eventId);

          // only delete cache entry if the alert has been resolved
          // an alert could be fired multiple times (e.g. it will be send a second time after 6 hours by default)
          if (alert.status === 'resolved') {
            await this.cacheManager.del(alertCacheId);
          }
          return;
        }

        const response = await this.pushService.sendPush(roomId, message);
        if (response?.data?.event_id) {
          await this.cacheManager.set(alertCacheId, response.data.event_id, {
            ttl: 604_800, // 7 days ttl
          });
        }
      }),
    );

    return { success: true };
  }
}
