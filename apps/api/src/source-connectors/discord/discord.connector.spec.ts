import { DiscordClient } from './discord.client';
import { DiscordConnector } from './discord.connector';

describe('DiscordConnector', () => {
  const guildId = '100000000000000001';
  const channelId = '100000000000000002';
  const threadId = '100000000000000003';
  const access = { config: { guildId }, credential: 'test-bot-token' };
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let connector: DiscordConnector;

  const response = (body: unknown, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    json: async () => body,
  });
  const message = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    channel_id: channelId,
    type: 0,
    content: 'Submit expenses within 30 days.',
    author: { username: 'Maya' },
    timestamp: '2026-09-05T00:00:00.000Z',
    ...overrides,
  });

  beforeEach(() => {
    connector = new DiscordConnector(new DiscordClient());
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalizes human text and original links without importing bot chatter or attachments', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({ id: channelId, guild_id: guildId, type: 0, name: 'onboarding' }),
      )
      .mockResolvedValueOnce(
        response([
          message('100000000000000011'),
          message('100000000000000012', { author: { bot: true }, content: 'Automated message' }),
          message('100000000000000013', { content: '', attachments: [{ filename: 'file.pdf' }] }),
        ]),
      );
    const result = await connector.readPage(access, channelId);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: '100000000000000011',
        text: 'Submit expenses within 30 days.',
        url: `https://discord.com/channels/${guildId}/${channelId}/100000000000000011`,
      }),
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bot test-bot-token' },
      redirect: 'error',
    });
  });

  it('offers a public thread starter for explicit selection', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          id: threadId,
          guild_id: guildId,
          type: 11,
          parent_id: channelId,
          name: 'Expenses',
        }),
      )
      .mockResolvedValueOnce(response([message('100000000000000014', { channel_id: threadId })]))
      .mockResolvedValueOnce(response({ type: 0 }))
      .mockResolvedValueOnce(
        response(message(threadId, { content: 'How do expense reports work?' })),
      );
    const result = await connector.readPage(
      access,
      `https://discord.com/channels/${guildId}/${threadId}`,
    );
    expect(result.externalId).toBe(`${guildId}/${threadId}`);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].text).toBe('How do expense reports work?');
  });

  it('rejects invalid configuration and arbitrary URLs before making a request', async () => {
    await expect(
      connector.readPage({ ...access, config: { guildId: 'invalid' } }, channelId),
    ).rejects.toThrow('server ID');
    await expect(connector.readPage(access, 'https://localhost/secrets')).rejects.toThrow(
      'channel ID',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch private threads or channels from a different server', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ id: threadId, guild_id: guildId, type: 12 }))
      .mockResolvedValueOnce(response({ id: channelId, guild_id: 'another-server', type: 0 }));
    await expect(connector.readPage(access, threadId)).rejects.toThrow('public thread');
    await expect(connector.readPage(access, channelId)).rejects.toThrow('connection’s server');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('respects Discord retry-after instead of issuing repeated requests', async () => {
    fetchMock.mockResolvedValueOnce(response({ retry_after: 20 }, 429));
    await expect(connector.readPage(access, channelId)).rejects.toThrow('rate limit');
    await expect(connector.readPage(access, channelId)).rejects.toThrow('rate limit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(response({}, 403));
    await expect(
      connector.readPage({ ...access, credential: 'another-bot' }, channelId),
    ).rejects.toThrow('permissions');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('validates bot access and normalizes only supported non-secret configuration', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ bot: true }))
      .mockResolvedValueOnce(response({ id: guildId, name: 'Team server' }));
    await expect(connector.verify(access)).resolves.toEqual({
      externalAccountId: guildId,
      accountName: 'Team server',
      config: { guildId },
    });
    await expect(
      connector.verify({ ...access, config: { guildId, token: 'must-not-be-config' } }),
    ).rejects.toThrow('No other connection settings');
    fetchMock.mockResolvedValueOnce(response({ bot: false }));
    await expect(connector.verify(access)).rejects.toThrow('not a user token');
  });

  it('lists readable channels by name and checks history access before saving one', async () => {
    const botId = '100000000000000099';
    const readable = {
      id: channelId,
      guild_id: guildId,
      type: 0,
      name: 'onboarding',
      permission_overwrites: [],
    };
    fetchMock
      .mockResolvedValueOnce(response({ id: botId, bot: true }))
      .mockResolvedValueOnce(
        response({
          id: guildId,
          roles: [{ id: guildId, permissions: String((1n << 10n) | (1n << 16n)) }],
        }),
      )
      .mockResolvedValueOnce(response({ roles: [] }))
      .mockResolvedValueOnce(
        response([
          readable,
          {
            ...readable,
            id: threadId,
            permission_overwrites: [{ id: botId, type: 1, deny: String(1n << 10n), allow: '0' }],
          },
        ]),
      );
    await expect(connector.discoverLocations(access)).resolves.toEqual([
      {
        externalId: `${guildId}/${channelId}`,
        locator: channelId,
        name: 'Channel: onboarding',
        url: `https://discord.com/channels/${guildId}/${channelId}`,
      },
    ]);
    fetchMock.mockResolvedValueOnce(response(readable)).mockResolvedValueOnce(response({}, 403));
    await expect(connector.resolveLocation(access, channelId)).rejects.toThrow('permissions');
  });

  it('keeps upstream errors and credentials out of error responses', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Authorization: Bot test-bot-token'));
    await expect(connector.readPage(access, channelId)).rejects.toThrow('Could not read Discord');
  });

  it('loads only one bounded page at a time and advances past pages with no readable human text', async () => {
    const channel = response({ id: channelId, guild_id: guildId, type: 0 });
    const raw = Array.from({ length: 100 }, (_, index) =>
      message(String(100000000000000200n - BigInt(index)), { author: { bot: true } }),
    );
    fetchMock.mockResolvedValueOnce(channel).mockResolvedValueOnce(response(raw));
    const first = await connector.readPage(access, channelId);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first.items).toEqual([]);
    expect(first.nextCursor).toBe(raw[99].id);
    fetchMock
      .mockResolvedValueOnce(channel)
      .mockResolvedValueOnce(response([message('100000000000000011')]));
    const next = await connector.readPage(access, channelId, {
      cursor: first.nextCursor!,
      limit: 20,
    });
    expect(fetchMock.mock.calls[3][0]).toContain(`limit=20&before=${raw[99].id}`);
    expect(next.items).toHaveLength(1);
    expect(next.nextCursor).toBeNull();
  });

  it('maps native search and dates inside the approved collection and paginates partial results', async () => {
    const channel = response({ id: channelId, guild_id: guildId, type: 0 });
    fetchMock.mockResolvedValueOnce(channel).mockResolvedValueOnce(
      response({
        messages: [[message('100000000000000011')]],
        total_results: 60,
      }),
    );
    const query = { text: 'Juniper', from: '2026-09-05T00:00:00Z', to: '2026-09-06T00:00:00Z' };
    const first = await connector.readPage(access, channelId, { query });
    const url = new URL(fetchMock.mock.calls[1][0]);
    expect(url.pathname).toBe(`/api/v10/guilds/${guildId}/messages/search`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      channel_id: channelId,
      content: 'Juniper',
      offset: '0',
      limit: '25',
    });
    expect(BigInt(url.searchParams.get('min_id')!)).toBe(
      (BigInt(Date.parse(query.from) - 1420070400000) << 22n) - 1n,
    );
    expect(first.items[0].createdAt).toBe('2026-09-05T00:00:00.000Z');
    expect(first.nextCursor).toBe('search:25');
    fetchMock
      .mockResolvedValueOnce(channel)
      .mockResolvedValueOnce(response({ messages: [], total_results: 60 }));
    const next = await connector.readPage(access, channelId, { query, cursor: first.nextCursor! });
    expect(fetchMock.mock.calls[3][0]).toContain('offset=25');
    expect(next.nextCursor).toBe('search:50');
  });

  it('does not interpret an unready search index as no results or accept cross-channel search content', async () => {
    const channel = response({ id: channelId, guild_id: guildId, type: 0 });
    fetchMock.mockResolvedValueOnce(channel).mockResolvedValueOnce(response({ code: 110000 }, 202));
    await expect(
      connector.readPage(access, channelId, { query: { text: 'policy' } }),
    ).rejects.toThrow('preparing its search index');
    fetchMock.mockResolvedValueOnce(channel).mockResolvedValueOnce(
      response({
        messages: [[message('100000000000000011', { channel_id: threadId })]],
        total_results: 1,
      }),
    );
    await expect(
      connector.readPage(access, channelId, { query: { text: 'policy' } }),
    ).rejects.toThrow('invalid message identity');
  });
});
