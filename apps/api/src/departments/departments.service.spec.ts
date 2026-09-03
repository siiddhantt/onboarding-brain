import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { DepartmentsService } from './departments.service';

describe('DepartmentsService', () => {
  const organizationId = 'org-1';
  const userId = 'user-1';
  const departmentId = 'department-1';
  const createdAt = new Date('2026-09-03T12:00:00.000Z');

  const buildDepartment = (overrides: Record<string, unknown> = {}) => ({
    id: departmentId,
    organizationId,
    name: 'Finance',
    slug: 'finance-AbCdE',
    description: 'Expenses and purchasing',
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
    contacts: [],
    ...overrides,
  });

  let prisma: any;
  let organizationsService: { getUserRoleInOrganization: jest.Mock };
  let service: DepartmentsService;

  beforeEach(() => {
    prisma = {
      department: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(buildDepartment()),
        create: jest.fn().mockResolvedValue(buildDepartment()),
        update: jest.fn().mockResolvedValue(buildDepartment()),
      },
      departmentContact: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'contact-1' }),
        create: jest.fn().mockResolvedValue({ id: 'contact-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'contact-1' }),
      },
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'member-1' }),
      },
    };
    organizationsService = {
      getUserRoleInOrganization: jest.fn().mockResolvedValue(OrgRole.ADMIN),
    };
    service = new DepartmentsService(
      prisma as PrismaService,
      organizationsService as unknown as OrganizationsService,
    );
  });

  it('lists only active departments from the requested organization for members', async () => {
    organizationsService.getUserRoleInOrganization.mockResolvedValue(OrgRole.MEMBER);
    prisma.department.findMany.mockResolvedValue([buildDepartment()]);

    const actual = await service.list(userId, organizationId);

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId, archivedAt: null },
        orderBy: { name: 'asc' },
      }),
    );
    expect(actual).toMatchObject({ total: 1, items: [{ id: departmentId, name: 'Finance' }] });
  });

  it('does not expose departments to non-members', async () => {
    organizationsService.getUserRoleInOrganization.mockResolvedValue(null);

    await expect(service.list(userId, organizationId)).rejects.toThrow(ForbiddenException);
    expect(prisma.department.findMany).not.toHaveBeenCalled();
  });

  it('creates an organization-scoped department for admins', async () => {
    const actual = await service.create(userId, organizationId, {
      name: ' Finance ',
      description: ' Expenses and purchasing ',
    });

    expect(prisma.department.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId,
          name: 'Finance',
          description: 'Expenses and purchasing',
        }),
      }),
    );
    expect(actual.organizationId).toBe(organizationId);
  });

  it('prevents members from changing department configuration', async () => {
    organizationsService.getUserRoleInOrganization.mockResolvedValue(OrgRole.MEMBER);

    await expect(
      service.update(userId, organizationId, departmentId, { name: 'Accounting' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.department.findFirst).not.toHaveBeenCalled();
  });

  it('assigns only a member from the same organization as a contact', async () => {
    prisma.department.findFirst.mockResolvedValueOnce(buildDepartment()).mockResolvedValueOnce(
      buildDepartment({
        contacts: [
          {
            id: 'contact-1',
            organizationMemberId: 'member-1',
            createdAt,
            organizationMember: {
              id: 'member-1',
              user: { id: 'contact-user', name: 'Ada', email: 'ada@example.com' },
            },
          },
        ],
      }),
    );

    const actual = await service.assignContact(userId, organizationId, departmentId, {
      organizationMemberId: 'member-1',
    });

    expect(prisma.organizationMember.findFirst).toHaveBeenCalledWith({
      where: { id: 'member-1', organizationId },
      select: { id: true },
    });
    expect(prisma.departmentContact.create).toHaveBeenCalledWith({
      data: { organizationId, departmentId, organizationMemberId: 'member-1' },
    });
    expect(actual.contacts[0]).toMatchObject({ name: 'Ada', email: 'ada@example.com' });
  });

  it('rejects a contact who is not a member of the organization', async () => {
    prisma.organizationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.assignContact(userId, organizationId, departmentId, {
        organizationMemberId: 'member-from-another-org',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.departmentContact.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate department contacts', async () => {
    prisma.departmentContact.findUnique.mockResolvedValue({ id: 'contact-1' });

    await expect(
      service.assignContact(userId, organizationId, departmentId, {
        organizationMemberId: 'member-1',
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.departmentContact.create).not.toHaveBeenCalled();
  });

  it('scopes contact removal to both organization and department', async () => {
    await service.removeContact(userId, organizationId, departmentId, 'contact-1');

    expect(prisma.departmentContact.findFirst).toHaveBeenCalledWith({
      where: { id: 'contact-1', organizationId, departmentId },
      select: { id: true },
    });
    expect(prisma.departmentContact.delete).toHaveBeenCalledWith({ where: { id: 'contact-1' } });
  });

  it('archives a scoped department instead of deleting it', async () => {
    await service.archive(userId, organizationId, departmentId);

    expect(prisma.department.findFirst).toHaveBeenCalledWith({
      where: { id: departmentId, organizationId, archivedAt: null },
    });
    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: departmentId },
      data: { archivedAt: expect.any(Date) },
    });
  });
});
