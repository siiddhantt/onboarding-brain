import { randomUUID } from 'node:crypto';
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MAX_SOURCE_PREVIEW_ITEMS,
  MAX_SOURCE_SELECTION_ITEMS,
  SOURCE_PREVIEW_TTL_SECONDS,
} from '@app-starter/shared';
import type { ImportSourceRequest, PreviewSourceRequest, SourcePreview } from '@app-starter/shared';
import { OrgRole } from '@prisma/client';
import { CompanyBrainService } from '../company-brain/company-brain.service';
import { readSelection } from '../company-brain/curated-source';
import { OrganizationsService } from '../organizations/organizations.service';
import { RedisService } from '../redis/redis.service';
import {
  SOURCE_CONNECTORS,
  SourceCollectionPage,
  SourceConnector,
} from './source-connector.interface';

interface PreviewSession extends SourcePreview {
  excludedIds: string[];
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
    @Inject(SOURCE_CONNECTORS) private readonly connectors: readonly SourceConnector[],
    private readonly brain: CompanyBrainService,
    private readonly organizations: OrganizationsService,
    private readonly redis: RedisService,
  ) {}

  async listConnectors(userId: string, organizationId: string) {
    await this.requireManager(userId, organizationId);
    return this.connectors.map((connector) => connector.describe(organizationId));
  }

  async preview(
    userId: string,
    organizationId: string,
    request: PreviewSourceRequest,
  ): Promise<SourcePreview> {
    await this.requireManager(userId, organizationId);
    const connector = this.connector(request.connectorId, organizationId);
    const previous = request.previewId
      ? await this.session(userId, organizationId, request.previewId)
      : null;
    if (
      previous &&
      (previous.connectorId !== request.connectorId ||
        previous.locator !== request.locator ||
        previous.nextCursor !== request.cursor)
    ) {
      throw new BadRequestException('This page does not belong to the current preview.');
    }
    if (Boolean(request.cursor) !== Boolean(previous))
      throw new BadRequestException('Load older items from an existing preview.');
    const page = await connector.readPage(organizationId, request.locator, request.cursor);
    this.validatePage(page);
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
      connectorId: connector.id,
      externalId: page.externalId,
      locator: request.locator,
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
    };
    await this.redis.set(
      this.key(userId, organizationId, session.id),
      JSON.stringify(session),
      SOURCE_PREVIEW_TTL_SECONDS,
    );
    const { excludedIds: _excludedIds, ...response } = session;
    return response;
  }

  async import(userId: string, organizationId: string, request: ImportSourceRequest) {
    await this.requireManager(userId, organizationId);
    const preview = await this.session(userId, organizationId, request.previewId);
    this.connector(preview.connectorId, organizationId);
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

  private connector(id: string, organizationId: string): SourceConnector {
    const connector = this.connectors.find((item) => item.id === id);
    if (!connector) throw new NotFoundException('Source connector not found.');
    if (!connector.describe(organizationId).isConfigured)
      throw new ServiceUnavailableException(
        'This connector is not configured for the organization.',
      );
    return connector;
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
    if (Date.parse(session.expiresAt) <= Date.now())
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
        !Number.isFinite(Date.parse(item.updatedAt))
      ) {
        throw new BadGatewayException('The connector returned invalid source content.');
      }
      ids.add(item.id);
    }
    if (Buffer.byteLength(JSON.stringify(page)) > 2 * 1024 * 1024)
      throw new BadGatewayException('The connector preview is too large.');
  }
}
