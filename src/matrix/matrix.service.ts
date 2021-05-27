import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MatrixClient,
  createClient,
  // @ts-ignore
  setCryptoStoreFactory,
  EventContentTypeMessage,
} from 'matrix-js-sdk';
import olm from 'olm';
import path from 'path';
import { LocalStorage } from 'node-localstorage';

// @ts-ignore
import { LocalStorageCryptoStore } from 'matrix-js-sdk/lib/crypto/store/localStorage-crypto-store';
// @ts-ignore
import { WebStorageSessionStore } from 'matrix-js-sdk/lib/store/session/webstorage';
// @ts-ignore
import { MemoryStore } from 'matrix-js-sdk/lib/store/memory';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MatrixModuleOptions } from './matrix.module.options';

global.Olm = olm;

type MessageResponse = { event_id: string };

export type MessageContent = {
  format?: 'org.matrix.custom.html';
  formatted_body?: string;
} & EventContentTypeMessage;

@Injectable()
export class MatrixService {
  private readonly MATRIX_HOMESERVER = this.configService.get<string>(
    `${this.options.envPrefix}MATRIX_HOMESERVER`,
  );

  private readonly MATRIX_ACCESS_TOKEN = this.configService.get<string>(
    `${this.options.envPrefix}MATRIX_ACCESS_TOKEN`,
  );

  private readonly MATRIX_USER = this.configService.get<string>(
    `${this.options.envPrefix}MATRIX_USER`,
  );

  private readonly MATRIX_DEVICE_ID = this.configService.get<string>(
    `${this.options.envPrefix}MATRIX_DEVICE_ID`,
  );

  private readonly client: MatrixClient | undefined;

  private readonly joinedRoomsCache: string[] = [];

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject('CONFIG_OPTIONS') private options: MatrixModuleOptions,
    private configService: ConfigService,
  ) {
    if (
      !this.MATRIX_ACCESS_TOKEN ||
      !this.MATRIX_HOMESERVER ||
      !this.MATRIX_USER ||
      !this.MATRIX_DEVICE_ID
    ) {
      this.logger.warn(
        `[MatrixService] ${this.options.envPrefix} - Skipping initialization because of missing env vars!`,
      );
      return;
    }

    const localStoragePath = path.resolve(
      path.join(
        __dirname,
        `${this.MATRIX_USER.replace('@', '').replace(':', '')}-${
          this.MATRIX_DEVICE_ID
        }.local`,
      ),
    );
    const localStorage = new LocalStorage(localStoragePath);

    setCryptoStoreFactory(() => new LocalStorageCryptoStore(localStorage));

    this.client = createClient({
      // @ts-ignore
      sessionStore: new WebStorageSessionStore(localStorage),
      store: new MemoryStore({ localStorage }),
      baseUrl: this.MATRIX_HOMESERVER,
      accessToken: this.MATRIX_ACCESS_TOKEN,
      userId: this.MATRIX_USER,
      deviceId: this.MATRIX_DEVICE_ID,
    });

    this.startClient();
  }

  public async sendMessage(
    roomId: string,
    content: MessageContent,
  ): Promise<MessageResponse> {
    await this.joinRoom(roomId);
    return new Promise((resolve) => {
      this.client?.sendMessage(roomId, content, undefined, (_error, data) =>
        resolve(data),
      );
    });
  }

  public async editMessage(
    roomId: string,
    eventId: string,
    content: MessageContent,
  ) {
    await this.joinRoom(roomId);
    return new Promise((resolve) => {
      this.client?.sendEvent(
        roomId,
        'm.room.message',
        {
          ...content,
          'm.new_content': content,
          'm.relates_to': {
            rel_type: 'm.replace',
            event_id: eventId,
          },
        },
        undefined,
        (_error, data) => resolve(data),
      );
    });
  }

  private async joinRoom(roomId: string) {
    if (!this.joinedRoomsCache.includes(roomId)) {
      try {
        const room = await this.client?.joinRoom(roomId);
        if (room) {
          this.joinedRoomsCache.push(roomId);
        }
      } catch (error) {
        this.logger.warn(`Could not join room ${roomId} - ${error}`);
      }
    }
  }

  private async startClient() {
    await this.client?.initCrypto();
    await this.client?.startClient();
  }

  // private async startVerification() {
  //   const rooms = await this.client?.getRooms();
  //   // rooms?.map(r => r.getJoinedMembers().map(m => m.get))
  //   // this.client?.getDevices();
  //   // this.client?.requestVerification();
  // }
}
