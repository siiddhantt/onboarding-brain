import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { TokenPayload } from '@app-starter/shared';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { EmailVerifiedGuard } from '../../auth/email-verified.guard';
import {
  ConnectionRevisionDto,
  CreateConnectionDto,
  SaveLocationDto,
  UpdateConnectionDto,
} from './source-connection.dto';
import { SourceConnectionsService } from './source-connections.service';

@ApiTags('source connections')
@Controller('organizations/:organizationId/brain')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
export class SourceConnectionsController {
  constructor(private readonly connections: SourceConnectionsService) {}

  @Get('connections')
  list(
    @Request() req: { user: TokenPayload },
    @Param('organizationId', ParseUUIDPipe) org: string,
  ) {
    return this.connections.list(req.user.sub, org);
  }

  @Post('connections')
  create(
    @Request() req: { user: TokenPayload },
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Body() input: CreateConnectionDto,
  ) {
    return this.connections.create(req.user.sub, org, input);
  }

  @Patch('connections/:id')
  update(
    @Request() req: { user: TokenPayload },
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateConnectionDto,
  ) {
    return this.connections.update(req.user.sub, org, id, input);
  }

  @Post('connections/:id/disconnect')
  @HttpCode(200)
  disconnect(
    @Request() req: { user: TokenPayload },
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: ConnectionRevisionDto,
  ) {
    return this.connections.disconnect(req.user.sub, org, id, input.expectedRevision);
  }

  @Get('connections/:id/discover')
  discover(
    @Request() req: { user: TokenPayload },
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.connections.discover(req.user.sub, org, id);
  }

  @Post('connections/:id/locations')
  saveLocation(
    @Request() req: { user: TokenPayload },
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaveLocationDto,
  ) {
    return this.connections.saveLocation(req.user.sub, org, id, input);
  }

  @Delete('locations/:id')
  @HttpCode(204)
  forgetLocation(
    @Request() req: { user: TokenPayload },
    @Param('organizationId', ParseUUIDPipe) org: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.connections.forgetLocation(req.user.sub, org, id);
  }
}
