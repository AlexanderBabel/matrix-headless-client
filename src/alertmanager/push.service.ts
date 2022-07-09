import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';

export type PushAttachment = {
  content: string;
  contentType: string;
  name?: string;
  thumbnailSize?: number;
};

@Injectable()
export class PushService {
  private readonly httpClient?: AxiosInstance;

  private readonly logger = new Logger(PushService.name);

  private readonly PUSH_ENDPOINT =
    this.configService.get<string>('PUSH_ENDPOINT');

  constructor(private configService: ConfigService) {
    if (!this.PUSH_ENDPOINT) {
      throw new Error('Env variable PUSH_ENDPOINT is not defined.');
    }

    this.httpClient = axios.create({
      method: 'post',
      timeout: 10_000,
      baseURL: this.PUSH_ENDPOINT,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  public async sendPush(
    roomId: string,
    message: string,
    event_id?: string,
  ): Promise<AxiosResponse<{ event_id: string }> | void> {
    return this.httpClient
      ?.request<{ event_id: string }>({
        baseURL: this.PUSH_ENDPOINT,
        url: roomId,
        data: event_id
          ? {
              type: 'edit',
              message,
              identifier: `event_id.${event_id}`,
            }
          : { message },
      })
      .catch((error: AxiosError) =>
        this.logger.error(
          `Error occurred: ${error} - ${error.message} Data: ${JSON.stringify(
            error.response?.data,
          )}`,
        ),
      );
  }

  public async sendAttachment(
    roomId: string,
    attachment: PushAttachment,
  ): Promise<AxiosResponse<{ success: boolean }> | void> {
    return this.httpClient
      ?.request<{ success: boolean }>({
        baseURL: this.PUSH_ENDPOINT,
        url: roomId,
        data: attachment,
      })
      .catch((error: AxiosError) =>
        this.logger.error(
          `Error occurred: ${error} - ${error.message} Data: ${JSON.stringify(
            error.response?.data,
          )}`,
        ),
      );
  }
}
