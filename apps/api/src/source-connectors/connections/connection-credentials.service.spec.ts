import { ConfigService } from '@nestjs/config';
import { ConnectionCredentials } from './connection-credentials.service';

describe('ConnectionCredentials', () => {
  const store = new ConnectionCredentials(
    new ConfigService({ SOURCE_CREDENTIALS_ENCRYPTION_KEY: 'ab'.repeat(32) }),
  );

  it('encrypts with fresh nonces and binds ciphertext to its organization and connection', () => {
    const first = store.seal('private-token', 'org-1:connection-1');
    expect(first).not.toContain('private-token');
    expect(first).not.toEqual(store.seal('private-token', 'org-1:connection-1'));
    expect(store.open(first, 'org-1:connection-1')).toBe('private-token');
    expect(() => store.open(first, 'org-2:connection-1')).toThrow('could not be opened');
    expect(() => store.open(first, 'org-1:connection-2')).toThrow('could not be opened');
    const parts = first.split('.');
    parts[3] = Buffer.from('altered-ciphertext').toString('base64');
    expect(() => store.open(parts.join('.'), 'org-1:connection-1')).toThrow('could not be opened');
  });

  it('fails closed without a valid key or when an old ciphertext uses a different key', () => {
    for (const key of ['', 'too-short', 'zz'.repeat(32)]) {
      const invalid = new ConnectionCredentials(
        new ConfigService({ SOURCE_CREDENTIALS_ENCRYPTION_KEY: key }),
      );
      expect(invalid.isConfigured()).toBe(false);
      expect(() => invalid.seal('private-token', 'scope')).toThrow('must configure');
    }
    const other = new ConnectionCredentials(
      new ConfigService({ SOURCE_CREDENTIALS_ENCRYPTION_KEY: 'cd'.repeat(32) }),
    );
    expect(() => other.open(store.seal('private-token', 'scope'), 'scope')).toThrow(
      'could not be opened',
    );
  });
});
