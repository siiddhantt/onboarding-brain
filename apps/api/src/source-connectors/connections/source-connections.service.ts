import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgRole, Prisma, SourceConnection, SourceLocation } from '@prisma/client';
import type {
  CreateSourceConnectionRequest,
  SaveSourceLocationRequest,
  SourceConnection as PublicConnection,
  UpdateSourceConnectionRequest,
} from '@app-starter/shared';
import { OrganizationsService } from '../../organizations/organizations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SOURCE_CONNECTORS, SourceAccess, SourceConnector } from '../source-connector.interface';
import { ConnectionCredentials } from './connection-credentials.service';

const locations = { where: { archivedAt: null }, orderBy: { name: 'asc' as const } };

@Injectable()
export class SourceConnectionsService {
  constructor(
    @Inject(SOURCE_CONNECTORS) private readonly connectors: readonly SourceConnector[],
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly credentials: ConnectionCredentials,
  ) {}

  async listConnectors(userId: string, organizationId: string) {
    await this.requireManager(userId, organizationId);
    return this.connectors.map((connector) => ({
      ...connector.describe(),
      isConfigured: this.credentials.isConfigured(),
    }));
  }

  async list(userId: string, organizationId: string): Promise<PublicConnection[]> {
    await this.requireManager(userId, organizationId);
    const rows = await this.prisma.sourceConnection.findMany({
      where: { organizationId },
      include: { locations },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.publicConnection(row));
  }

  async create(
    userId: string,
    organizationId: string,
    input: CreateSourceConnectionRequest,
  ): Promise<PublicConnection> {
    await this.requireManager(userId, organizationId);
    const connector = this.connector(input.connectorId);
    const id = randomUUID();
    // Check local secret storage before asking the provider to verify a credential.
    const encryptedCredential = this.credentials.seal(
      input.credential,
      this.scope({ id, organizationId, connectorId: connector.id }),
    );
    const verified = await connector.verify({ config: input.config, credential: input.credential });
    try {
      const row = await this.prisma.sourceConnection.create({
        data: {
          id,
          organizationId,
          connectorId: connector.id,
          name: input.name,
          ...verified,
          encryptedCredential,
          lastVerifiedAt: new Date(),
        },
        include: { locations },
      });
      return this.publicConnection(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException(
          'This source account already has a connection in this organization. Update or reconnect it instead.',
        );
      // Never let a database exception carrying credential arguments reach the logger.
      throw new BadRequestException('The connection could not be saved. Try again.');
    }
  }

  async update(
    userId: string,
    organizationId: string,
    id: string,
    input: UpdateSourceConnectionRequest,
  ): Promise<PublicConnection> {
    await this.requireManager(userId, organizationId);
    const row = await this.find(organizationId, id);
    this.requireRevision(row, input.expectedRevision);
    const access = input.credential
      ? { config: row.config as Record<string, string>, credential: input.credential }
      : this.access(row);
    const verified = await this.connector(row.connectorId).verify(access);
    if (verified.externalAccountId !== row.externalAccountId)
      throw new ConflictException('A different source account needs its own connection.');
    const encryptedCredential = this.credentials.seal(access.credential, this.scope(row));
    const changed = await this.prisma.sourceConnection
      .updateMany({
        where: { id, organizationId, revision: input.expectedRevision },
        data: {
          name: input.name,
          encryptedCredential,
          accountName: verified.accountName,
          status: 'ACTIVE',
          revision: { increment: 1 },
          lastVerifiedAt: new Date(),
        },
      })
      .catch(() => {
        throw new BadRequestException('The connection could not be updated. Try again.');
      });
    if (!changed.count) this.changed();
    return this.publicConnection(await this.find(organizationId, id));
  }

  async disconnect(
    userId: string,
    organizationId: string,
    id: string,
    revision: number,
  ): Promise<PublicConnection> {
    await this.requireManager(userId, organizationId);
    const row = await this.find(organizationId, id);
    this.requireRevision(row, revision);
    const changed = await this.prisma.sourceConnection.updateMany({
      where: { id, organizationId, revision },
      data: { status: 'DISCONNECTED', encryptedCredential: null, revision: { increment: 1 } },
    });
    if (!changed.count) this.changed();
    return this.publicConnection(await this.find(organizationId, id));
  }

  async discover(userId: string, organizationId: string, id: string) {
    await this.requireManager(userId, organizationId);
    const row = await this.find(organizationId, id);
    const connector = this.connector(row.connectorId);
    if (!connector.discoverLocations)
      throw new BadRequestException('This source supports saving locations by link.');
    const result = await connector.discoverLocations(this.access(row));
    this.requireRevision(await this.find(organizationId, id), row.revision);
    return result;
  }

  async saveLocation(
    userId: string,
    organizationId: string,
    id: string,
    input: SaveSourceLocationRequest,
  ) {
    await this.requireManager(userId, organizationId);
    const row = await this.find(organizationId, id);
    this.requireRevision(row, input.expectedRevision);
    const resolved = await this.connector(row.connectorId).resolveLocation(
      this.access(row),
      input.locator,
    );
    // Serialize the local write with disconnect/rotation, without holding a lock over provider I/O.
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.sourceConnection.updateMany({
        where: { id, organizationId, revision: row.revision, status: 'ACTIVE' },
        data: { updatedAt: new Date() },
      });
      if (!current.count) this.changed();
      const saved = await tx.sourceLocation.upsert({
        where: {
          organizationId,
          connectionId_externalId: { connectionId: id, externalId: resolved.externalId },
        },
        create: { ...resolved, organizationId, connectionId: id },
        update: { ...resolved, archivedAt: null, revision: { increment: 1 } },
      });
      return this.publicLocation(saved);
    });
  }

  async forgetLocation(userId: string, organizationId: string, id: string): Promise<void> {
    await this.requireManager(userId, organizationId);
    const changed = await this.prisma.sourceLocation.updateMany({
      where: { id, organizationId, archivedAt: null },
      data: { archivedAt: new Date(), revision: { increment: 1 } },
    });
    if (!changed.count) throw new NotFoundException('Saved location not found.');
  }

  async locationAccess(userId: string, organizationId: string, id: string) {
    await this.requireManager(userId, organizationId);
    const location = await this.prisma.sourceLocation.findFirst({
      where: { id, organizationId, archivedAt: null },
    });
    if (!location) throw new NotFoundException('Saved location not found.');
    const connection = await this.find(organizationId, location.connectionId);
    return {
      location,
      connection,
      access: this.access(connection),
      connector: this.connector(connection.connectorId),
    };
  }

  async assertCurrent(
    userId: string,
    organizationId: string,
    locationId: string,
    connectionRevision: number,
    locationRevision: number,
  ): Promise<void> {
    const current = await this.locationAccess(userId, organizationId, locationId);
    if (
      current.connection.revision !== connectionRevision ||
      current.location.revision !== locationRevision
    )
      this.changed();
  }

  private access(row: SourceConnection): SourceAccess {
    if (row.status !== 'ACTIVE' || !row.encryptedCredential)
      throw new ConflictException(
        'This connection is disconnected. Reconnect it to preview or import.',
      );
    return {
      config: row.config as Record<string, string>,
      credential: this.credentials.open(row.encryptedCredential, this.scope(row)),
    };
  }

  private async find(organizationId: string, id: string) {
    const row = await this.prisma.sourceConnection.findFirst({
      where: { id, organizationId },
      include: { locations },
    });
    if (!row) throw new NotFoundException('Source connection not found.');
    return row;
  }

  private connector(id: string): SourceConnector {
    const connector = this.connectors.find((item) => item.id === id);
    if (!connector) throw new NotFoundException('Source connector not found.');
    return connector;
  }

  private async requireManager(userId: string, organizationId: string): Promise<void> {
    const role = await this.organizations.getUserRoleInOrganization(userId, organizationId);
    if (role !== OrgRole.OWNER && role !== OrgRole.ADMIN)
      throw new ForbiddenException(
        'Only organization owners and admins can manage source connections.',
      );
  }

  private requireRevision(row: SourceConnection, revision: number): void {
    if (row.revision !== revision) this.changed();
  }

  private changed(): never {
    throw new ConflictException(
      'The connection or saved location changed. Refresh and preview again.',
    );
  }

  private scope(row: Pick<SourceConnection, 'id' | 'organizationId' | 'connectorId'>): string {
    return `source-connection:${row.organizationId}:${row.id}:${row.connectorId}`;
  }

  private publicLocation(row: SourceLocation) {
    return {
      id: row.id,
      connectionId: row.connectionId,
      externalId: row.externalId,
      name: row.name,
      locator: row.locator,
      url: row.url,
    };
  }

  private publicConnection(
    row: SourceConnection & { locations: SourceLocation[] },
  ): PublicConnection {
    return {
      id: row.id,
      connectorId: row.connectorId,
      name: row.name,
      accountName: row.accountName,
      config: row.config as Record<string, string>,
      status: row.status,
      revision: row.revision,
      lastVerifiedAt: row.lastVerifiedAt.toISOString(),
      locations: row.locations.map((location) => this.publicLocation(location)),
    };
  }
}
