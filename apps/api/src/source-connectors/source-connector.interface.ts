import type {
  SourceConnectorDescriptor,
  SourcePreviewQuery,
  SourceRecord,
  SourceLocation,
} from '@app-starter/shared';

export const SOURCE_CONNECTORS = Symbol('SOURCE_CONNECTORS');

export interface SourceCollectionPage {
  externalId: string;
  name: string;
  url: string;
  items: SourceRecord[];
  nextCursor: string | null;
}

export interface SourcePageOptions {
  cursor?: string;
  query?: SourcePreviewQuery;
  limit?: number;
}

export interface SourceAccess {
  config: Record<string, string>;
  credential: string;
}

export interface VerifiedSourceAccount {
  externalAccountId: string;
  accountName: string;
  config: Record<string, string>;
}

/** Adapters use request-scoped access; they never select a tenant or store secrets. */
export interface SourceConnector {
  readonly id: string;
  describe(): SourceConnectorDescriptor;
  verify(access: SourceAccess): Promise<VerifiedSourceAccount>;
  resolveLocation(access: SourceAccess, locator: string): Promise<SourceLocation>;
  discoverLocations?(access: SourceAccess): Promise<SourceLocation[]>;
  readPage(
    access: SourceAccess,
    locator: string,
    options?: SourcePageOptions,
  ): Promise<SourceCollectionPage>;
}
