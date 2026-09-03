import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  KnowledgeSource as PrismaKnowledgeSource,
  KnowledgeSourceStatus,
  OrgRole,
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
} from '../common/knowledge/knowledge-engine.interface';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';

const MANAGE_ROLES: readonly OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN];
const MEMBER_ROLES: readonly OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER];
const FAILED_INGESTION_MESSAGE = 'The document could not be indexed. Try uploading it again.';
const FAILED_QUESTION_MESSAGE = 'The company brain could not answer right now. Try again.';
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

    try {
      const result = await this.knowledgeEngine.ingest({
        organizationId,
        content: {
          kind: 'binary',
          bytes: document.buffer,
          fileName: document.name,
          mimeType: document.mimetype,
        },
      });
      const readySource = await this.prisma.knowledgeSource.update({
        where: { id: source.id },
        data: {
          status: KnowledgeSourceStatus.READY,
          providerReference: result.providerReference,
          errorMessage: null,
        },
      });

      return this.toSourceResponse(readySource);
    } catch (error) {
      this.logger.error(
        `Failed to index knowledge source ${source.id}`,
        error instanceof Error ? error.stack : String(error),
      );

      const failedSource = await this.prisma.knowledgeSource.update({
        where: { id: source.id },
        data: {
          status: KnowledgeSourceStatus.FAILED,
          errorMessage: FAILED_INGESTION_MESSAGE,
        },
      });

      return this.toSourceResponse(failedSource);
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
      sourceType: 'DOCUMENT',
      name: source.name,
      mimeType: source.mimeType,
      sizeBytes: source.sizeBytes,
      status: source.status,
      errorMessage: source.errorMessage,
      createdAt: source.createdAt.toISOString(),
      updatedAt: source.updatedAt.toISOString(),
    };
  }
}
