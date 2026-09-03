import {
  BadRequestException,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { KnowledgeSourceStatus, OrgRole } from '@prisma/client';
import type { KnowledgeEngine } from '../common/knowledge/knowledge-engine.interface';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { CompanyBrainService } from './company-brain.service';

describe('CompanyBrainService', () => {
  const organizationId = 'org-1';
  const userId = 'user-1';
  const createdAt = new Date('2026-09-03T06:00:00.000Z');

  const buildSource = (overrides: Record<string, unknown> = {}) => ({
    id: 'source-1',
    organizationId,
    createdById: userId,
    sourceType: 'DOCUMENT',
    name: 'Employee handbook.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    status: KnowledgeSourceStatus.PROCESSING,
    providerReference: null,
    errorMessage: null,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });

  const buildFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'Employee handbook.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('document'),
      stream: null as never,
      destination: '',
      filename: '',
      path: '',
      ...overrides,
    }) as Express.Multer.File;

  let prisma: any;
  let organizationsService: { getUserRoleInOrganization: jest.Mock };
  let knowledgeEngine: jest.Mocked<KnowledgeEngine>;
  let service: CompanyBrainService;

  beforeEach(() => {
    prisma = {
      knowledgeSource: {
        create: jest.fn().mockResolvedValue(buildSource()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve(
            buildSource({
              ...data,
              updatedAt: new Date('2026-09-03T06:01:00.000Z'),
            }),
          ),
        ),
      },
    };
    organizationsService = {
      getUserRoleInOrganization: jest.fn().mockResolvedValue(OrgRole.ADMIN),
    };
    knowledgeEngine = {
      isConfigured: jest.fn().mockReturnValue(true),
      ingest: jest.fn().mockResolvedValue({ providerReference: 'document-1' }),
      ask: jest.fn().mockResolvedValue({
        status: 'ANSWERED',
        answer: 'Use the finance portal.',
        citations: [
          {
            referenceId: 'document-1',
            label: 'Fallback label',
            excerpt: 'Submit within 30 days.',
            score: 0.9,
          },
        ],
      }),
    };
    service = new CompanyBrainService(
      prisma as PrismaService,
      organizationsService as unknown as OrganizationsService,
      knowledgeEngine,
    );
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('returns engine configuration to organization members', async () => {
      organizationsService.getUserRoleInOrganization.mockResolvedValue(OrgRole.MEMBER);

      await expect(service.getStatus(userId, organizationId)).resolves.toEqual({
        isConfigured: true,
      });
    });

    it('does not reveal engine configuration to non-members', async () => {
      organizationsService.getUserRoleInOrganization.mockResolvedValue(null);

      await expect(service.getStatus(userId, organizationId)).rejects.toThrow(ForbiddenException);
      expect(knowledgeEngine.isConfigured).not.toHaveBeenCalled();
    });
  });

  describe('listSources', () => {
    it('lists only active sources from the requested organization', async () => {
      prisma.knowledgeSource.findMany.mockResolvedValue([buildSource()]);

      const actual = await service.listSources(userId, organizationId);

      expect(prisma.knowledgeSource.findMany).toHaveBeenCalledWith({
        where: { organizationId, archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(actual.total).toBe(1);
      expect(actual.items[0]).toMatchObject({ id: 'source-1', status: 'PROCESSING' });
    });
  });

  describe('uploadDocument', () => {
    it('indexes a validated document and records the provider reference', async () => {
      const file = buildFile();

      const actual = await service.uploadDocument(userId, organizationId, file);

      expect(prisma.knowledgeSource.create).toHaveBeenCalledWith({
        data: {
          organizationId,
          createdById: userId,
          sourceType: 'DOCUMENT',
          name: 'Employee handbook.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          status: KnowledgeSourceStatus.PROCESSING,
        },
      });
      expect(knowledgeEngine.ingest).toHaveBeenCalledWith({
        organizationId,
        content: {
          kind: 'binary',
          bytes: file.buffer,
          fileName: 'Employee handbook.pdf',
          mimeType: 'application/pdf',
        },
      });
      expect(prisma.knowledgeSource.update).toHaveBeenCalledWith({
        where: { id: 'source-1' },
        data: {
          status: KnowledgeSourceStatus.READY,
          providerReference: 'document-1',
          errorMessage: null,
        },
      });
      expect(actual.status).toBe('READY');
    });

    it('marks the source failed without exposing the provider error', async () => {
      knowledgeEngine.ingest.mockRejectedValue(new Error('provider secret and stack'));

      const actual = await service.uploadDocument(userId, organizationId, buildFile());

      expect(prisma.knowledgeSource.update).toHaveBeenCalledWith({
        where: { id: 'source-1' },
        data: {
          status: KnowledgeSourceStatus.FAILED,
          errorMessage: 'The document could not be indexed. Try uploading it again.',
        },
      });
      expect(actual).toMatchObject({
        status: 'FAILED',
        errorMessage: 'The document could not be indexed. Try uploading it again.',
      });
    });

    it('rejects unsupported documents before creating a source', async () => {
      const file = buildFile({ mimetype: 'image/png', originalname: 'screenshot.png' });

      await expect(service.uploadDocument(userId, organizationId, file)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.knowledgeSource.create).not.toHaveBeenCalled();
    });

    it('rejects uploads when the engine is not configured', async () => {
      knowledgeEngine.isConfigured.mockReturnValue(false);

      await expect(service.uploadDocument(userId, organizationId, buildFile())).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(prisma.knowledgeSource.create).not.toHaveBeenCalled();
    });

    it('allows only owners and admins to add sources', async () => {
      organizationsService.getUserRoleInOrganization.mockResolvedValue(OrgRole.MEMBER);

      await expect(service.uploadDocument(userId, organizationId, buildFile())).rejects.toThrow(
        ForbiddenException,
      );
      expect(knowledgeEngine.isConfigured).not.toHaveBeenCalled();
    });

    it('strips browser-supplied paths from document names', async () => {
      await service.uploadDocument(
        userId,
        organizationId,
        buildFile({ originalname: 'C:\\Users\\Ada\\handbook.pdf' }),
      );

      expect(prisma.knowledgeSource.create.mock.calls[0][0].data.name).toBe('handbook.pdf');
    });
  });

  describe('ask', () => {
    it('lets a member ask and resolves citations within the same organization', async () => {
      organizationsService.getUserRoleInOrganization.mockResolvedValue(OrgRole.MEMBER);
      prisma.knowledgeSource.findMany.mockResolvedValue([
        buildSource({ status: KnowledgeSourceStatus.READY, providerReference: 'document-1' }),
      ]);

      const actual = await service.ask(userId, organizationId, 'How do expenses work?');

      expect(knowledgeEngine.ask).toHaveBeenCalledWith(organizationId, 'How do expenses work?');
      expect(prisma.knowledgeSource.findMany).toHaveBeenCalledWith({
        where: {
          organizationId,
          archivedAt: null,
          providerReference: { in: ['document-1'] },
        },
      });
      expect(actual.citations[0]).toEqual({
        sourceId: 'source-1',
        sourceName: 'Employee handbook.pdf',
        excerpt: 'Submit within 30 days.',
        score: 0.9,
      });
    });

    it('uses the provider label when no local source matches', async () => {
      const actual = await service.ask(userId, organizationId, 'How do expenses work?');

      expect(actual.citations[0]).toMatchObject({
        sourceId: null,
        sourceName: 'Fallback label',
      });
    });

    it('rejects questions before calling an unconfigured engine', async () => {
      knowledgeEngine.isConfigured.mockReturnValue(false);

      await expect(service.ask(userId, organizationId, 'How do expenses work?')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(knowledgeEngine.ask).not.toHaveBeenCalled();
    });

    it('does not expose knowledge-provider failures', async () => {
      knowledgeEngine.ask.mockRejectedValue(new Error('provider secret and stack'));

      await expect(service.ask(userId, organizationId, 'How do expenses work?')).rejects.toThrow(
        'The company brain could not answer right now. Try again.',
      );
    });

    it('does not allow a non-member to query another organization', async () => {
      organizationsService.getUserRoleInOrganization.mockResolvedValue(null);

      await expect(
        service.ask(userId, 'another-org', 'What is the holiday policy?'),
      ).rejects.toThrow(ForbiddenException);
      expect(knowledgeEngine.ask).not.toHaveBeenCalled();
    });
  });
});
