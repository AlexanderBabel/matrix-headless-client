import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MatrixClient,
  createClient,
  setCryptoStoreFactory,
  IContent,
  MatrixEvent,
  RoomEvent,
} from 'matrix-js-sdk';
import olm from '@matrix-org/olm';
import path from 'node:path';
import { LocalStorage } from 'node-localstorage';
import showdown from 'showdown';
import sharp from 'sharp';
import { encode } from 'blurhash';

import { LocalStorageCryptoStore } from 'matrix-js-sdk/lib/crypto/store/localStorage-crypto-store';
// @ts-ignore
import { WebStorageSessionStore } from 'matrix-js-sdk/lib/store/session/webstorage';
import { MemoryStore } from 'matrix-js-sdk/lib/store/memory';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { MatrixModuleOptions } from './matrix.module.options';
import { CryptoService } from './crypto.service';

global.Olm = olm;

type MessageResponse = { event_id: string };

export type MessageContent = {
  format?: 'org.matrix.custom.html';
  formatted_body?: string;
} & IContent;

export type ReplaceEvent = {
  'm.new_content'?: MessageContent;
  'm.relates_to'?: {
    rel_type: 'm.replace';
    event_id: string;
  };
} & MessageContent;

@Injectable()
export class MatrixService {
  private readonly THUMBNAIL_WIDTH = 256;

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

  private readonly MATRIX_REACTION_EDIT_ROOMS = this.configService.get<string>(
    `${this.options.envPrefix}MATRIX_REACTION_EDIT_ROOMS`,
  );

  private readonly MATRIX_REACTION_EDIT_POSTFIX =
    this.configService.get<string>(
      `${this.options.envPrefix}MATRIX_REACTION_EDIT_POSTFIX`,
    );

  private readonly MATRIX_PERSISTENCE = this.configService.get<string>(
    `${this.options.envPrefix}MATRIX_PERSISTENCE`,
  );

  private readonly client: MatrixClient | undefined;

  private readonly joinedRoomsCache: string[] = [];

  private converter = new showdown.Converter();

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    @Inject('CONFIG_OPTIONS') private options: MatrixModuleOptions,
    private configService: ConfigService,
    private cryptoService: CryptoService,
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
        // eslint-disable-next-line unicorn/prefer-module
        this.MATRIX_PERSISTENCE || __dirname,
        `${this.MATRIX_USER.replace('@', '').replace(':', '')}-${
          this.MATRIX_DEVICE_ID
        }.local`,
      ),
    );
    const localStorage = new LocalStorage(localStoragePath);

    setCryptoStoreFactory(() => new LocalStorageCryptoStore(localStorage));

    this.client = createClient({
      sessionStore: new WebStorageSessionStore(localStorage),
      // @ts-ignore
      store: new MemoryStore({ localStorage }),
      baseUrl: this.MATRIX_HOMESERVER,
      accessToken: this.MATRIX_ACCESS_TOKEN,
      userId: this.MATRIX_USER,
      deviceId: this.MATRIX_DEVICE_ID,
    });

    this.startClient();
    this.enableReactionEdits();
  }

  public async sendReaction(
    roomId: string,
    eventId: string,
    emoji: string,
  ): Promise<MessageResponse> {
    return new Promise((resolve) => {
      this.client?.sendEvent(
        roomId,
        'm.reaction',
        {
          'm.relates_to': {
            rel_type: 'm.annotation',
            event_id: eventId,
            key: emoji,
          },
        },
        undefined,
        (_error, data) => resolve(data),
      );
    });
  }

  private async uploadEncryptedImage(
    image: Buffer,
    contentType: string,
    newWidth?: number,
    newHeight?: number,
  ) {
    const { data, info } = await (newWidth && newHeight
      ? sharp(image).resize(newWidth, newHeight)
      : sharp(image)
    )
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });
    const { height, width, size } = info;
    const encryptedImage = await this.cryptoService.encryptAttachment(image);
    const imageUpload = <{ content_uri: string }>(
      ((await this.client?.uploadContent(Buffer.from(encryptedImage.data), {
        rawResponse: false,
        type: contentType,
      })) as unknown)
    );

    if (!imageUpload || !imageUpload.content_uri) {
      return false;
    }

    return {
      file: {
        ...encryptedImage.info,
        url: imageUpload.content_uri,
        mimetype: contentType,
      },
      info: {
        size,
        mimetype: contentType,
        w: width,
        h: height,
        'xyz.amorgan.blurhash': encode(
          new Uint8ClampedArray(data),
          width,
          height,
          4,
          4,
        ),
      },
    };
  }

  public async sendImage(
    roomId: string,
    image: Buffer,
    contentType: string,
    name?: string,
  ) {
    const uploadedImage = await this.uploadEncryptedImage(image, contentType);
    if (!uploadedImage) {
      return false;
    }

    const factor = uploadedImage.info.w / this.THUMBNAIL_WIDTH;
    const newWidth =
      factor > 0
        ? Math.ceil(uploadedImage.info.w / factor)
        : uploadedImage.info.w;
    const newHeight =
      factor > 0
        ? Math.ceil(uploadedImage.info.h / factor)
        : uploadedImage.info.h;

    const uploadedThumbnail = await this.uploadEncryptedImage(
      image,
      contentType,
      newWidth,
      newHeight,
    );
    if (!uploadedThumbnail) {
      return false;
    }

    return this.client?.sendMessage(roomId, {
      body: name ?? '',
      info: {
        ...uploadedImage.info,
        thumbnail_info: uploadedThumbnail.info,
        thumbnail_file: uploadedThumbnail.file,
      },
      msgtype: 'm.image',
      file: uploadedImage.file,
    });
  }

  public sendMessage(roomId: string, message: string, htmlMessage?: string) {
    return this.sendMessageContent(roomId, {
      msgtype: 'm.text',
      body: message,
      format: 'org.matrix.custom.html',
      formatted_body: this.converter.makeHtml(htmlMessage ?? message),
    });
  }

  public async sendMessageContent(
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

  public editMessage(
    roomId: string,
    eventId: string,
    message: string,
    htmlMessage?: string,
  ) {
    return this.editMessageContent(roomId, eventId, {
      msgtype: 'm.text',
      body: message,
      format: 'org.matrix.custom.html',
      formatted_body: this.converter.makeHtml(htmlMessage ?? message),
    });
  }

  public async editMessageContent(
    roomId: string,
    eventId: string,
    content: MessageContent,
  ): Promise<MessageResponse> {
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

  public async searchText(
    roomId: string,
    query: string,
    ignoreMessagesWithReplacements = false,
    limit = 100,
  ) {
    const room = await this.client?.getRoom(roomId);
    if (!room) {
      return [];
    }

    const scrollbackRoom = await this.client?.scrollback(room, limit);
    if (!scrollbackRoom) {
      return [];
    }

    const replacementEvents = ignoreMessagesWithReplacements
      ? scrollbackRoom.timeline.filter((e) => {
          const relTo = (e.getContent() as ReplaceEvent)['m.relates_to'];
          if (!relTo) {
            return false;
          }

          return relTo.rel_type === 'm.replace';
        })
      : [];

    const ignoredEventIds = ignoreMessagesWithReplacements
      ? ([
          ...(replacementEvents?.map(
            (e) => (e.getContent() as ReplaceEvent)['m.relates_to']?.event_id,
          ) ?? []),
          ...(replacementEvents?.map((e) => e.getId()) ?? []),
        ] as string[])
      : [];

    return (
      scrollbackRoom.timeline.filter(
        (e) =>
          e.getType() === 'm.room.message' &&
          e.getContent().msgtype === 'm.text' &&
          e.getContent().body.includes(query) &&
          (!ignoreMessagesWithReplacements ||
            !ignoredEventIds.includes(e.getId())),
      ) ?? []
    );
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
    await this.client?.startClient({});
    this.client?.setGlobalErrorOnUnknownDevices(false);
    this.markAllDevicesAsVerified();
  }

  private enableReactionEdits() {
    if (
      !this.MATRIX_REACTION_EDIT_ROOMS ||
      !this.MATRIX_REACTION_EDIT_POSTFIX
    ) {
      return;
    }

    const postfix = this.MATRIX_REACTION_EDIT_POSTFIX;
    this.MATRIX_REACTION_EDIT_ROOMS?.split(',').map((roomId) => {
      this.client?.on(RoomEvent.Timeline, async (event: MatrixEvent) => {
        const relation = event.getRelation();
        const eventRoomId = event.getRoomId();
        if (
          eventRoomId !== roomId ||
          event.getType() !== 'm.reaction' ||
          !relation
        ) {
          return;
        }

        const { event_id: eventId, key: emoji } = relation;
        if (!eventId || emoji !== '???') {
          return;
        }

        const message = new MatrixEvent(
          await this.client?.fetchRoomEvent(eventRoomId, eventId),
        );
        if (this.client?.crypto) {
          await message.attemptDecryption(this.client.crypto);
        }
        const content = message.getContent();

        if (
          !message ||
          !content ||
          content.msgtype !== 'm.text' ||
          content.formatted_body?.includes('<del>') ||
          content.body.includes(postfix)
        ) {
          return;
        }

        await this.editMessage(
          eventRoomId,
          eventId,
          `${content.body}${postfix}`,
          `<del>${content.body}</del>${postfix}`,
        );
      });

      return true;
    });
  }

  private markAllDevicesAsVerified() {
    setTimeout(async () => {
      const rooms = this.client?.getRooms();

      if (!rooms) {
        return;
      }

      await Promise.all(
        rooms.map(async (room) => {
          const targetMembers = await room.getEncryptionTargetMembers();
          const members = targetMembers.map((x) => x.userId);
          const memberKeys = await this.client?.downloadKeys(members, false);
          if (!memberKeys) {
            return;
          }

          await Promise.all(
            Object.keys(memberKeys).map((userId) =>
              Promise.all(
                Object.keys(memberKeys[userId]).map((deviceId) =>
                  this.client?.setDeviceVerified(userId, deviceId),
                ),
              ),
            ),
          );
        }),
      );
    }, 5000);
  }
}
