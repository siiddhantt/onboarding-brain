import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MAX_SOURCE_SELECTION_ITEMS } from '@app-starter/shared';
import type {
  ImportSourceRequest,
  PreviewSourceRequest,
  SourcePreviewQuery,
} from '@app-starter/shared';

class SourcePreviewQueryDto implements SourcePreviewQuery {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}

export class PreviewSourceDto implements PreviewSourceRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  connectorId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  locator: string;

  @IsOptional()
  @IsUUID()
  previewId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cursor?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SourcePreviewQueryDto)
  query?: SourcePreviewQueryDto;
}

export class ImportSourceDto implements ImportSourceRequest {
  @IsUUID()
  previewId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SOURCE_SELECTION_ITEMS)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  selectedIds: string[];

  @Equals(true, { message: 'Confirm that this content may be shared with your organization.' })
  shareWithOrganization: true;

  @IsOptional()
  @IsBoolean()
  restoreRemoved?: boolean;
}
