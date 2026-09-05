import type {
  SourceConnectorDescriptor,
  SourcePreviewQuery,
  SourceRecord,
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

/** Adapters own credentials, access checks, provider pagination and normalization. */
export interface SourceConnector {
  readonly id: string;
  describe(organizationId: string): SourceConnectorDescriptor;
  readPage(
    organizationId: string,
    locator: string,
    options?: SourcePageOptions,
  ): Promise<SourceCollectionPage>;
}
