import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatrixModule } from 'src/matrix/matrix.module';
import { UptimeController } from './uptime.controller';

@Module({
  imports: [
    ConfigModule,
    CacheModule.register(),
    MatrixModule.register({ envPrefix: 'UPTIME' }),
  ],
  controllers: [UptimeController],
  providers: [],
})
export class UptimeModule {}
