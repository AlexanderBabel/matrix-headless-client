import { CacheModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MatrixModule } from 'src/matrix/matrix.module';
import { HomeAssistantController } from './home-assistant.controller';

@Module({
  imports: [ConfigModule, CacheModule.register(), MatrixModule.register({ envPrefix: 'HOME_ASSISTANT'})],
  controllers: [HomeAssistantController],
  providers: [],
})
export class HomeAssistantModule {}
