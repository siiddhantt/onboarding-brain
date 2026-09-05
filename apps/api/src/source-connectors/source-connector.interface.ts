import type { SourceConnectorDescriptor, SourceRecord } from '@app-starter/shared';

export const SOURCE_CONNECTORS = Symbol('SOURCE_CONNECTORS');

export interface SourceCollectionPage {
  externalId: string;
  name: string;
  url: string;
  items: SourceRecord[];
  nextCursor: string | null;
}

/** Adapters own credentials, access checks, provider pagination and normalization. */
export interface SourceConnector {
  readonly id: string;
  describe(organizationId: string): SourceConnectorDescriptor;
  readPage(organizationId: string, locator: string, cursor?: string): Promise<SourceCollectionPage>;
}
