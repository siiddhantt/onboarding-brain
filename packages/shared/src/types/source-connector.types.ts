export const MAX_SOURCE_PREVIEW_ITEMS = 500;
export const MAX_SOURCE_SELECTION_ITEMS = 100;
export const SOURCE_PREVIEW_TTL_SECONDS = 15 * 60;

/** A provider-neutral, independently selectable piece of source content. */
export interface SourceRecord {
  id: string;
  title: string;
  text: string;
  url: string;
  createdAt?: string;
  updatedAt: string;
}

/** UTC instants; from is inclusive, to is exclusive. Provider syntax stays in adapters. */
export interface SourcePreviewQuery {
  text?: string;
  from?: string;
  to?: string;
}

export interface SourceConnectorDescriptor {
  id: string;
  name: string;
  locatorLabel: string;
  locatorPlaceholder: string;
  emptyStateHint: string;
  isConfigured: boolean;
  /** Present only when the connector supports native text and date search. */
  search?: { dateField: 'createdAt' | 'updatedAt' };
}

export interface PreviewSourceRequest {
  connectorId: string;
  locator: string;
  previewId?: string;
  cursor?: string;
  query?: SourcePreviewQuery;
}

export interface SourcePreview {
  id: string;
  connectorId: string;
  externalId: string;
  locator: string;
  name: string;
  url: string;
  items: SourceRecord[];
  selectedIds: string[];
  savedItemIds: string[];
  sourceId: string | null;
  sourceVersion: number | null;
  wasRemoved: boolean;
  nextCursor: string | null;
  expiresAt: string;
  query?: SourcePreviewQuery;
  resultIds?: string[];
  limitReached?: boolean;
}

export interface ImportSourceRequest {
  previewId: string;
  selectedIds: string[];
  shareWithOrganization: true;
  restoreRemoved?: boolean;
}

export interface CuratedSourceSelection {
  items: SourceRecord[];
  excludedIds: string[];
}
