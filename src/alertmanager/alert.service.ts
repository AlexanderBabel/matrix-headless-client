import { Inject, Injectable, Logger } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { ConfigService } from '@nestjs/config';
import { WebhookAlert } from './dtos/webhook.alert.dto';

@Injectable()
export class AlertService {
  private ALERTMANAGER_MENTION_ROOM = this.configService.get<boolean>(
    'ALERTMANAGER_MENTION_ROOM',
  );

  private ALERTMANAGER_MATRIX_ROOMS = this.configService.get<string>(
    'ALERTMANAGER_MATRIX_ROOMS',
  );

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private configService: ConfigService,
  ) {
    if (!this.ALERTMANAGER_MATRIX_ROOMS) {
      this.logger.warn(
        '[AlertService] No matrix rooms defined. Disabling AlertManager module!',
      );
    }
  }

  public formatAlert(data: WebhookAlert) {
    const parts = [];

    switch (data.status) {
      case 'firing': {
        if (this.ALERTMANAGER_MENTION_ROOM) {
          parts.push('@room <br>');
        }

        const color = this.getColor(data.labels.severity);
        parts.push(this.getPrefix(color, 'FIRING'));
        break;
      }

      case 'resolved': {
        parts.push(this.getPrefix('#33cc33', 'RESOLVED'), '<del>');
        break;
      }

      default: {
        parts.push(`${data.status.toUpperCase()}:`);
        break;
      }
    }

    // name and location of occurrence
    if (data.labels.alertname) {
      parts.push(`<i>${data.labels.alertname}</i>`);

      if (data.labels.host || data.labels.instance) {
        parts.push(' at ');
      }
    }

    if (data.labels.host) {
      parts.push(data.labels.host);
    } else if (data.labels.instance) {
      parts.push(data.labels.instance);
    }

    // additional descriptive content
    if (data.annotations.message) {
      parts.push(`<br>${data.annotations.message.replace('\n', '<br>')}`);
    }

    if (data.annotations.description) {
      parts.push(`<br>${data.annotations.description}`);
    }

    parts.push(`<br><a href="${data.generatorURL}">Alert link</a>`);

    if (data.status === 'resolved') {
      parts.push('</del>');
    }

    return parts.join(' ');
  }

  public getRoom(receiver: string): string | undefined {
    if (!this.ALERTMANAGER_MATRIX_ROOMS) {
      return undefined;
    }

    const room = this.ALERTMANAGER_MATRIX_ROOMS.split('|').find((r) =>
      r.startsWith(`${receiver}/`),
    );
    if (!room) {
      return undefined;
    }

    return room.split('/')[1];
  }

  private getColor(severity: string) {
    switch (severity) {
      case 'warning':
        return '#ffc107'; // orange
      case 'none':
      case 'info':
        return '#17a2b8'; // blue
      default:
        return '#dc3545'; // red
    }
  }

  private getPrefix(color: string, text: string) {
    return `<strong><font color="${color}">${text}:</font></strong>`;
  }
}
