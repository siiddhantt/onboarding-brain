import { createHash } from 'node:crypto';
import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

export const discordObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadGatewayException('Discord returned an unreadable response.');
  return value as Record<string, unknown>;
};

@Injectable()
export class DiscordClient {
  private readonly retries = new Map<string, number>();

  async get(credential: string, path: string, allowMissing = false): Promise<unknown> {
    // Sharing a provider credential shares its rate limit, not every tenant's requests.
    const key = createHash('sha256').update(credential).digest('hex');
    const retryAt = this.retries.get(key) ?? 0;
    if (Date.now() < retryAt) this.rateLimited(retryAt);
    this.retries.delete(key);
    try {
      const response = await fetch(`https://discord.com/api/v10${path}`, {
        headers: { Authorization: `Bot ${credential}` },
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      if (response.status === 429) {
        const body = discordObject(await response.json());
        const delay = Number(response.headers.get('retry-after') ?? body.retry_after);
        const next =
          Date.now() + (Number.isFinite(delay) && delay > 0 ? Math.min(delay, 3600) : 5) * 1000;
        for (const [entry, until] of this.retries)
          if (until <= Date.now()) this.retries.delete(entry);
        if (this.retries.size >= 1000) this.retries.delete(this.retries.keys().next().value!);
        this.retries.set(key, next);
        this.rateLimited(next);
      }
      if (response.status === 401 || response.status === 403)
        throw new ForbiddenException(
          'Check the Discord bot token, View Channels and Read Message History permissions.',
        );
      if (response.status === 404) {
        if (allowMissing) return null;
        throw new NotFoundException('Discord resource not found or not accessible to the bot.');
      }
      if (response.status === 202)
        throw new ServiceUnavailableException(
          'Discord is preparing its search index. Try searching again shortly; your selection is unchanged.',
        );
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

  private rateLimited(retryAt: number): never {
    const retryAfter = Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
    throw new HttpException(
      { message: `Discord rate limit reached. Try again in ${retryAfter} seconds.`, retryAfter },
      429,
    );
  }
}
