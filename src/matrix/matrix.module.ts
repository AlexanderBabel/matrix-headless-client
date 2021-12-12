import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './crypto.service';
import { MatrixModuleOptions } from './matrix.module.options';
import { MatrixService } from './matrix.service';

@Module({})
export class MatrixModule {
  static register(options: MatrixModuleOptions): DynamicModule {
    return {
      module: MatrixModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'CONFIG_OPTIONS',
          useValue: {
            ...options,
            envPrefix: options.envPrefix ? `${options.envPrefix}_` : '',
          },
        },
        MatrixService,
        CryptoService,
      ],
      exports: [MatrixService],
    };
  }
}
