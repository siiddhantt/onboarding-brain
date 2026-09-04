import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeSourceStatus } from '@prisma/client';
import request from 'supertest';
import {
  KNOWLEDGE_ENGINE,
  KnowledgeEngine,
} from '../src/common/knowledge/knowledge-engine.interface';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CompanyBrainController (e2e)', () => {
  const providerReference = 'provider-document-1';
  const testRun = Date.now();
  const testEmail = `test-e2e-company-brain-${testRun}@example.com`;
  const knowledgeEngine: jest.Mocked<KnowledgeEngine> = {
    isConfigured: jest.fn().mockReturnValue(true),
    ingest: jest.fn().mockResolvedValue({
      providerReference,
      providerContainerReference: 'provider-dataset-1',
    }),
    replace: jest.fn().mockResolvedValue({
      providerReference: 'provider-document-2',
      providerContainerReference: 'provider-dataset-1',
    }),
    remove: jest.fn().mockResolvedValue(undefined),
    ask: jest.fn().mockResolvedValue({
      status: 'ANSWERED',
      answer: 'Submit the form through the finance portal.',
      citations: [
        {
          referenceId: providerReference,
          label: 'Provider fallback',
          excerpt: 'Expense reports are due within 30 days.',
          score: 0.94,
        },
      ],
    }),
  };

  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KNOWLEDGE_ENGINE)
      .useValue(knowledgeEngine)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    const signupResponse = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        email: testEmail,
        password: 'TestPassword123!',
        name: 'Company Brain Test User',
      })
      .expect(201);

    authToken = signupResponse.body.accessToken;
    userId = signupResponse.body.user.id;
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });

    const organizationResponse = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: `Company Brain E2E ${testRun}` })
      .expect(201);
    organizationId = organizationResponse.body.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.knowledgeSource.deleteMany({ where: { organizationId } });
      await prisma.organizationMember.deleteMany({ where: { organizationId } });
      await prisma.organization.deleteMany({ where: { id: organizationId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.$disconnect();
    }
    await app.close();
  });

  it('requires authentication before revealing company brain status', () => {
    return request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}/brain/status`)
      .expect(401);
  });

  it('reports whether the organization knowledge engine is configured', () => {
    return request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}/brain/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect({ isConfigured: true });
  });

  it('uploads, indexes, lists, cites, replaces, and removes an organization document', async () => {
    const uploadResponse = await request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/brain/sources/documents`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from('Expense reports are due within 30 days.'), {
        filename: 'expense-policy.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(uploadResponse.body).toMatchObject({
      organizationId,
      createdById: userId,
      name: 'expense-policy.txt',
      status: KnowledgeSourceStatus.READY,
      version: 1,
    });
    expect(knowledgeEngine.ingest).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        content: expect.objectContaining({
          kind: 'binary',
          fileName: 'expense-policy.txt',
          mimeType: 'text/plain',
        }),
      }),
    );

    const listResponse = await request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}/brain/sources`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(listResponse.body).toMatchObject({
      total: 1,
      items: [
        {
          id: uploadResponse.body.id,
          organizationId,
          name: 'expense-policy.txt',
          status: KnowledgeSourceStatus.READY,
        },
      ],
    });

    const answerResponse = await request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/brain/questions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question: '  How do I submit an expense report?  ' })
      .expect(200);
    expect(knowledgeEngine.ask).toHaveBeenCalledWith(
      organizationId,
      'How do I submit an expense report?',
    );
    expect(answerResponse.body).toEqual({
      status: 'ANSWERED',
      answer: 'Submit the form through the finance portal.',
      citations: [
        {
          sourceId: uploadResponse.body.id,
          sourceName: 'expense-policy.txt',
          excerpt: 'Expense reports are due within 30 days.',
          score: 0.94,
        },
      ],
    });

    const replaceResponse = await request(app.getHttpServer())
      .put(`/api/organizations/${organizationId}/brain/sources/${uploadResponse.body.id}/content`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from('Expense reports are now due within 14 days.'), {
        filename: 'expense-policy-v2.txt',
        contentType: 'text/plain',
      })
      .expect(200);
    expect(knowledgeEngine.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId,
        providerReference,
        providerContainerReference: 'provider-dataset-1',
        content: expect.objectContaining({ fileName: 'expense-policy-v2.txt' }),
      }),
    );
    expect(replaceResponse.body).toMatchObject({
      id: uploadResponse.body.id,
      name: 'expense-policy-v2.txt',
      status: KnowledgeSourceStatus.READY,
      version: 2,
    });

    await request(app.getHttpServer())
      .delete(`/api/organizations/${organizationId}/brain/sources/${uploadResponse.body.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);
    expect(knowledgeEngine.remove).toHaveBeenCalledWith({
      organizationId,
      providerReference: 'provider-document-2',
      providerContainerReference: 'provider-dataset-1',
    });

    const emptyListResponse = await request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}/brain/sources`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    expect(emptyListResponse.body).toEqual({ items: [], total: 0 });
  });

  it('rejects questions that become too short after trimming', () => {
    return request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/brain/questions`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ question: '  ?  ' })
      .expect(400);
  });
});
