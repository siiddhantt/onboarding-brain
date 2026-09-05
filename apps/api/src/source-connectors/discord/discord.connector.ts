import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { SourceConnectorDescriptor, SourceLocation, SourceRecord } from '@app-starter/shared';
import type {
  SourceCollectionPage,
  SourceConnector,
  SourcePageOptions,
  SourceAccess,
} from '../source-connector.interface';
import { discordSearchPage, discordSearchParams } from './discord-search';
import { DiscordClient, discordObject as object } from './discord.client';
import { canReadDiscordChannel } from './discord-permissions';

const SNOWFLAKE = /^\d{17,20}$/;
const PAGE_SIZE = 100;
const CHANNEL_TYPES = new Set([0, 5, 10, 11]);
const THREAD_TYPES = new Set([10, 11]);

@Injectable()
export class DiscordConnector implements SourceConnector {
  readonly id = 'discord';
  constructor(private readonly client: DiscordClient) {}

  describe(): SourceConnectorDescriptor {
    return {
      id: this.id,
      name: 'Discord',
      search: { dateField: 'createdAt' },
      locatorLabel: 'Channel or public thread ID',
      locatorPlaceholder: 'Paste a channel ID or Discord channel link',
      emptyStateHint:
        'Check Message Content Intent and Read Message History. Bot messages and attachments are not imported.',
      isConfigured: true,
      credentialLabel: 'Bot token',
      connectionFields: [
        {
          key: 'guildId',
          label: 'Discord server ID',
          placeholder: 'Copy the server ID once from Discord',
        },
      ],
      canDiscoverLocations: true,
    };
  }

  async verify(access: SourceAccess) {
    const guildId = this.guildId(access);
    const user = object(await this.client.get(access.credential, '/users/@me'));
    if (user.bot !== true)
      throw new BadRequestException('Use a Discord bot token, not a user token.');
    const guild = object(await this.client.get(access.credential, `/guilds/${guildId}`));
    if (guild.id !== guildId || typeof guild.name !== 'string')
      throw new BadGatewayException('Discord returned an invalid server.');
    return {
      externalAccountId: guildId,
      accountName: guild.name.slice(0, 100),
      config: { guildId },
    };
  }

  async discoverLocations(access: SourceAccess): Promise<SourceLocation[]> {
    const guildId = this.guildId(access);
    const user = object(await this.client.get(access.credential, '/users/@me'));
    if (user.bot !== true || !SNOWFLAKE.test(String(user.id)))
      throw new BadGatewayException('Discord returned an invalid bot identity.');
    const guild = object(await this.client.get(access.credential, `/guilds/${guildId}`));
    if (guild.id !== guildId) throw new BadGatewayException('Discord returned an invalid server.');
    const member = object(
      await this.client.get(access.credential, `/guilds/${guildId}/members/${user.id}`),
    );
    const raw = await this.client.get(access.credential, `/guilds/${guildId}/channels`);
    if (!Array.isArray(raw) || raw.length > 1000)
      throw new BadGatewayException('Discord returned an invalid channel list.');
    return raw
      .map(object)
      .filter(
        (channel) =>
          [0, 5].includes(Number(channel.type)) &&
          channel.guild_id === guildId &&
          canReadDiscordChannel(guild, member, String(user.id), channel),
      )
      .map((channel) => this.location(channel, guildId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async resolveLocation(access: SourceAccess, locator: string): Promise<SourceLocation> {
    const guildId = this.guildId(access);
    const channel = await this.channel(access, locator);
    // Check actual read access when saving, not just existence in the server directory.
    await this.client.get(access.credential, `/channels/${channel.id}/messages?limit=1`);
    return this.location(channel, guildId);
  }

  private async channel(access: SourceAccess, locator: string) {
    const guildId = this.guildId(access);
    const channelId = this.channelId(locator, guildId);
    const channel = object(await this.client.get(access.credential, `/channels/${channelId}`));
    if (
      channel.id !== channelId ||
      channel.guild_id !== guildId ||
      !CHANNEL_TYPES.has(Number(channel.type))
    )
      throw new ForbiddenException(
        'Use a text channel or public thread in this connection’s server.',
      );
    return channel;
  }

  private location(channel: Record<string, unknown>, guildId: string): SourceLocation {
    if (!SNOWFLAKE.test(String(channel.id)) || typeof channel.name !== 'string')
      throw new BadGatewayException('Discord returned an invalid channel.');
    return {
      externalId: `${guildId}/${channel.id}`,
      name: `${THREAD_TYPES.has(Number(channel.type)) ? 'Thread' : 'Channel'}: ${channel.name.slice(0, 150)}`,
      url: `https://discord.com/channels/${guildId}/${channel.id}`,
      locator: String(channel.id),
    };
  }

  private guildId(access: SourceAccess): string {
    if (
      Object.keys(access.config).length !== 1 ||
      typeof access.config.guildId !== 'string' ||
      !SNOWFLAKE.test(access.config.guildId)
    )
      throw new BadRequestException(
        'Enter a valid Discord server ID. No other connection settings are supported.',
      );
    return access.config.guildId;
  }

  async readPage(
    access: SourceAccess,
    locator: string,
    options: SourcePageOptions = {},
  ): Promise<SourceCollectionPage> {
    const { cursor, query = {} } = options;
    const isSearch = Boolean(query.text || query.from || query.to);
    const guildId = this.guildId(access);
    const channelId = this.channelId(locator, guildId);
    if (cursor && !isSearch && !SNOWFLAKE.test(cursor))
      throw new BadRequestException('Invalid Discord cursor.');

    const channel = await this.channel(access, locator);
    const parentId = typeof channel.parent_id === 'string' ? channel.parent_id : null;
    const isThread = THREAD_TYPES.has(Number(channel.type));
    if (isThread && (!parentId || !SNOWFLAKE.test(parentId)))
      throw new BadGatewayException('Discord returned an invalid thread parent.');
    const get = (path: string, allowMissing = false) =>
      this.client.get(access.credential, path, allowMissing);

    const includeStarter =
      isThread && parentId && !cursor && !isSearch && (options.limit ?? PAGE_SIZE) > 1;
    const pageSize = Math.max(
      1,
      Math.min(PAGE_SIZE, options.limit ?? PAGE_SIZE) - (includeStarter ? 1 : 0),
    );
    let raw: unknown;
    let nextCursor: string | null;
    if (isSearch) {
      const { params, offset, limit } = discordSearchParams(channelId, options);
      const result = discordSearchPage(
        await get(`/guilds/${guildId}/messages/search?${params}`),
        offset,
        limit,
      );
      raw = result.messages;
      nextCursor = result.nextCursor;
    } else {
      raw = await get(
        `/channels/${channelId}/messages?limit=${pageSize}${cursor ? `&before=${cursor}` : ''}`,
      );
      nextCursor =
        Array.isArray(raw) && raw.length === pageSize && typeof raw.at(-1)?.id === 'string'
          ? String(raw.at(-1)!.id)
          : null;
    }
    if (!Array.isArray(raw) || raw.length > PAGE_SIZE)
      throw new BadGatewayException('Discord returned an unreadable message list.');
    const messages = raw.map(object);

    // A public thread's starter may live in its parent channel. It is offered for
    // selection, never silently added to the imported conversation.
    if (includeStarter) {
      const parent = object(await get(`/channels/${parentId}`));
      if (parent.type === 0 || parent.type === 5) {
        const starter = await get(`/channels/${parentId}/messages/${channelId}`, true);
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
        !(includeStarter ? [channelId, parentId] : [channelId]).includes(message.channel_id)
      ) {
        throw new BadGatewayException('Discord returned an invalid message identity.');
      }
      const timestamp = typeof message.timestamp === 'string' ? message.timestamp : '';
      const updatedAt =
        typeof message.edited_timestamp === 'string' ? message.edited_timestamp : timestamp;
      if (!Number.isFinite(Date.parse(timestamp)) || !Number.isFinite(Date.parse(updatedAt))) {
        throw new BadGatewayException('Discord returned an invalid message timestamp.');
      }
      if (
        (query.from && Date.parse(timestamp) < Date.parse(query.from)) ||
        (query.to && Date.parse(timestamp) >= Date.parse(query.to))
      )
        return [];
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
          createdAt: new Date(timestamp).toISOString(),
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
}
