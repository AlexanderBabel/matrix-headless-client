import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import winston from 'winston';
import { AlertManagerModule } from './alertmanager/alertmanager.module';
import { AppController } from './app.controller';
import { config } from './config';
import { HealthCheckModule } from './health-check/health-check.module';
import { HomeAssistantModule } from './home-assistant/home-assistant.module';

@Module({
  imports: [
    ConfigModule.forRoot({ load: [config] }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          level: 'info',
          format: winston.format.cli(),
        }),
      ],
    }),
    HealthCheckModule,
    AlertManagerModule,
    HomeAssistantModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
