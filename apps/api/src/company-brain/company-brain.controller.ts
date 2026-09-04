import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  CompanyBrainAnswer,
  CompanyBrainStatusResponse,
  KnowledgeSource,
  KnowledgeSourceListResponse,
  TokenPayload,
} from '@app-starter/shared';
import { MAX_KNOWLEDGE_DOCUMENT_BYTES } from '@app-starter/shared';
import { EmailVerifiedGuard } from '../auth/email-verified.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyBrainService } from './company-brain.service';
import { AskCompanyBrainDto } from './dto/ask-company-brain.dto';

@ApiTags('company brain')
@Controller('organizations/:organizationId/brain')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class CompanyBrainController {
  constructor(private readonly companyBrainService: CompanyBrainService) {}

  @Get('status')
  @ApiOperation({ summary: 'Check whether the company brain is configured' })
  async getStatus(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<CompanyBrainStatusResponse> {
    return this.companyBrainService.getStatus(req.user.sub, organizationId);
  }

  @Get('sources')
  @ApiOperation({ summary: 'List organization knowledge sources' })
  async listSources(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
  ): Promise<KnowledgeSourceListResponse> {
    return this.companyBrainService.listSources(req.user.sub, organizationId);
  }

  @Post('sources/documents')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_KNOWLEDGE_DOCUMENT_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload and index an onboarding document' })
  async uploadDocument(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<KnowledgeSource> {
    return this.companyBrainService.uploadDocument(req.user.sub, organizationId, file);
  }

  @Put('sources/:sourceId/content')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_KNOWLEDGE_DOCUMENT_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Replace the indexed content of a knowledge source' })
  async replaceSourceContent(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('sourceId') sourceId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<KnowledgeSource> {
    return this.companyBrainService.replaceDocument(req.user.sub, organizationId, sourceId, file);
  }

  @Delete('sources/:sourceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a knowledge source and its derived knowledge' })
  async removeSource(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Param('sourceId') sourceId: string,
  ): Promise<void> {
    await this.companyBrainService.removeSource(req.user.sub, organizationId, sourceId);
  }

  @Post('questions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask a question against organization knowledge' })
  async ask(
    @Request() req: { user: TokenPayload },
    @Param('organizationId') organizationId: string,
    @Body() data: AskCompanyBrainDto,
  ): Promise<CompanyBrainAnswer> {
    return this.companyBrainService.ask(req.user.sub, organizationId, data.question);
  }
}
