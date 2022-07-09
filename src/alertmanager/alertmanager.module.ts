import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertService } from './alert.service';
import { AlertManagerController } from './alertmanager.controller';
import { PushService } from './push.service';

@Module({
  imports: [ConfigModule, CacheModule.register()],
  controllers: [AlertManagerController],
  providers: [AlertService, PushService],
})
export class AlertManagerModule {}
