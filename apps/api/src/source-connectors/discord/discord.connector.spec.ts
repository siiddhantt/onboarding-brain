import { ConfigService } from '@nestjs/config';
import { DiscordConnector } from './discord.connector';

describe('DiscordConnector', () => {
  const guildId = '100000000000000001';
  const channelId = '100000000000000002';
  const threadId = '100000000000000003';
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
    const values = {
      DISCORD_BOT_TOKEN: 'test-bot-token',
      DISCORD_GUILD_ID: guildId,
      DISCORD_CHANNEL_IDS: channelId,
      DISCORD_ORGANIZATION_ID: 'org-1',
    };
    connector = new DiscordConnector(new ConfigService(values));
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
    const result = await connector.readPage('org-1', channelId);
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

  it('offers a public thread starter for explicit selection and supports its parent allowlist', async () => {
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
      'org-1',
      `https://discord.com/channels/${guildId}/${threadId}`,
    );
    expect(result.externalId).toBe(`${guildId}/${threadId}`);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].text).toBe('How do expense reports work?');
  });

  it('rejects another organization and arbitrary URLs before making a request', async () => {
    await expect(connector.readPage('org-2', channelId)).rejects.toThrow('not configured');
    await expect(connector.readPage('org-1', 'https://localhost/secrets')).rejects.toThrow(
      'channel ID',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch messages from an unapproved channel or a different server', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ id: threadId, guild_id: guildId, type: 0 }))
      .mockResolvedValueOnce(response({ id: channelId, guild_id: 'another-server', type: 0 }));
    await expect(connector.readPage('org-1', threadId)).rejects.toThrow('allowlist');
    await expect(connector.readPage('org-1', channelId)).rejects.toThrow('configured server');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('respects Discord retry-after instead of issuing repeated requests', async () => {
    fetchMock.mockResolvedValueOnce(response({ retry_after: 20 }, 429));
    await expect(connector.readPage('org-1', channelId)).rejects.toThrow('rate limit');
    await expect(connector.readPage('org-1', channelId)).rejects.toThrow('rate limit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps upstream errors and credentials out of error responses', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Authorization: Bot test-bot-token'));
    await expect(connector.readPage('org-1', channelId)).rejects.toThrow('Could not read Discord');
  });
});
