import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department as PrismaDepartment, OrgRole, Prisma } from '@prisma/client';
import type { Department, DepartmentContact, DepartmentListResponse } from '@app-starter/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { sanitizeOptionalString, sanitizeString } from '../common/utils/sanitize.util';
import { ensureUniqueSlug, generateSlugFromName } from '../common/utils/slug.util';
import { AssignDepartmentContactDto } from './dto/assign-department-contact.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

const MEMBER_ROLES: readonly OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER];
const MANAGE_ROLES: readonly OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN];
const DEPARTMENT_INCLUDE = {
  contacts: {
    include: {
      organizationMember: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.DepartmentInclude;

type DepartmentWithContacts = Prisma.DepartmentGetPayload<{
  include: typeof DEPARTMENT_INCLUDE;
}>;

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async list(userId: string, organizationId: string): Promise<DepartmentListResponse> {
    await this.requireRole(userId, organizationId, MEMBER_ROLES, 'view departments');

    const departments = await this.prisma.department.findMany({
      where: { organizationId, archivedAt: null },
      include: DEPARTMENT_INCLUDE,
      orderBy: { name: 'asc' },
    });

    return {
      items: departments.map((department) => this.toResponse(department)),
      total: departments.length,
    };
  }

  async create(
    userId: string,
    organizationId: string,
    data: CreateDepartmentDto,
  ): Promise<Department> {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'create departments');

    const name = sanitizeString(data.name);
    const slug = await ensureUniqueSlug(
      async (candidate) => {
        const existing = await this.prisma.department.findUnique({
          where: { organizationId_slug: { organizationId, slug: candidate } },
          select: { id: true },
        });
        return existing !== null;
      },
      100,
      () => generateSlugFromName(name),
    );

    const department = await this.prisma.department.create({
      data: {
        organizationId,
        name,
        slug,
        description: sanitizeOptionalString(data.description),
      },
      include: DEPARTMENT_INCLUDE,
    });

    return this.toResponse(department);
  }

  async update(
    userId: string,
    organizationId: string,
    departmentId: string,
    data: UpdateDepartmentDto,
  ): Promise<Department> {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'update departments');
    const department = await this.loadScoped(organizationId, departmentId);

    const updated = await this.prisma.department.update({
      where: { id: department.id },
      data: {
        ...(data.name !== undefined ? { name: sanitizeString(data.name) } : {}),
        ...(data.description !== undefined
          ? { description: sanitizeOptionalString(data.description) }
          : {}),
      },
      include: DEPARTMENT_INCLUDE,
    });

    return this.toResponse(updated);
  }

  async archive(userId: string, organizationId: string, departmentId: string): Promise<void> {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'archive departments');
    const department = await this.loadScoped(organizationId, departmentId);

    await this.prisma.department.update({
      where: { id: department.id },
      data: { archivedAt: new Date() },
    });
  }

  async assignContact(
    userId: string,
    organizationId: string,
    departmentId: string,
    data: AssignDepartmentContactDto,
  ): Promise<Department> {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'assign department contacts');
    const department = await this.loadScoped(organizationId, departmentId);
    const organizationMember = await this.prisma.organizationMember.findFirst({
      where: { id: data.organizationMemberId, organizationId },
      select: { id: true },
    });

    if (!organizationMember) {
      throw new NotFoundException('Organization member not found');
    }

    const existing = await this.prisma.departmentContact.findUnique({
      where: {
        departmentId_organizationMemberId: {
          departmentId: department.id,
          organizationMemberId: organizationMember.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('This member is already a contact for the department');
    }

    try {
      await this.prisma.departmentContact.create({
        data: {
          organizationId,
          departmentId: department.id,
          organizationMemberId: organizationMember.id,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('This member is already a department contact');
        }
        if (error.code === 'P2003') {
          throw new NotFoundException('Department or organization member no longer exists');
        }
      }
      throw error;
    }

    return this.loadResponse(organizationId, department.id);
  }

  async removeContact(
    userId: string,
    organizationId: string,
    departmentId: string,
    contactId: string,
  ): Promise<void> {
    await this.requireRole(userId, organizationId, MANAGE_ROLES, 'remove department contacts');
    await this.loadScoped(organizationId, departmentId);

    const contact = await this.prisma.departmentContact.findFirst({
      where: { id: contactId, organizationId, departmentId },
      select: { id: true },
    });

    if (!contact) {
      throw new NotFoundException('Department contact not found');
    }

    await this.prisma.departmentContact.delete({ where: { id: contact.id } });
  }

  private async loadScoped(
    organizationId: string,
    departmentId: string,
  ): Promise<PrismaDepartment> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId, archivedAt: null },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return department;
  }

  private async loadResponse(organizationId: string, departmentId: string): Promise<Department> {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, organizationId, archivedAt: null },
      include: DEPARTMENT_INCLUDE,
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return this.toResponse(department);
  }

  private async requireRole(
    userId: string,
    organizationId: string,
    roles: readonly OrgRole[],
    action: string,
  ): Promise<void> {
    const role = await this.organizationsService.getUserRoleInOrganization(userId, organizationId);

    if (!role || !roles.includes(role)) {
      throw new ForbiddenException(`You do not have permission to ${action}.`);
    }
  }

  private toResponse(department: DepartmentWithContacts): Department {
    return {
      id: department.id,
      organizationId: department.organizationId,
      name: department.name,
      slug: department.slug,
      description: department.description,
      contacts: department.contacts.map((contact): DepartmentContact => {
        const member = contact.organizationMember;
        return {
          id: contact.id,
          organizationMemberId: member.id,
          userId: member.user.id,
          name: member.user.name,
          email: member.user.email,
          createdAt: contact.createdAt.toISOString(),
        };
      }),
      createdAt: department.createdAt.toISOString(),
      updatedAt: department.updatedAt.toISOString(),
    };
  }
}
