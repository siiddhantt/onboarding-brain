import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Department, DepartmentListResponse, TokenPayload } from '@app-starter/shared';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AssignDepartmentContactDto } from './dto/assign-department-contact.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentsService } from './departments.service';

@ApiTags('departments')
@Controller('organizations/:organizationId/departments')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List departments and contacts in an organization' })
  async list(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<DepartmentListResponse> {
    return this.departmentsService.list(req.user.sub, organizationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a department' })
  async create(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: CreateDepartmentDto,
  ): Promise<Department> {
    return this.departmentsService.create(req.user.sub, organizationId, data);
  }

  @Patch(':departmentId')
  @ApiOperation({ summary: 'Update a department' })
  async update(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('departmentId') departmentId: string,
    @Body() data: UpdateDepartmentDto,
  ): Promise<Department> {
    return this.departmentsService.update(req.user.sub, organizationId, departmentId, data);
  }

  @Delete(':departmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a department' })
  async archive(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('departmentId') departmentId: string,
  ): Promise<void> {
    await this.departmentsService.archive(req.user.sub, organizationId, departmentId);
  }

  @Post(':departmentId/contacts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign an organization member as a department contact' })
  async assignContact(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('departmentId') departmentId: string,
    @Body() data: AssignDepartmentContactDto,
  ): Promise<Department> {
    return this.departmentsService.assignContact(req.user.sub, organizationId, departmentId, data);
  }

  @Delete(':departmentId/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a department contact' })
  async removeContact(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('departmentId') departmentId: string,
    @Param('contactId') contactId: string,
  ): Promise<void> {
    await this.departmentsService.removeContact(
      req.user.sub,
      organizationId,
      departmentId,
      contactId,
    );
  }
}
