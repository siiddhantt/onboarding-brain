import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SourceConnectorDescriptor, SourceRecord } from '@app-starter/shared';
import type { SourceCollectionPage, SourceConnector } from '../source-connector.interface';

const SNOWFLAKE = /^\d{17,20}$/;
const PAGE_SIZE = 100;
const CHANNEL_TYPES = new Set([0, 5, 10, 11]);
const THREAD_TYPES = new Set([10, 11]);

const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadGatewayException('Discord returned an unreadable response.');
  }
  return value as Record<string, unknown>;
};

@Injectable()
export class DiscordConnector implements SourceConnector {
  readonly id = 'discord';
  private retryAt = 0;

  constructor(private readonly config: ConfigService) {}

  describe(organizationId: string): SourceConnectorDescriptor {
    return {
      id: this.id,
      name: 'Discord',
      locatorLabel: 'Channel or public thread ID',
      locatorPlaceholder: 'Paste a channel ID or Discord channel link',
      emptyStateHint:
        'Check Message Content Intent and Read Message History. Bot messages and attachments are not imported.',
      isConfigured: Boolean(
        this.config.get<string>('DISCORD_BOT_TOKEN') &&
        SNOWFLAKE.test(this.config.get<string>('DISCORD_GUILD_ID') ?? '') &&
        this.allowedChannels().length &&
        this.config.get<string>('DISCORD_ORGANIZATION_ID') === organizationId,
      ),
    };
  }

  async readPage(
    organizationId: string,
    locator: string,
    cursor?: string,
  ): Promise<SourceCollectionPage> {
    if (!this.describe(organizationId).isConfigured) {
      throw new ServiceUnavailableException('Discord is not configured for this organization.');
    }
    const guildId = this.config.get<string>('DISCORD_GUILD_ID')!;
    const channelId = this.channelId(locator, guildId);
    if (cursor && !SNOWFLAKE.test(cursor)) throw new BadRequestException('Invalid Discord cursor.');

    const channel = object(await this.get(`/channels/${channelId}`));
    const parentId = typeof channel.parent_id === 'string' ? channel.parent_id : null;
    if (channel.guild_id !== guildId || !CHANNEL_TYPES.has(Number(channel.type))) {
      throw new ForbiddenException('Use a text channel or public thread in the configured server.');
    }
    const isThread = THREAD_TYPES.has(Number(channel.type));
    if (
      !this.allowedChannels().includes(channelId) &&
      !(isThread && parentId && this.allowedChannels().includes(parentId))
    ) {
      throw new ForbiddenException('This channel is not in the organization’s import allowlist.');
    }

    const raw = await this.get(
      `/channels/${channelId}/messages?limit=${PAGE_SIZE}${cursor ? `&before=${cursor}` : ''}`,
    );
    if (!Array.isArray(raw) || raw.length > PAGE_SIZE)
      throw new BadGatewayException('Discord returned an unreadable message list.');
    const messages = raw.map(object);
    const nextCursor =
      messages.length === PAGE_SIZE && typeof messages.at(-1)?.id === 'string'
        ? String(messages.at(-1)!.id)
        : null;

    // A public thread's starter may live in its parent channel. It is offered for
    // selection, never silently added to the imported conversation.
    if (isThread && parentId && !cursor) {
      const parent = object(await this.get(`/channels/${parentId}`));
      if (parent.type === 0 || parent.type === 5) {
        const starter = await this.get(`/channels/${parentId}/messages/${channelId}`, true);
        if (starter) messages.push(object(starter));
      }
    }

    const items = messages.flatMap((message): SourceRecord[] => {
      const author = object(message.author ?? {});
      if (author.bot || message.webhook_id || ![0, 19].includes(Number(message.type))) return [];
      if (typeof message.content !== 'string' || !message.content.trim()) return [];
      if (
        typeof message.id !== 'string' ||
        !SNOWFLAKE.test(message.id) ||
        typeof message.channel_id !== 'string' ||
        !SNOWFLAKE.test(message.channel_id) ||
        ![channelId, parentId].includes(message.channel_id)
      ) {
        throw new BadGatewayException('Discord returned an invalid message identity.');
      }
      const timestamp = typeof message.timestamp === 'string' ? message.timestamp : '';
      const updatedAt =
        typeof message.edited_timestamp === 'string' ? message.edited_timestamp : timestamp;
      if (!Number.isFinite(Date.parse(timestamp)) || !Number.isFinite(Date.parse(updatedAt))) {
        throw new BadGatewayException('Discord returned an invalid message timestamp.');
      }
      const authorName = String(author.global_name || author.username || 'Unknown author').slice(
        0,
        100,
      );
      return [
        {
          id: message.id,
          title: `${authorName} · ${new Date(timestamp).toISOString()}`,
          text: message.content.trim(),
          url: `https://discord.com/channels/${guildId}/${message.channel_id}/${message.id}`,
          updatedAt: new Date(updatedAt).toISOString(),
        },
      ];
    });

    return {
      externalId: `${guildId}/${channelId}`,
      name: `${isThread ? 'Thread' : 'Channel'}: ${String(channel.name ?? 'Discord').slice(0, 150)}`,
      url: `https://discord.com/channels/${guildId}/${channelId}`,
      items: [...new Map(items.map((item) => [item.id, item])).values()].reverse(),
      nextCursor,
    };
  }

  private allowedChannels(): string[] {
    return (this.config.get<string>('DISCORD_CHANNEL_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => SNOWFLAKE.test(id));
  }

  private channelId(locator: string, guildId: string): string {
    if (SNOWFLAKE.test(locator)) return locator;
    const match =
      /^https:\/\/discord\.com\/channels\/(\d{17,20})\/(\d{17,20})(?:\/\d{17,20})?\/?$/.exec(
        locator,
      );
    if (!match || match[1] !== guildId)
      throw new BadRequestException(
        'Enter a channel ID or link from the configured Discord server.',
      );
    return match[2];
  }

  private async get(path: string, allowMissing = false): Promise<unknown> {
    if (Date.now() < this.retryAt) this.rateLimited();
    try {
      const response = await fetch(`https://discord.com/api/v10${path}`, {
        headers: { Authorization: `Bot ${this.config.get<string>('DISCORD_BOT_TOKEN')}` },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      if (response.status === 429) {
        const body = object(await response.json());
        const delay = Number(response.headers.get('retry-after') ?? body.retry_after);
        this.retryAt = Date.now() + (Number.isFinite(delay) && delay > 0 ? delay : 5) * 1000;
        this.rateLimited();
      }
      if (response.status === 401 || response.status === 403)
        throw new ForbiddenException(
          'Check the Discord bot token, View Channels and Read Message History permissions.',
        );
      if (response.status === 404) {
        if (allowMissing) return null;
        throw new NotFoundException('Discord channel not found or not accessible to the bot.');
      }
      if (!response.ok)
        throw new ServiceUnavailableException('Discord is unavailable. Try again later.');
      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Could not read Discord. Check the connection and try again.',
      );
    }
  }

  private rateLimited(): never {
    const retryAfter = Math.max(1, Math.ceil((this.retryAt - Date.now()) / 1000));
    throw new HttpException(
      { message: `Discord rate limit reached. Try again in ${retryAfter} seconds.`, retryAfter },
      429,
    );
  }
}
