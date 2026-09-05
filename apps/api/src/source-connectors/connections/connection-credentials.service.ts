import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** The storage boundary can later use a secret manager without changing connectors. */
@Injectable()
export class ConnectionCredentials {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return /^[a-f\d]{64}$/i.test(
      this.config.get<string>('SOURCE_CREDENTIALS_ENCRYPTION_KEY') ?? '',
    );
  }

  seal(credential: string, scope: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    cipher.setAAD(Buffer.from(scope));
    const encrypted = Buffer.concat([cipher.update(credential, 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  open(value: string, scope: string): string {
    const key = this.key();
    try {
      const [version, iv, tag, encrypted, extra] = value.split('.');
      if (version !== 'v1' || !iv || !tag || !encrypted || extra) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      decipher.setAAD(Buffer.from(scope));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException(
        'Connection credentials could not be opened. Ask the app operator to check the encryption key, or replace the credential.',
      );
    }
  }

  private key(): Buffer {
    if (!this.isConfigured())
      throw new ServiceUnavailableException(
        'The app operator must configure SOURCE_CREDENTIALS_ENCRYPTION_KEY before connections can be used.',
      );
    return Buffer.from(this.config.get<string>('SOURCE_CREDENTIALS_ENCRYPTION_KEY')!, 'hex');
  }
}
