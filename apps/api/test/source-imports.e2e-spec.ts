import { ForbiddenException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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
import { ConnectionCredentials } from '../src/source-connectors/connections/connection-credentials.service';

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
      connectionFields: [],
      credentialLabel: 'Token',
      canDiscoverLocations: false,
      search: { dateField: 'updatedAt' },
    }),
    verify: jest.fn(async () => ({
      externalAccountId: 'workspace',
      accountName: 'Team workspace',
      config: { workspace: 'team' },
    })),
    resolveLocation: jest.fn(async () => ({
      externalId: 'workspace/collection',
      locator: 'collection',
      name: 'Expense policy',
      url: 'https://knowledge.example.com/collection',
    })),
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
    describe: () => ({ ...connector.describe(), id: 'second-fixture', search: undefined }),
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
  let connectionId: string;
  let locationId: string;
  let secondLocationId: string;
  const previewKeys: string[] = [];
  const api = (path: string) => `/api/organizations/${organizationId}/brain/${path}`;
  const post = (path: string, data: unknown) =>
    request(app.getHttpServer())
      .post(api(path))
      .set('Authorization', `Bearer ${token}`)
      .send(data as object);
  const preview = async (): Promise<SourcePreview> => {
    const response = await post('imports/preview', {
      locationId,
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
      .overrideProvider(ConnectionCredentials)
      .useValue(
        new ConnectionCredentials(
          new ConfigService({ SOURCE_CREDENTIALS_ENCRYPTION_KEY: 'ab'.repeat(32) }),
        ),
      )
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    // Keep one server open: repeatedly binding ephemeral listeners can reuse stale
    // keep-alive sockets under Node 24 and obscure request assertions with parse errors.
    await app.listen(0, '127.0.0.1');
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
    for (const provider of ['fixture', 'second-fixture']) {
      const connected = await post('connections', {
        connectorId: provider,
        name: 'Team source',
        config: { workspace: 'team' },
        credential: 'test-credential',
      }).expect(201);
      const saved = await post(`connections/${connected.body.id}/locations`, {
        locator: 'collection',
        expectedRevision: 1,
      }).expect(201);
      if (provider === 'fixture') {
        connectionId = connected.body.id;
        locationId = saved.body.id;
      } else secondLocationId = saved.body.id;
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
    await post('imports/preview', { locationId }).expect(403);
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
      locationId: secondLocationId,
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
    const input = { locationId, previewId: first.id };
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
    await post('imports/preview', { locationId }).expect(502);
  });

  it('keeps the selection basket across native queries but binds each cursor to its query', async () => {
    const first = await preview();
    const input = { locationId, previewId: first.id };
    const calls = jest.mocked(connector.readPage).mock.calls.length;
    await post('imports/preview', { ...input, query: { from: 'not-a-date' } }).expect(400);
    await post('imports/preview', {
      ...input,
      query: { from: '2026-09-06', to: '2026-09-05' },
    }).expect(400);
    await post('imports/preview', {
      locationId: secondLocationId,
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
    jest.mocked(connector.readPage).mockResolvedValueOnce({
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
        locationId,
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
      { config: { workspace: 'team' }, credential: 'test-credential' },
      'collection',
      expect.objectContaining({ limit: 99 }),
    );
    const calls = jest.mocked(connector.readPage).mock.calls.length;
    await post('imports/preview', {
      locationId,
      previewId: snapshot!.id,
      query: { text: 'more' },
    }).expect(400);
    expect(connector.readPage).toHaveBeenCalledTimes(calls);
  });

  it('keeps connection credentials write-only and rejects cross-tenant IDs even for an owner of both organizations', async () => {
    const listed = await request(app.getHttpServer())
      .get(api('connections'))
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body.find((item: { id: string }) => item.id === connectionId)).toMatchObject({
      status: 'ACTIVE',
      locations: [{ id: locationId }],
    });
    expect(JSON.stringify(listed.body)).not.toMatch(/credential|test-credential/i);
    const stored = await prisma.sourceConnection.findFirstOrThrow({
      where: { id: connectionId, organizationId },
    });
    expect(stored.encryptedCredential).not.toContain('test-credential');
    expect(stored.config).toEqual({ workspace: 'team' });
    const otherApi = `/api/organizations/${otherOrganizationId}/brain`;
    await request(app.getHttpServer())
      .get(`${otherApi}/connections`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200, []);
    await request(app.getHttpServer())
      .get(`${otherApi}/connections/${connectionId}/discover`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`${otherApi}/connections/${connectionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Forged', credential: 'forged', expectedRevision: 1 })
      .expect(404);
    for (const [path, data] of [
      [`connections/${connectionId}/disconnect`, { expectedRevision: 1 }],
      [`connections/${connectionId}/locations`, { locator: 'collection', expectedRevision: 1 }],
      ['imports/preview', { locationId }],
    ] as const)
      await request(app.getHttpServer())
        .post(`${otherApi}/${path}`)
        .set('Authorization', `Bearer ${token}`)
        .send(data)
        .expect(404);
    await request(app.getHttpServer())
      .delete(`${otherApi}/locations/${locationId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await expect(
      prisma.sourceLocation.create({
        data: {
          organizationId: otherOrganizationId,
          connectionId,
          externalId: 'forged',
          name: 'Forged',
          locator: 'forged',
          url: 'https://example.com',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    const secondTenant = await request(app.getHttpServer())
      .post(`${otherApi}/connections`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        connectorId: 'fixture',
        name: 'Other team',
        config: {},
        credential: 'other-team-token',
      })
      .expect(201);
    expect(secondTenant.body.id).not.toBe(connectionId);
  });

  it('rejects every connection management action from an ordinary member', async () => {
    await prisma.organizationMember.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role: OrgRole.MEMBER },
    });
    const verifications = jest.mocked(connector.verify).mock.calls.length;
    await request(app.getHttpServer())
      .get(api('connections'))
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await post('connections', {
      connectorId: 'fixture',
      name: 'Unauthorized',
      config: {},
      credential: 'secret',
    }).expect(403);
    await request(app.getHttpServer())
      .patch(api(`connections/${connectionId}`))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Unauthorized', expectedRevision: 1 })
      .expect(403);
    await post(`connections/${connectionId}/disconnect`, { expectedRevision: 1 }).expect(403);
    await post(`connections/${connectionId}/locations`, {
      locator: 'collection',
      expectedRevision: 1,
    }).expect(403);
    await request(app.getHttpServer())
      .get(api(`connections/${connectionId}/discover`))
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .delete(api(`locations/${locationId}`))
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(connector.verify).toHaveBeenCalledTimes(verifications);
    await prisma.organizationMember.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role: OrgRole.OWNER },
    });
  });

  it('rotates credentials without changing saved locations, and invalidates previews before indexing', async () => {
    const snapshot = await preview();
    const old = await prisma.sourceConnection.findFirstOrThrow({
      where: { id: connectionId, organizationId },
    });
    const update = (data: object) =>
      request(app.getHttpServer())
        .patch(api(`connections/${connectionId}`))
        .set('Authorization', `Bearer ${token}`)
        .send(data);
    jest
      .mocked(connector.verify)
      .mockRejectedValueOnce(new ForbiddenException('Credential rejected'));
    await update({ name: old.name, credential: 'bad-token', expectedRevision: 1 }).expect(403);
    expect(
      (
        await prisma.sourceConnection.findFirstOrThrow({
          where: { id: connectionId, organizationId },
        })
      ).encryptedCredential,
    ).toBe(old.encryptedCredential);
    const rotated = await update({
      name: 'Renamed source',
      credential: 'rotated-token',
      expectedRevision: 1,
    }).expect(200);
    expect(rotated.body).toMatchObject({
      revision: 2,
      name: 'Renamed source',
      locations: [{ id: locationId }],
    });
    expect(JSON.stringify(rotated.body)).not.toContain('rotated-token');
    await update({ name: 'Stale update', credential: 'stale-token', expectedRevision: 1 }).expect(
      409,
    );
    const ingestions = engine.ingest.mock.calls.length;
    const replacements = engine.replace.mock.calls.length;
    await importSelection(snapshot, ['policy']).expect(409);
    await post('imports/preview', { locationId, previewId: snapshot.id }).expect(409);
    await preview();
    expect(connector.readPage).toHaveBeenLastCalledWith(
      { config: { workspace: 'team' }, credential: 'rotated-token' },
      'collection',
      expect.any(Object),
    );
    expect(engine.ingest).toHaveBeenCalledTimes(ingestions);
    expect(engine.replace).toHaveBeenCalledTimes(replacements);
  });

  it('disconnects and forgets shortcuts without deleting approved knowledge, then reconnects to the same identity', async () => {
    const snapshot = await preview();
    const before = await prisma.knowledgeSource.findMany({
      where: { organizationId },
      orderBy: { id: 'asc' },
    });
    const disconnected = await post(`connections/${connectionId}/disconnect`, {
      expectedRevision: 2,
    }).expect(200);
    expect(disconnected.body).toMatchObject({
      status: 'DISCONNECTED',
      revision: 3,
      locations: [{ id: locationId }],
    });
    expect(
      (
        await prisma.sourceConnection.findFirstOrThrow({
          where: { id: connectionId, organizationId },
        })
      ).encryptedCredential,
    ).toBeNull();
    await post('imports/preview', { locationId }).expect(409);
    await importSelection(snapshot, ['policy']).expect(409);
    await post('connections', {
      connectorId: 'fixture',
      name: 'Duplicate',
      config: {},
      credential: 'token',
    }).expect(409);
    await request(app.getHttpServer())
      .patch(api(`connections/${connectionId}`))
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Reconnected', credential: 'reconnected-token', expectedRevision: 3 })
      .expect(200);
    await importSelection(snapshot, ['policy']).expect(409);
    const reconnected = await preview();
    expect(reconnected.sourceId).toBe(snapshot.sourceId);
    expect(reconnected.selectedIds).toEqual(snapshot.selectedIds);
    await request(app.getHttpServer())
      .delete(api(`locations/${locationId}`))
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await post('imports/preview', { locationId }).expect(404);
    await importSelection(reconnected, ['policy']).expect(404);
    const restored = await post(`connections/${connectionId}/locations`, {
      locator: 'collection',
      expectedRevision: 4,
    }).expect(201);
    expect(restored.body.id).toBe(locationId);
    await importSelection(reconnected, ['policy']).expect(409);
    expect(
      await prisma.knowledgeSource.findMany({ where: { organizationId }, orderBy: { id: 'asc' } }),
    ).toEqual(before);
  });

  it('does not save a location if the connection is disconnected during provider verification', async () => {
    jest.mocked(connector.resolveLocation).mockImplementationOnce(async () => {
      await post(`connections/${connectionId}/disconnect`, { expectedRevision: 4 }).expect(200);
      return {
        externalId: 'workspace/racing',
        locator: 'racing',
        name: 'Racing location',
        url: 'https://example.com/racing',
      };
    });
    await post(`connections/${connectionId}/locations`, {
      locator: 'racing',
      expectedRevision: 4,
    }).expect(409);
    expect(
      await prisma.sourceLocation.count({
        where: { organizationId, externalId: 'workspace/racing' },
      }),
    ).toBe(0);
  });
});
