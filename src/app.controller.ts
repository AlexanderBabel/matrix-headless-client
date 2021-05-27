import { Controller, Param, Post } from '@nestjs/common';
import {
  MatrixService,
  MessageContent,
} from './matrix/matrix.service';

@Controller()
export class AppController {
  constructor(private readonly matrixService: MatrixService) {}

  @Post('/:id/send')
  async sendMessage(@Param('id') roomId: string) {
    const message: MessageContent = {
      msgtype: 'm.text',
      body: 'This is a test',
      format: 'org.matrix.custom.html',
      formatted_body: 'This is a <strong>test</strong>',
    };
    const res = await this.matrixService.sendMessage(roomId, message);
    console.log(res.event_id);

    message.body = 'Test1 - Done';
    message.formatted_body = '<del>Test1</del> - Done';

    await this.matrixService.editMessage(roomId, res.event_id, message);
  }
}
