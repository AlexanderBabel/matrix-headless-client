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
import showdown from 'showdown';
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

  private converter = new showdown.Converter();

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

    const message: MessageContent = {
      msgtype: 'm.text',
      body: data.message,
      format: 'org.matrix.custom.html',
      formatted_body: this.converter.makeHtml(data.message),
    };
    await this.matrixService.sendMessage(data.roomId, message);

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
    );

    const res = await Promise.all(
      events.map(async (e) => {
        const content = e.getContent() as MessageContent;
        if (content.formatted_body?.includes('<del>')) {
          return false;
        }

        const message: MessageContent = {
          msgtype: 'm.text',
          body: content.body,
          format: 'org.matrix.custom.html',
          formatted_body: `<del>${this.converter.makeHtml(content.body)}</del>${
            this.VARS.chore.completedPostfix
          }`,
        };

        await this.matrixService.editMessage(e.getRoomId(), e.getId(), message);
        return true;
      }),
    );

    const messageUpdateHappened = res.find((e) => e);
    if (!messageUpdateHappened && this.VARS.chore.completedFallbackMessage) {
      const message: MessageContent = {
        msgtype: 'm.text',
        body: this.VARS.chore.completedFallbackMessage,
        format: 'org.matrix.custom.html',
        formatted_body: this.converter.makeHtml(
          this.VARS.chore.completedFallbackMessage,
        ),
      };
      await this.matrixService.sendMessage(data.roomId, message);
    }

    return { success: true };
  }
}
