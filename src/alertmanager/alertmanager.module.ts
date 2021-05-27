import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatrixModule } from 'src/matrix/matrix.module';
import { AlertService } from './alert.service';
import { AlertManagerController } from './alertmanager.controller';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register(),
    MatrixModule.register({ envPrefix: 'ALERTMANAGER' }),
  ],
  controllers: [AlertManagerController],
  providers: [AlertService],
})
export class AlertManagerModule {}
