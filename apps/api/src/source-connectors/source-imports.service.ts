import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MAX_SOURCE_PREVIEW_ITEMS,
  MAX_SOURCE_SELECTION_ITEMS,
  SOURCE_PREVIEW_TTL_SECONDS,
} from '@app-starter/shared';
import type {
  ImportSourceRequest,
  PreviewSourceRequest,
  SourcePreview,
  SourcePreviewQuery,
} from '@app-starter/shared';
import { OrgRole } from '@prisma/client';
import { CompanyBrainService } from '../company-brain/company-brain.service';
import { readSelection } from '../company-brain/curated-source';
import { OrganizationsService } from '../organizations/organizations.service';
import { RedisService } from '../redis/redis.service';
import { SourceCollectionPage } from './source-connector.interface';
import { SourceConnectionsService } from './connections/source-connections.service';

interface PreviewSession extends SourcePreview {
  excludedIds: string[];
  connectionRevision: number;
  locationRevision: number;
}

const isSafeUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
};

@Injectable()
export class SourceImportsService {
  constructor(
    private readonly connections: SourceConnectionsService,
    private readonly brain: CompanyBrainService,
    private readonly organizations: OrganizationsService,
    private readonly redis: RedisService,
  ) {}

  async listConnectors(userId: string, organizationId: string) {
    return this.connections.listConnectors(userId, organizationId);
  }

  async preview(
    userId: string,
    organizationId: string,
    request: PreviewSourceRequest,
  ): Promise<SourcePreview> {
    await this.requireManager(userId, organizationId);
    const { connector, access, connection, location } = await this.connections.locationAccess(
      userId,
      organizationId,
      request.locationId,
    );
    const query = this.normalizeQuery(request.query);
    if (Object.keys(query).length && !connector.describe().search)
      throw new BadRequestException('This connector supports filtering loaded items only.');
    const previous = request.previewId
      ? await this.session(userId, organizationId, request.previewId)
      : null;
    if (
      previous &&
      (previous.locationId !== request.locationId ||
        (request.cursor &&
          (previous.nextCursor !== request.cursor ||
            JSON.stringify(previous.query ?? {}) !== JSON.stringify(query))))
    ) {
      throw new BadRequestException('This page does not belong to the current preview.');
    }
    if (previous)
      await this.connections.assertCurrent(
        userId,
        organizationId,
        previous.locationId,
        previous.connectionRevision,
        previous.locationRevision,
      );
    if (request.cursor && !previous)
      throw new BadRequestException('Load more items from an existing preview.');
    const remaining = MAX_SOURCE_PREVIEW_ITEMS - (previous?.items.length ?? 0);
    if (!remaining)
      throw new BadRequestException(
        'Preview limit reached. Save your selection, then start a new preview.',
      );
    const page = await connector.readPage(access, location.locator, {
      cursor: request.cursor,
      query,
      limit: Math.min(100, remaining),
    });
    this.validatePage(page);
    if (page.externalId !== location.externalId)
      throw new BadGatewayException(
        'The saved location changed identity. Save it as a new location.',
      );
    await this.connections.assertCurrent(
      userId,
      organizationId,
      location.id,
      connection.revision,
      location.revision,
    );
    if (request.cursor && page.nextCursor === request.cursor)
      throw new BadGatewayException('The connector did not advance to another page.');
    if (page.items.length > Math.min(100, remaining))
      throw new BadGatewayException('The connector exceeded the requested page size.');
    if (previous && previous.externalId !== page.externalId)
      throw new BadGatewayException('The connector changed source identity between pages.');

    const existing = previous
      ? null
      : await this.brain.getExternalSource(userId, organizationId, connector.id, page.externalId);
    const selection = readSelection(existing?.selection ?? null);
    const savedItems = previous?.items ?? selection.items;
    const items = [
      ...new Map([...savedItems, ...page.items].map((item) => [item.id, item])).values(),
    ];
    if (Buffer.byteLength(JSON.stringify(items)) > 2 * 1024 * 1024)
      throw new BadRequestException('The preview is too large. Use a narrower source.');
    if (items.length > MAX_SOURCE_PREVIEW_ITEMS)
      throw new BadRequestException(
        `A preview can contain up to ${MAX_SOURCE_PREVIEW_ITEMS} items. Import your selection before starting another preview.`,
      );
    const fetchedIds = new Set(page.items.map((item) => item.id));
    const savedItemIds = (previous?.savedItemIds ?? selection.items.map((item) => item.id)).filter(
      (id) => !fetchedIds.has(id),
    );
    const session: PreviewSession = {
      id: randomUUID(),
      locationId: location.id,
      connectionRevision: connection.revision,
      locationRevision: location.revision,
      connectorId: connector.id,
      externalId: page.externalId,
      locator: location.locator,
      name: page.name,
      url: page.url,
      items,
      selectedIds: previous?.selectedIds ?? selection.items.map((item) => item.id),
      savedItemIds,
      sourceId: previous?.sourceId ?? existing?.id ?? null,
      sourceVersion: previous?.sourceVersion ?? existing?.version ?? null,
      wasRemoved: previous?.wasRemoved ?? Boolean(existing?.archivedAt),
      excludedIds: previous?.excludedIds ?? selection.excludedIds,
      nextCursor: items.length < MAX_SOURCE_PREVIEW_ITEMS ? page.nextCursor : null,
      expiresAt: new Date(Date.now() + SOURCE_PREVIEW_TTL_SECONDS * 1000).toISOString(),
      query,
      resultIds: [
        ...new Set([
          ...(request.cursor ? (previous?.resultIds ?? []) : []),
          ...page.items.map((item) => item.id),
        ]),
      ],
      limitReached: items.length >= MAX_SOURCE_PREVIEW_ITEMS,
    };
    await this.redis.set(
      this.key(userId, organizationId, session.id),
      JSON.stringify(session),
      SOURCE_PREVIEW_TTL_SECONDS,
    );
    const {
      excludedIds: _excludedIds,
      connectionRevision: _connectionRevision,
      locationRevision: _locationRevision,
      ...response
    } = session;
    return response;
  }

  async import(userId: string, organizationId: string, request: ImportSourceRequest) {
    await this.requireManager(userId, organizationId);
    const preview = await this.session(userId, organizationId, request.previewId);
    await this.connections.assertCurrent(
      userId,
      organizationId,
      preview.locationId,
      preview.connectionRevision,
      preview.locationRevision,
    );
    if (request.shareWithOrganization !== true)
      throw new BadRequestException('Confirm organization-wide sharing.');
    const selected = new Set(request.selectedIds);
    const items = preview.items.filter((item) => selected.has(item.id));
    if (
      !items.length ||
      items.length !== selected.size ||
      selected.size > MAX_SOURCE_SELECTION_ITEMS
    )
      throw new BadRequestException(
        `Select only items from this preview (up to ${MAX_SOURCE_SELECTION_ITEMS}).`,
      );
    const excludedIds = [
      ...new Set([
        ...preview.excludedIds,
        ...preview.items.filter((item) => !selected.has(item.id)).map((item) => item.id),
      ]),
    ].filter((id) => !selected.has(id));
    if (excludedIds.length > 5000)
      throw new BadRequestException(
        'This collection has reached its curation limit. Use a narrower source.',
      );
    return this.brain.importSource(userId, organizationId, {
      connectorId: preview.connectorId,
      externalId: preview.externalId,
      name: preview.name,
      url: preview.url,
      selection: { items, excludedIds },
      expectedVersion: preview.sourceVersion,
      wasRemoved: preview.wasRemoved,
      restoreRemoved: request.restoreRemoved === true,
    });
  }

  private normalizeQuery(query?: SourcePreviewQuery): SourcePreviewQuery {
    if (query?.from && query.to && Date.parse(query.from) >= Date.parse(query.to))
      throw new BadRequestException('The start date must be before the end date.');
    return {
      ...(query?.text?.trim() ? { text: query.text.trim() } : {}),
      ...(query?.from ? { from: new Date(query.from).toISOString() } : {}),
      ...(query?.to ? { to: new Date(query.to).toISOString() } : {}),
    };
  }

  private async session(
    userId: string,
    organizationId: string,
    id: string,
  ): Promise<PreviewSession> {
    const raw = await this.redis.get(this.key(userId, organizationId, id));
    if (!raw)
      throw new NotFoundException(
        'This preview expired or is not accessible. Preview the source again.',
      );
    const session = JSON.parse(raw) as PreviewSession;
    if (
      !session.locationId ||
      !session.connectionRevision ||
      !session.locationRevision ||
      Date.parse(session.expiresAt) <= Date.now()
    )
      throw new NotFoundException('This preview expired. Preview the source again.');
    return session;
  }

  private key(userId: string, organizationId: string, id: string): string {
    return `source-preview:${organizationId}:${userId}:${id}`;
  }

  private async requireManager(userId: string, organizationId: string): Promise<void> {
    const role = await this.organizations.getUserRoleInOrganization(userId, organizationId);
    if (role !== OrgRole.OWNER && role !== OrgRole.ADMIN)
      throw new ForbiddenException('Only owners and admins can import sources.');
  }

  private validatePage(page: SourceCollectionPage): void {
    if (
      !page.externalId ||
      page.externalId.length > 300 ||
      !page.name ||
      page.name.length > 255 ||
      !isSafeUrl(page.url) ||
      page.items.length > MAX_SOURCE_PREVIEW_ITEMS
    ) {
      throw new BadGatewayException('The connector returned an invalid collection.');
    }
    const ids = new Set<string>();
    for (const item of page.items) {
      if (
        !item.id ||
        item.id.length > 300 ||
        ids.has(item.id) ||
        !item.title ||
        item.title.length > 255 ||
        !item.text.trim() ||
        item.text.length > 100_000 ||
        !isSafeUrl(item.url) ||
        !Number.isFinite(Date.parse(item.updatedAt)) ||
        (item.createdAt !== undefined && !Number.isFinite(Date.parse(item.createdAt)))
      ) {
        throw new BadGatewayException('The connector returned invalid source content.');
      }
      ids.add(item.id);
    }
    if (Buffer.byteLength(JSON.stringify(page)) > 2 * 1024 * 1024)
      throw new BadGatewayException('The connector preview is too large.');
  }
}
