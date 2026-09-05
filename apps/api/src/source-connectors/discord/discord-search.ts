import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { SourcePageOptions } from '../source-connector.interface';

const DISCORD_EPOCH = 1420070400000;

const snowflakeAt = (instant: string): bigint =>
  BigInt(Math.max(0, Date.parse(instant) - DISCORD_EPOCH)) << 22n;

export const discordSearchParams = (channelId: string, options: SourcePageOptions) => {
  const { cursor, query = {} } = options;
  if (cursor && !/^search:\d{1,4}$/.test(cursor))
    throw new BadRequestException('Invalid Discord search cursor.');
  const offset = cursor ? Number(cursor.slice(7)) : 0;
  if (offset > 9975) throw new BadRequestException('Discord search limit reached.');
  const limit = Math.min(25, options.limit ?? 25);
  const params = new URLSearchParams({
    channel_id: channelId,
    author_type: 'user',
    sort_by: 'timestamp',
    sort_order: 'desc',
    limit: String(limit),
    offset: String(offset),
  });
  if (query.text) params.set('content', query.text);
  if (query.from)
    params.set('min_id', String(snowflakeAt(query.from) > 0n ? snowflakeAt(query.from) - 1n : 0n));
  if (query.to) params.set('max_id', String(snowflakeAt(query.to)));
  return { params, offset, limit };
};

export const discordSearchPage = (raw: unknown, offset: number, limit: number) => {
  const result = raw as {
    messages?: unknown[][];
    total_results?: number;
    doing_deep_historical_index?: boolean;
  } | null;
  if (
    !result ||
    !Array.isArray(result.messages) ||
    !result.messages.every(Array.isArray) ||
    !Number.isInteger(result.total_results) ||
    result.total_results! < 0
  )
    throw new BadGatewayException('Discord returned an unreadable search result.');
  // Search can return fewer matches than requested while its index catches up.
  // Advance by the requested window, not the number of normalized human messages.
  const nextOffset = offset + limit;
  return {
    messages: result.messages.flat(),
    nextCursor:
      nextOffset <= 9975 &&
      (nextOffset < result.total_results! || result.doing_deep_historical_index)
        ? `search:${nextOffset}`
        : null,
  };
};
