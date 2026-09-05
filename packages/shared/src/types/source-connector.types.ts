export const MAX_SOURCE_PREVIEW_ITEMS = 500;
export const MAX_SOURCE_SELECTION_ITEMS = 100;
export const SOURCE_PREVIEW_TTL_SECONDS = 15 * 60;

/** A provider-neutral, independently selectable piece of source content. */
export interface SourceRecord {
  id: string;
  title: string;
  text: string;
  url: string;
  updatedAt: string;
}

export interface SourceConnectorDescriptor {
  id: string;
  name: string;
  locatorLabel: string;
  locatorPlaceholder: string;
  emptyStateHint: string;
  isConfigured: boolean;
}

export interface PreviewSourceRequest {
  connectorId: string;
  locator: string;
  previewId?: string;
  cursor?: string;
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
