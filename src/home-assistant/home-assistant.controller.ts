import {
  Body,
  Controller,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

import { MatrixService, MessageContent } from 'src/matrix/matrix.service';
import { ChoreCompleteDto } from './dtos/chore.complete.dto';
import { NotificationDto } from './dtos/notification.dto';

@Controller('ha')
export class HomeAssistantController {
  private readonly VARS = {
    secret: this.configService.get<string>('HOME_ASSISTANT_SECRET'),
    chore: {
      searchPrefix: this.configService.get<string>(
        'HOME_ASSISTANT_CHORE_SEARCH_PREFIX',
      ),
      completedPostfix: this.configService.get<string>(
        'HOME_ASSISTANT_CHORE_COMPLETED_POSTFIX',
      ),
      completedFallbackMessage: this.configService.get<string>(
        'HOME_ASSISTANT_CHORE_COMPLETED_FALLBACK_MESSAGE',
      ),
    },
  };

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private configService: ConfigService,
    private matrixService: MatrixService,
  ) {}

  @Post('/notify')
  async notify(
    @Body(new ValidationPipe()) data: NotificationDto,
    @Query('secret') secret: string,
  ) {
    if (!secret || this.VARS.secret !== secret) {
      throw new UnauthorizedException();
    }

    if (data.attachment) {
      await this.matrixService.sendImage(
        data.roomId,
        Buffer.from(data.attachment.content, 'base64'),
        data.attachment.contentType,
        data.attachment.name,
      );
    }

    await this.matrixService.sendMessage(data.roomId, data.message);
    return { success: true };
  }

  @Post('/chore/complete')
  async choreComplete(
    @Body(new ValidationPipe()) data: ChoreCompleteDto,
    @Query('secret') secret: string,
  ) {
    if (!secret || this.VARS.secret !== secret) {
      throw new UnauthorizedException();
    }

    const events = await this.matrixService.searchText(
      data.roomId,
      `${this.VARS.chore.searchPrefix}${data.choreId}`,
      true,
    );

    const res = await Promise.all(
      events.map(async (e) => {
        const content = e.getContent() as MessageContent;
        const roomId = e.getRoomId();
        if (!roomId || content.formatted_body?.includes('<del>')) {
          return false;
        }

        const shortBody = content.body.split('\n')[0];
        await this.matrixService.editMessage(
          roomId,
          e.getId(),
          `${shortBody}${this.VARS.chore.completedPostfix}`,
          `<del>${shortBody}</del>${this.VARS.chore.completedPostfix}`,
        );
        return true;
      }),
    );

    const messageUpdateHappened = res.find((e) => !!e);
    if (!messageUpdateHappened && this.VARS.chore.completedFallbackMessage) {
      await this.matrixService.sendMessage(
        data.roomId,
        this.VARS.chore.completedFallbackMessage,
      );
    }

    return { success: true };
  }

  @Post('/complete')
  async complete(
    @Body(new ValidationPipe()) data: NotificationDto,
    @Query('secret') secret: string,
  ) {
    if (!secret || this.VARS.secret !== secret) {
      throw new UnauthorizedException();
    }

    const events = await this.matrixService.searchText(
      data.roomId,
      data.message,
      true,
    );

    await Promise.all(
      events.map(async (e) => {
        const roomId = e.getRoomId();
        if (!roomId) {
          return undefined;
        }

        return this.matrixService.sendReaction(roomId, e.getId(), '???');
      }),
    );

    return { success: true };
  }
}
