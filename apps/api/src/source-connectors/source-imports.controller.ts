import { Body, Controller, Get, HttpCode, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TokenPayload } from '@app-starter/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { ImportSourceDto, PreviewSourceDto } from './dto/source-import.dto';
import { SourceImportsService } from './source-imports.service';

@ApiTags('source imports')
@Controller('organizations/:organizationId/brain/imports')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class SourceImportsController {
  constructor(private readonly imports: SourceImportsService) {}

  @Get('connectors')
  @ApiOperation({ summary: 'List source connectors available to the organization' })
  list(@Request() req: { user: TokenPayload }, @Param('organizationId') org: string) {
    return this.imports.listConnectors(req.user.sub, org);
  }

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Preview source content without sending it to the knowledge engine' })
  preview(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') org: string,
    @Body() data: PreviewSourceDto,
  ) {
    return this.imports.preview(req.user.sub, org, data);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Index the explicitly selected content from a reviewed preview' })
  import(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') org: string,
    @Body() data: ImportSourceDto,
  ) {
    return this.imports.import(req.user.sub, org, data);
  }
}
