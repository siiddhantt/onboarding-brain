import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrgRole } from '@prisma/client';
import request from 'supertest';
import type { SourcePreview, SourceRecord } from '@app-starter/shared';
import { AppModule } from '../src/app.module';
import {
  KNOWLEDGE_ENGINE,
  KnowledgeEngine,
} from '../src/common/knowledge/knowledge-engine.interface';
import {
  SOURCE_CONNECTORS,
  SourceConnector,
} from '../src/source-connectors/source-connector.interface';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Curated source imports (e2e)', () => {
  const record = (id: string, text: string): SourceRecord => ({
    id,
    text,
    title: `Reference ${id}`,
    url: `https://knowledge.example.com/${id}`,
    updatedAt: '2026-09-05T00:00:00.000Z',
  });
  let records = [
    record('policy', 'Expenses go through Ramp within 30 days.'),
    record('receipts', 'Receipts are required above $25.'),
    record('chatter', 'Anyone up for coffee?'),
  ];
  const connector: SourceConnector = {
    id: 'fixture',
    describe: () => ({
      id: 'fixture',
      name: 'Test source',
      locatorLabel: 'Collection',
      locatorPlaceholder: '',
      emptyStateHint: '',
      isConfigured: true,
      search: { dateField: 'updatedAt' },
    }),
    readPage: jest.fn(async () => ({
      externalId: 'workspace/collection',
      name: 'Expense policy',
      url: 'https://knowledge.example.com/collection',
      items: records,
      nextCursor: null,
    })),
  };
  const secondConnector: SourceConnector = {
    ...connector,
    id: 'second-fixture',
    describe: (org) => ({ ...connector.describe(org), id: 'second-fixture', search: undefined }),
  };
  let sequence = 0;
  const engine: jest.Mocked<KnowledgeEngine> = {
    isConfigured: jest.fn(() => true),
    ingest: jest.fn().mockImplementation(async () => ({
      providerReference: `import-${++sequence}`,
      providerContainerReference: 'dataset',
    })),
    replace: jest.fn().mockImplementation(async () => ({
      providerReference: `import-${++sequence}`,
      providerContainerReference: 'dataset',
    })),
    remove: jest.fn().mockResolvedValue(undefined),
    ask: jest.fn(),
  };
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let token: string;
  let userId: string;
  let organizationId: string;
  let otherOrganizationId: string;
  const previewKeys: string[] = [];
  const api = (path: string) => `/api/organizations/${organizationId}/brain/${path}`;
  const post = (path: string, data: unknown) =>
    request(app.getHttpServer())
      .post(api(path))
      .set('Authorization', `Bearer ${token}`)
      .send(data as object);
  const preview = async (): Promise<SourcePreview> => {
    const response = await post('imports/preview', {
      connectorId: 'fixture',
      locator: 'collection',
    }).expect(200);
    previewKeys.push(`source-preview:${organizationId}:${userId}:${response.body.id}`);
    return response.body;
  };
  const importSelection = (
    snapshot: SourcePreview,
    selectedIds: string[],
    restoreRemoved = false,
  ) =>
    post('imports', {
      previewId: snapshot.id,
      selectedIds,
      shareWithOrganization: true,
      restoreRemoved,
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KNOWLEDGE_ENGINE)
      .useValue(engine)
      .overrideProvider(SOURCE_CONNECTORS)
      .useValue([connector, secondConnector])
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    const signup = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({
        email: `source-import-e2e-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Source Import Tester',
      })
      .expect(201);
    token = signup.body.accessToken;
    userId = signup.body.user.id;
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    for (const name of ['Import test', 'Other import test']) {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({ name })
        .expect(201);
      if (!organizationId) organizationId = response.body.id;
      else otherOrganizationId = response.body.id;
    }
  });
  afterAll(async () => {
    for (const key of previewKeys) await redis.del(key);
    const ids = [organizationId, otherOrganizationId].filter(Boolean);
    await prisma.knowledgeSource.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await app.close();
  });

  it('previews, selects, deduplicates, cites, revises, removes and explicitly restores a source', async () => {
    const first = await preview();
    expect(first.selectedIds).toEqual([]);
    expect(first.items).toHaveLength(3);
    expect(engine.ingest).not.toHaveBeenCalled();
    await importSelection(first, ['forged-id']).expect(400);
    await post('imports', {
      previewId: first.id,
      selectedIds: ['policy'],
      shareWithOrganization: false,
    }).expect(400);

    const imported = await importSelection(first, ['policy', 'receipts']).expect(200);
    const sourceId = imported.body.id;
    expect(imported.body).toMatchObject({
      sourceType: 'EXTERNAL',
      status: 'READY',
      version: 1,
      origin: { connectorId: 'fixture', itemCount: 2 },
    });
    const content = engine.ingest.mock.calls[0][0].content;
    expect(content).toMatchObject({
      kind: 'text',
      text: expect.stringContaining('Receipts are required'),
    });
    expect(JSON.stringify(content)).not.toContain('coffee');
    await importSelection(first, ['policy', 'receipts'])
      .expect(200)
      .expect((response) => expect(response.body.version).toBe(1));
    expect(engine.ingest).toHaveBeenCalledTimes(1);

    records = [
      record('policy', 'Expenses now need to be submitted within 14 days.'),
      records[1],
      records[2],
    ];
    const revised = await preview();
    expect(revised.selectedIds.sort()).toEqual(['policy', 'receipts']);
    const replaced = await importSelection(revised, ['policy']).expect(200);
    expect(replaced.body).toMatchObject({
      id: sourceId,
      version: 2,
      status: 'READY',
      origin: { itemCount: 1 },
    });
    expect(engine.replace.mock.calls[0][0].content).toMatchObject({
      text: expect.stringContaining('14 days'),
    });
    expect(JSON.stringify(engine.replace.mock.calls[0][0].content)).not.toContain(
      'Receipts are required',
    );
    const persisted = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });
    expect(persisted.selection).toMatchObject({
      excludedIds: expect.arrayContaining(['receipts', 'chatter']),
    });
    await importSelection(first, ['policy', 'receipts']).expect(409);
    expect(engine.replace).toHaveBeenCalledTimes(1);

    engine.ask.mockResolvedValueOnce({
      status: 'ANSWERED',
      answer: 'Submit within 14 days.',
      citations: [
        { referenceId: persisted.providerReference, label: null, excerpt: '14 days', score: null },
      ],
    });
    const answer = await post('questions', { question: 'When are expenses due?' }).expect(200);
    expect(answer.body.citations[0]).toMatchObject({
      sourceId,
      sourceUrl: 'https://knowledge.example.com/collection',
      sourceLinks: [{ title: 'Reference policy', url: 'https://knowledge.example.com/policy' }],
    });

    const beforeRemoval = await preview();
    expect(beforeRemoval.selectedIds).toEqual(['policy']);
    await request(app.getHttpServer())
      .delete(api(`sources/${sourceId}`))
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    const removed = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: sourceId } });
    expect(removed.archivedAt).not.toBeNull();
    expect(removed.selection).toBeNull();
    expect(removed.providerReference).toBeNull();
    await importSelection(beforeRemoval, ['policy']).expect(409);
    const restore = await preview();
    expect(restore.wasRemoved).toBe(true);
    expect(restore.selectedIds).toEqual([]);
    await importSelection(restore, ['policy']).expect(409);
    await importSelection(restore, ['policy'], true)
      .expect(200)
      .expect((response) =>
        expect(response.body).toMatchObject({ id: sourceId, version: 3, status: 'READY' }),
      );
    expect(engine.ingest).toHaveBeenCalledTimes(2);
  });

  it('enforces manager roles, tenant-bound previews, expiration and provider-neutral identities', async () => {
    const snapshot = await preview();
    const calls = (connector.readPage as jest.Mock).mock.calls.length;
    await prisma.organizationMember.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role: OrgRole.MEMBER },
    });
    await post('imports/preview', { connectorId: 'fixture', locator: 'collection' }).expect(403);
    await importSelection(snapshot, ['policy']).expect(403);
    expect(connector.readPage).toHaveBeenCalledTimes(calls);
    await request(app.getHttpServer())
      .get(api('sources'))
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await prisma.organizationMember.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role: OrgRole.OWNER },
    });

    await request(app.getHttpServer())
      .post(`/api/organizations/${otherOrganizationId}/brain/imports`)
      .set('Authorization', `Bearer ${token}`)
      .send({ previewId: snapshot.id, selectedIds: ['policy'], shareWithOrganization: true })
      .expect(404);
    await redis.del(`source-preview:${organizationId}:${userId}:${snapshot.id}`);
    await importSelection(snapshot, ['policy']).expect(404);

    const second = await post('imports/preview', {
      connectorId: 'second-fixture',
      locator: 'collection',
    }).expect(200);
    previewKeys.push(`source-preview:${organizationId}:${userId}:${second.body.id}`);
    await importSelection(second.body, ['receipts'])
      .expect(200)
      .expect((response) => expect(response.body.origin.connectorId).toBe('second-fixture'));
    expect(
      await prisma.knowledgeSource.count({
        where: { organizationId, externalId: 'workspace/collection', archivedAt: null },
      }),
    ).toBe(2);
  });

  it('binds pagination to the preview and refreshes saved items without selecting new ones', async () => {
    const page = {
      externalId: 'workspace/collection',
      name: 'Expense policy',
      url: 'https://knowledge.example.com/collection',
      items: [record('new', 'New onboarding guidance.')],
      nextCursor: 'older',
    };
    jest.mocked(connector.readPage).mockResolvedValueOnce(page);
    const first = await preview();
    expect(first.selectedIds).toEqual(['policy']);
    expect(first.savedItemIds).toEqual(['policy']);
    const calls = jest.mocked(connector.readPage).mock.calls.length;
    const input = { connectorId: 'fixture', locator: 'collection', previewId: first.id };
    await post('imports/preview', { ...input, cursor: 'forged' }).expect(400);
    expect(connector.readPage).toHaveBeenCalledTimes(calls);

    jest.mocked(connector.readPage).mockResolvedValueOnce({
      ...page,
      items: [record('policy', 'Refreshed policy from an older page.')],
      nextCursor: null,
    });
    const next = await post('imports/preview', { ...input, cursor: 'older' }).expect(200);
    previewKeys.push(`source-preview:${organizationId}:${userId}:${next.body.id}`);
    expect(next.body.selectedIds).toEqual(['policy']);
    expect(next.body.savedItemIds).toEqual([]);
    expect(next.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'policy', text: 'Refreshed policy from an older page.' }),
        expect.objectContaining({ id: 'new' }),
      ]),
    );

    jest.mocked(connector.readPage).mockResolvedValueOnce({ ...page, url: 'javascript:alert(1)' });
    await post('imports/preview', { connectorId: 'fixture', locator: 'collection' }).expect(502);
  });

  it('keeps the selection basket across native queries but binds each cursor to its query', async () => {
    const first = await preview();
    const input = { connectorId: 'fixture', locator: 'collection', previewId: first.id };
    const calls = jest.mocked(connector.readPage).mock.calls.length;
    await post('imports/preview', { ...input, query: { from: 'not-a-date' } }).expect(400);
    await post('imports/preview', {
      ...input,
      query: { from: '2026-09-06', to: '2026-09-05' },
    }).expect(400);
    await post('imports/preview', {
      connectorId: 'second-fixture',
      locator: 'collection',
      query: { text: 'coffee' },
    }).expect(400);
    expect(connector.readPage).toHaveBeenCalledTimes(calls);
    const query = { text: 'coffee' };
    const page = {
      externalId: first.externalId,
      name: first.name,
      url: first.url,
      items: [record('coffee-match', 'Coffee guide')],
      nextCursor: 'next-result',
    };
    jest.mocked(connector.readPage).mockResolvedValueOnce(page);
    const searched = (await post('imports/preview', { ...input, query }).expect(200)).body;
    previewKeys.push(`source-preview:${organizationId}:${userId}:${searched.id}`);
    expect(searched.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'policy' })]),
    );
    expect(searched.selectedIds).toEqual(['policy']);
    expect(searched.resultIds).toEqual(['coffee-match']);
    await post('imports/preview', {
      ...input,
      previewId: searched.id,
      cursor: 'next-result',
      query: { text: 'different' },
    }).expect(400);
    jest
      .mocked(connector.readPage)
      .mockResolvedValueOnce({
        ...page,
        items: [record('match-2', 'Another coffee guide')],
        nextCursor: null,
      });
    const next = (
      await post('imports/preview', {
        ...input,
        previewId: searched.id,
        cursor: 'next-result',
        query,
      }).expect(200)
    ).body;
    previewKeys.push(`source-preview:${organizationId}:${userId}:${next.id}`);
    expect(next.resultIds).toEqual(['coffee-match', 'match-2']);
    expect(next.items).toHaveLength(new Set(next.items.map((item: SourceRecord) => item.id)).size);
    await importSelection(next, ['policy']).expect(200);
  });

  it('bounds incremental previews without fetching beyond the cap or losing saved items', async () => {
    let snapshot: SourcePreview | undefined;
    for (let page = 0; page < 5; page++) {
      const count = page === 4 ? 99 : 100;
      jest.mocked(connector.readPage).mockResolvedValueOnce({
        externalId: 'workspace/collection',
        name: 'Bounded preview',
        url: 'https://knowledge.example.com/collection',
        items: Array.from({ length: count }, (_, index) =>
          record(`page-${page}-${index}`, 'Preview content'),
        ),
        nextCursor: `page-${page + 1}`,
      });
      const response = await post('imports/preview', {
        connectorId: 'fixture',
        locator: 'collection',
        ...(snapshot ? { previewId: snapshot.id, cursor: snapshot.nextCursor } : {}),
      }).expect(200);
      snapshot = response.body;
      previewKeys.push(`source-preview:${organizationId}:${userId}:${snapshot!.id}`);
    }
    expect(snapshot!.items).toHaveLength(500);
    expect(snapshot!.selectedIds).toEqual(['policy']);
    expect(snapshot!.limitReached).toBe(true);
    expect(snapshot!.nextCursor).toBeNull();
    expect(connector.readPage).toHaveBeenLastCalledWith(
      organizationId,
      'collection',
      expect.objectContaining({ limit: 99 }),
    );
    const calls = jest.mocked(connector.readPage).mock.calls.length;
    await post('imports/preview', {
      connectorId: 'fixture',
      locator: 'collection',
      previewId: snapshot!.id,
      query: { text: 'more' },
    }).expect(400);
    expect(connector.readPage).toHaveBeenCalledTimes(calls);
  });
});
