import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface TestAccount {
  id: string;
  email: string;
  token: string;
}

describe('Organization membership boundaries (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: TestAccount;
  let member: TestAccount;
  let outsider: TestAccount;
  let organizationId: string;
  let otherOrganizationId: string;
  let departmentId: string;
  let otherDepartmentId: string;
  let foreignMembershipId: string;
  const userIds: string[] = [];
  const organizationIds: string[] = [];

  const signup = async (name = 'Sid'): Promise<TestAccount> => {
    const email = `test-e2e-membership-${randomUUID()}@example.com`;
    const { body } = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send({ name, email, password: 'TestPassword123!' })
      .expect(201);
    userIds.push(body.user.id);
    await prisma.user.update({
      where: { id: body.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    return { id: body.user.id, email, token: body.accessToken };
  };

  const createOrganization = async (account: TestAccount) => {
    const { body } = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ name: 'Membership boundary test' })
      .expect(201);
    organizationIds.push(body.id);
    return body.id as string;
  };

  const invite = async (email?: string) => {
    const { body } = await request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/invites`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email, role: 'MEMBER' })
      .expect(201);
    return body.token as string;
  };

  const accept = (account: TestAccount, token: string) =>
    request(app.getHttpServer())
      .post('/api/invites/accept')
      .set('Authorization', `Bearer ${account.token}`)
      .send({ token });

  const getMembers = async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}/users`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    return body.users as {
      id: string;
      userId: string;
      organizationId: string;
      user: { email: string };
    }[];
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
    prisma = module.get(PrismaService);
    owner = await signup('Owner');
    member = await signup();
    outsider = await signup();
    organizationId = await createOrganization(owner);
    otherOrganizationId = await createOrganization(outsider);
    await accept(member, await invite(member.email)).expect(200);
    foreignMembershipId = (
      await prisma.organizationMember.findUniqueOrThrow({
        where: {
          userId_organizationId: { userId: outsider.id, organizationId: otherOrganizationId },
        },
      })
    ).id;
    departmentId = (
      await prisma.department.create({
        data: { organizationId, name: 'Finance', slug: 'finance' },
      })
    ).id;
    otherDepartmentId = (
      await prisma.department.create({
        data: { organizationId: otherOrganizationId, name: 'Finance', slug: 'finance' },
      })
    ).id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app?.close();
  });

  it('admits a same-name user only after acceptance and revokes contacts and access on removal', async () => {
    const initialMembers = await getMembers();
    expect(initialMembers.map((item) => item.userId)).toContain(member.id);
    expect(initialMembers.map((item) => item.userId)).not.toContain(outsider.id);
    expect(initialMembers.every((item) => item.organizationId === organizationId)).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(404);
    for (const organizationMemberId of [outsider.id, foreignMembershipId]) {
      await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/departments/${departmentId}/contacts`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ organizationMemberId })
        .expect(404);
    }

    const token = await invite(outsider.email);
    expect((await getMembers()).map((item) => item.userId)).not.toContain(outsider.id);
    await accept(outsider, token).expect(200);
    const membership = (await getMembers()).find((item) => item.userId === outsider.id)!;
    expect(membership.user.email).toBe(outsider.email);
    const assigned = await request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/departments/${departmentId}/contacts`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ organizationMemberId: membership.id })
      .expect(201);
    expect(assigned.body.contacts).toEqual([
      expect.objectContaining({ userId: outsider.id, email: outsider.email }),
    ]);
    await request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(200)
      .expect((response) => expect(response.body.userRole).toBe('MEMBER'));

    await request(app.getHttpServer())
      .delete(`/api/organizations/${organizationId}/users/${outsider.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .expect(200);
    expect(
      await prisma.departmentContact.count({ where: { organizationMemberId: membership.id } }),
    ).toBe(0);
    expect((await getMembers()).map((item) => item.userId)).not.toContain(outsider.id);
    await request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/departments/${departmentId}/contacts`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ organizationMemberId: membership.id })
      .expect(404);
    for (const path of ['', '/departments', '/users', '/brain/sources', '/projects']) {
      await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}${path}`)
        .set('Authorization', `Bearer ${outsider.token}`)
        .expect(path === '' ? 404 : 403);
    }
    expect(
      await prisma.organizationMember.findUnique({ where: { id: foreignMembershipId } }),
    ).not.toBeNull();
  });

  it('enforces both sides of contact tenancy in PostgreSQL, not only in the service', async () => {
    const ownMembership = await prisma.organizationMember.findUniqueOrThrow({
      where: { userId_organizationId: { userId: owner.id, organizationId } },
    });
    for (const data of [
      { organizationId, departmentId, organizationMemberId: foreignMembershipId },
      { organizationId, departmentId: otherDepartmentId, organizationMemberId: ownMembership.id },
    ]) {
      await expect(prisma.departmentContact.create({ data })).rejects.toMatchObject({
        code: 'P2003',
      });
    }
    await request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/departments/${otherDepartmentId}/contacts`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ organizationMemberId: ownMembership.id })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/departments/${departmentId}/contacts`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ organizationMemberId: ownMembership.id })
      .expect(403);
  });

  it('restricts invite management and hides invitations from other organizations', async () => {
    await request(app.getHttpServer())
      .post(`/api/organizations/${organizationId}/invites`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({ role: 'ADMIN' })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/organizations/${organizationId}/invites`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(403);
    const token = await invite();
    const row = await prisma.organizationInvite.findUniqueOrThrow({ where: { token } });
    await request(app.getHttpServer())
      .delete(`/api/organizations/${otherOrganizationId}/invites/${row.id}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .expect(404);
  });

  it('binds addressed invitations to a verified recipient across both acceptance paths', async () => {
    const token = await invite(member.email);
    await accept(outsider, token).expect(403);
    await request(app.getHttpServer())
      .post(`/api/invites/${token}/submit-email`)
      .send({ name: 'Sid', email: outsider.email, confirmEmail: outsider.email })
      .expect(403);
    const row = await prisma.organizationInvite.findUniqueOrThrow({ where: { token } });
    const verification = await prisma.inviteEmailVerification.create({
      data: {
        inviteId: row.id,
        token: randomUUID(),
        email: outsider.email,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await request(app.getHttpServer())
      .post('/api/invites/verify')
      .send({ inviteToken: token, verifyToken: verification.token })
      .expect(403);
    expect(
      await prisma.organizationMember.count({ where: { organizationId, userId: outsider.id } }),
    ).toBe(0);

    const unverified = await signup();
    await prisma.user.update({ where: { id: unverified.id }, data: { emailVerifiedAt: null } });
    await accept(unverified, await invite()).expect(403);
    // Accepting another invitation must not promote or demote an existing member.
    await prisma.organizationMember.update({
      where: { userId_organizationId: { userId: member.id, organizationId } },
      data: { role: 'ADMIN' },
    });
    await accept(member, token)
      .expect(200)
      .expect((response) => expect(response.body.role).toBe('ADMIN'));
    await prisma.organizationMember.update({
      where: { userId_organizationId: { userId: member.id, organizationId } },
      data: { role: 'MEMBER' },
    });
  });

  it('consumes one link atomically when signed-in acceptance races email verification', async () => {
    const first = await signup();
    const second = await signup();
    const token = await invite();
    await request(app.getHttpServer())
      .post(`/api/invites/${token}/submit-email`)
      .send({ name: 'Sid', email: second.email, confirmEmail: second.email })
      .expect(200);
    const row = await prisma.organizationInvite.findUniqueOrThrow({ where: { token } });
    const verification = await prisma.inviteEmailVerification.findFirstOrThrow({
      where: { inviteId: row.id, email: second.email },
    });
    const responses = await Promise.all([
      accept(first, token),
      request(app.getHttpServer())
        .post('/api/invites/verify')
        .send({ inviteToken: token, verifyToken: verification.token }),
    ]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => [400, 409].includes(response.status))).toHaveLength(1);
    expect(
      await prisma.organizationMember.count({
        where: { organizationId, userId: { in: [first.id, second.id] } },
      }),
    ).toBe(1);
  });

  it('protects owners from admins and preserves an owner during concurrent self-removal', async () => {
    const orgId = await createOrganization(owner);
    await prisma.organizationMember.createMany({
      data: [
        { organizationId: orgId, userId: outsider.id, role: 'OWNER' },
        { organizationId: orgId, userId: member.id, role: 'ADMIN' },
      ],
    });
    await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}/users/${owner.id}`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(403);
    const responses = await Promise.all(
      [owner, outsider].map((account) =>
        request(app.getHttpServer())
          .delete(`/api/organizations/${orgId}/users/${account.id}`)
          .set('Authorization', `Bearer ${account.token}`),
      ),
    );
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => [403, 409].includes(response.status))).toHaveLength(1);
    expect(
      await prisma.organizationMember.count({ where: { organizationId: orgId, role: 'OWNER' } }),
    ).toBe(1);
  });
});
