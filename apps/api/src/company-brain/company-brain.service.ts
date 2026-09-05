import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  KnowledgeSource as PrismaKnowledgeSource,
  KnowledgeSourceStatus,
  OrgRole,
  Prisma,
} from '@prisma/client';
import {
  CompanyBrainAnswer,
  CompanyBrainStatusResponse,
  KNOWLEDGE_DOCUMENT_MIME_TYPES,
  KnowledgeSource,
  KnowledgeSourceListResponse,
  MAX_KNOWLEDGE_DOCUMENT_BYTES,
} from '@app-starter/shared';
import {
  KNOWLEDGE_ENGINE,
  KnowledgeEngine,
  KnowledgeEngineAnswer,
  KnowledgeContent,
} from '../common/knowledge/knowledge-engine.interface';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { compileSource, CuratedSourceInput, readSelection } from './curated-source';

const MANAGE_ROLES: readonly OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN];
const MEMBER_ROLES: readonly OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER];
const FAILED_INGESTION_MESSAGE = 'The document could not be indexed. Try uploading it again.';
const FAILED_REPLACEMENT_MESSAGE =
  'The new version could not be indexed. Review the source before retrying.';
const FAILED_REMOVAL_MESSAGE = 'The knowledge source could not be removed. Try again.';
const FAILED_QUESTION_MESSAGE = 'The company brain could not answer right now. Try again.';
const SOURCE_BUSY_MESSAGE = 'This knowledge source is already being changed. Try again shortly.';
const SUPPORTED_DOCUMENT_MIME_TYPES = new Set<string>(KNOWLEDGE_DOCUMENT_MIME_TYPES);

interface ValidatedDocument {
  name: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class CompanyBrainService {
  private readonly logger = new Logger(CompanyBrainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
    @Inject(KNOWLEDGE_ENGINE) private readonly knowledgeEngine: KnowledgeEngine,
  ) {}

  async getStatus(userId: string, organizationId: string): Promise<CompanyBrainStatusResponse> {
    await this.requireRole(userId, organizationId, MEMBER_ROLES, 'view the company brain');
    return { isConfigured: this.knowledgeEngine.isConfigured() };
  }

  async listSources(userId: string, organizationId: string): Promise<KnowledgeSourceListResponse> {
    await this.requireRole(userId, organizationId, MEMBER_ROLES, 'view knowledge sources');

    const sources = await this.prisma.knowledgeSource.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: sources.map((source) => this.toSourceResponse(source)),
      total: sources.length,
    };
  }

  async uploadDocument(
    userId: string,
    organizationId: string,
    file?: Express.Multer.File,
  ): Promise<KnowledgeSource> {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'add knowledge sources');
    const document = this.validateDocument(file);

    if (!this.knowledgeEngine.isConfigured()) {
      throw new ServiceUnavailableException(
        'The knowledge engine is not configured for this environment.',
      );
    }

    const source = await this.prisma.knowledgeSource.create({
      data: {
        organizationId,
        createdById: userId,
        sourceType: 'DOCUMENT',
        name: document.name,
        mimeType: document.mimetype,
        sizeBytes: document.size,
        status: KnowledgeSourceStatus.PROCESSING,
      },
    });

    return this.indexSource(source, {
      kind: 'binary',
      bytes: document.buffer,
      fileName: document.name,
      mimeType: document.mimetype,
    });
  }

  async replaceDocument(
    userId: string,
    organizationId: string,
    sourceId: string,
    file?: Express.Multer.File,
  ): Promise<KnowledgeSource> {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'replace knowledge sources');
    const document = this.validateDocument(file);

    if (!this.knowledgeEngine.isConfigured()) {
      throw new ServiceUnavailableException(
        'The knowledge engine is not configured for this environment.',
      );
    }

    const source = await this.findActiveSource(organizationId, sourceId);
    if (source.connectorId)
      throw new BadRequestException('Review the connected source to change its selection.');
    await this.claimSource(source, KnowledgeSourceStatus.UPDATING);
    return this.indexSource(
      source,
      {
        kind: 'binary',
        bytes: document.buffer,
        fileName: document.name,
        mimeType: document.mimetype,
      },
      { name: document.name, mimeType: document.mimetype, sizeBytes: document.size },
      true,
    );
  }

  async getExternalSource(
    userId: string,
    organizationId: string,
    connectorId: string,
    externalId: string,
  ) {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'review connected sources');
    return this.prisma.knowledgeSource.findFirst({
      where: { organizationId, connectorId, externalId },
    });
  }

  async importSource(
    userId: string,
    organizationId: string,
    input: CuratedSourceInput,
  ): Promise<KnowledgeSource> {
    const source = await this.getExternalSource(
      userId,
      organizationId,
      input.connectorId,
      input.externalId,
    );
    if (!this.knowledgeEngine.isConfigured())
      throw new ServiceUnavailableException('The knowledge engine is not configured.');
    const compiled = compileSource(input);
    const sizeBytes = Buffer.byteLength(compiled.text);
    if (sizeBytes > MAX_KNOWLEDGE_DOCUMENT_BYTES)
      throw new BadRequestException('The selected content must be 10 MB or smaller.');
    if (source?.archivedAt && (!input.wasRemoved || !input.restoreRemoved)) {
      throw new ConflictException(
        'This source was removed. Preview it again and explicitly choose to re-add it.',
      );
    }
    if (
      source &&
      !source.archivedAt &&
      source.status === KnowledgeSourceStatus.READY &&
      source.contentHash === compiled.hash
    ) {
      const previous = readSelection(source.selection);
      const selectedIds = new Set(input.selection.items.map((item) => item.id));
      const excludedIds = [
        ...new Set([...previous.excludedIds, ...input.selection.excludedIds]),
      ].filter((id) => !selectedIds.has(id));
      if (excludedIds.length !== previous.excludedIds.length) {
        const saved = await this.prisma.knowledgeSource.updateMany({
          where: {
            id: source.id,
            organizationId,
            version: source.version,
            status: KnowledgeSourceStatus.READY,
            archivedAt: null,
          },
          data: {
            selection: {
              items: input.selection.items,
              excludedIds,
            } as unknown as Prisma.InputJsonValue,
          },
        });
        if (saved.count !== 1) throw new ConflictException(SOURCE_BUSY_MESSAGE);
      }
      return this.toSourceResponse(source);
    }
    if (
      (source?.version ?? null) !== input.expectedVersion ||
      Boolean(source?.archivedAt) !== input.wasRemoved
    ) {
      throw new ConflictException(
        'This source changed after your preview. Review it again before importing.',
      );
    }
    const metadata = {
      name: input.name,
      sourceUrl: input.url,
      mimeType: 'text/plain',
      sizeBytes,
      contentHash: compiled.hash,
      selection: input.selection as unknown as Prisma.InputJsonValue,
    };
    let claimed: PrismaKnowledgeSource;
    if (source) {
      await this.claimSource(source, KnowledgeSourceStatus.UPDATING, input.restoreRemoved);
      claimed = source;
    } else {
      try {
        claimed = await this.prisma.knowledgeSource.create({
          data: {
            organizationId,
            createdById: userId,
            sourceType: 'EXTERNAL',
            connectorId: input.connectorId,
            externalId: input.externalId,
            status: KnowledgeSourceStatus.PROCESSING,
            ...metadata,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException(
            'This source is already being imported. Refresh its preview.',
          );
        }
        throw error;
      }
    }
    return this.indexSource(
      claimed,
      { kind: 'text', name: input.name, text: compiled.text },
      metadata,
      Boolean(source),
    );
  }

  private async indexSource(
    source: PrismaKnowledgeSource,
    content: KnowledgeContent,
    metadata: Prisma.KnowledgeSourceUpdateInput = {},
    isReplacement = false,
  ): Promise<KnowledgeSource> {
    let indexed: Awaited<ReturnType<KnowledgeEngine['ingest']>> | undefined;
    try {
      indexed = source.providerReference
        ? await this.knowledgeEngine.replace({
            organizationId: source.organizationId,
            providerReference: source.providerReference,
            providerContainerReference: source.providerContainerReference,
            content,
          })
        : await this.knowledgeEngine.ingest({ organizationId: source.organizationId, content });
      const ready = await this.prisma.knowledgeSource.update({
        where: { id: source.id, organizationId: source.organizationId },
        data: {
          ...metadata,
          status: KnowledgeSourceStatus.READY,
          providerReference: indexed.providerReference,
          providerContainerReference:
            indexed.providerContainerReference ?? source.providerContainerReference,
          ...(isReplacement ? { version: { increment: 1 } } : {}),
          lastIndexedAt: new Date(),
          errorMessage: null,
        },
      });
      return this.toSourceResponse(ready);
    } catch (error) {
      this.logger.error(
        `Failed to index knowledge source ${source.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      const errorMessage = isReplacement ? FAILED_REPLACEMENT_MESSAGE : FAILED_INGESTION_MESSAGE;
      if (isReplacement) {
        await this.prisma.knowledgeSource.updateMany({
          where: {
            id: source.id,
            organizationId: source.organizationId,
            status: KnowledgeSourceStatus.UPDATING,
            archivedAt: null,
          },
          data: {
            status: KnowledgeSourceStatus.FAILED,
            errorMessage,
            ...(indexed
              ? {
                  providerReference: indexed.providerReference,
                  providerContainerReference: indexed.providerContainerReference,
                }
              : {}),
          },
        });
        throw new ServiceUnavailableException(errorMessage);
      }
      const failed = await this.prisma.knowledgeSource.update({
        where: { id: source.id, organizationId: source.organizationId },
        data: {
          status: KnowledgeSourceStatus.FAILED,
          errorMessage,
          // Preserve a successful provider operation's identity if local finalization failed.
          ...(indexed
            ? {
                providerReference: indexed.providerReference,
                providerContainerReference: indexed.providerContainerReference,
              }
            : {}),
        },
      });
      return this.toSourceResponse(failed);
    }
  }

  async removeSource(userId: string, organizationId: string, sourceId: string): Promise<void> {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'remove knowledge sources');
    const source = await this.findActiveSource(organizationId, sourceId);

    if (source.providerReference && !this.knowledgeEngine.isConfigured()) {
      throw new ServiceUnavailableException(
        'The knowledge engine is not configured for this environment.',
      );
    }

    await this.claimSource(source, KnowledgeSourceStatus.REMOVING);

    if (source.providerReference) {
      try {
        await this.knowledgeEngine.remove({
          organizationId,
          providerReference: source.providerReference,
          providerContainerReference: source.providerContainerReference,
        });
      } catch (error) {
        this.logger.error(
          `Failed to remove knowledge source ${source.id} from the knowledge engine`,
          error instanceof Error ? error.stack : String(error),
        );
        await this.finishSourceMutationFailure(
          source,
          KnowledgeSourceStatus.REMOVING,
          source.status,
          FAILED_REMOVAL_MESSAGE,
        );
        throw new ServiceUnavailableException(FAILED_REMOVAL_MESSAGE);
      }
    }

    try {
      await this.prisma.knowledgeSource.update({
        where: { id: source.id, organizationId },
        data: {
          status: source.status,
          archivedAt: new Date(),
          errorMessage: null,
          ...(source.connectorId
            ? {
                selection: Prisma.DbNull,
                contentHash: null,
                providerReference: null,
                providerContainerReference: null,
              }
            : {}),
        },
      });
    } catch (error) {
      this.logger.error(
        `Provider removal succeeded but local archival failed for knowledge source ${source.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(FAILED_REMOVAL_MESSAGE);
    }
  }

  async ask(userId: string, organizationId: string, question: string): Promise<CompanyBrainAnswer> {
    await this.requireRole(userId, organizationId, MEMBER_ROLES, 'ask the company brain');
    if (!this.knowledgeEngine.isConfigured()) {
      throw new ServiceUnavailableException(
        'The knowledge engine is not configured for this environment.',
      );
    }

    let answer: KnowledgeEngineAnswer;
    try {
      answer = await this.knowledgeEngine.ask(organizationId, question);
    } catch (error) {
      this.logger.error(
        `Failed to answer a company-brain question for organization ${organizationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(FAILED_QUESTION_MESSAGE);
    }

    const providerReferences = answer.citations
      .map((citation) => citation.referenceId)
      .filter((reference): reference is string => reference !== null);
    const sources =
      providerReferences.length > 0
        ? await this.prisma.knowledgeSource.findMany({
            where: {
              organizationId,
              archivedAt: null,
              providerReference: { in: providerReferences },
            },
          })
        : [];
    const sourceByReference = new Map(
      sources
        .filter((source) => source.providerReference !== null)
        .map((source) => [source.providerReference as string, source]),
    );

    return {
      status: answer.status,
      answer: answer.answer,
      citations: answer.citations.map((citation) => {
        const source = citation.referenceId
          ? sourceByReference.get(citation.referenceId)
          : undefined;

        return {
          sourceId: source?.id ?? null,
          sourceName: source?.name ?? citation.label ?? 'Company knowledge',
          excerpt: citation.excerpt,
          score: citation.score,
          ...(source?.sourceUrl
            ? {
                sourceUrl: source.sourceUrl,
                sourceLinks: readSelection(source.selection).items.map((item) => ({
                  title: item.title,
                  url: item.url,
                })),
              }
            : {}),
        };
      }),
    };
  }

  private validateDocument(file?: Express.Multer.File): ValidatedDocument {
    if (!file) {
      throw new BadRequestException('Choose a document to upload.');
    }

    if (file.size === 0 || file.buffer.length === 0) {
      throw new BadRequestException('The document is empty.');
    }

    if (file.size > MAX_KNOWLEDGE_DOCUMENT_BYTES) {
      throw new BadRequestException('The document must be 10 MB or smaller.');
    }

    if (!SUPPORTED_DOCUMENT_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Upload a PDF, DOCX, TXT, Markdown, or HTML document.');
    }

    const name = file.originalname.replace(/\\/g, '/').split('/').pop()?.trim().slice(0, 255);
    if (!name) {
      throw new BadRequestException('The document must have a file name.');
    }

    return {
      name,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    };
  }

  private async findActiveSource(
    organizationId: string,
    sourceId: string,
  ): Promise<PrismaKnowledgeSource> {
    const source = await this.prisma.knowledgeSource.findFirst({
      where: { id: sourceId, organizationId, archivedAt: null },
    });

    if (!source) {
      throw new NotFoundException('Knowledge source not found.');
    }

    return source;
  }

  private async claimSource(
    source: PrismaKnowledgeSource,
    nextStatus: typeof KnowledgeSourceStatus.UPDATING | typeof KnowledgeSourceStatus.REMOVING,
    restoreRemoved = false,
  ): Promise<void> {
    if (
      source.status === KnowledgeSourceStatus.PROCESSING ||
      source.status === KnowledgeSourceStatus.UPDATING ||
      source.status === KnowledgeSourceStatus.REMOVING
    ) {
      throw new ConflictException(SOURCE_BUSY_MESSAGE);
    }

    const result = await this.prisma.knowledgeSource.updateMany({
      where: {
        id: source.id,
        organizationId: source.organizationId,
        archivedAt: restoreRemoved && source.archivedAt ? source.archivedAt : null,
        status: source.status,
        version: source.version,
      },
      data: {
        status: nextStatus,
        errorMessage: null,
        ...(restoreRemoved ? { archivedAt: null } : {}),
      },
    });

    if (result.count !== 1) {
      throw new ConflictException(SOURCE_BUSY_MESSAGE);
    }
  }

  private async finishSourceMutationFailure(
    source: PrismaKnowledgeSource,
    claimedStatus: typeof KnowledgeSourceStatus.UPDATING | typeof KnowledgeSourceStatus.REMOVING,
    finalStatus: KnowledgeSourceStatus,
    errorMessage: string,
  ): Promise<void> {
    await this.prisma.knowledgeSource.updateMany({
      where: {
        id: source.id,
        organizationId: source.organizationId,
        status: claimedStatus,
        archivedAt: null,
      },
      data: { status: finalStatus, errorMessage },
    });
  }

  private async requireRole(
    userId: string,
    organizationId: string,
    allowedRoles: readonly OrgRole[],
    action: string,
  ): Promise<void> {
    const role = await this.organizationsService.getUserRoleInOrganization(userId, organizationId);

    if (!role || !allowedRoles.includes(role)) {
      throw new ForbiddenException(`You do not have permission to ${action}.`);
    }
  }

  private toSourceResponse(source: PrismaKnowledgeSource): KnowledgeSource {
    return {
      id: source.id,
      organizationId: source.organizationId,
      createdById: source.createdById,
      sourceType: source.connectorId ? 'EXTERNAL' : 'DOCUMENT',
      name: source.name,
      mimeType: source.mimeType,
      sizeBytes: source.sizeBytes,
      status: source.status,
      version: source.version,
      lastIndexedAt: source.lastIndexedAt?.toISOString() ?? null,
      errorMessage: source.errorMessage,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
      ...(source.connectorId && source.externalId && source.sourceUrl
        ? {
            origin: {
              connectorId: source.connectorId,
              externalId: source.externalId,
              url: source.sourceUrl,
              itemCount: readSelection(source.selection).items.length,
            },
          }
        : {}),
    };
  }
}
