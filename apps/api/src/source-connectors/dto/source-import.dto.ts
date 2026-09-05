import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { MAX_SOURCE_SELECTION_ITEMS } from '@app-starter/shared';
import type { ImportSourceRequest, PreviewSourceRequest } from '@app-starter/shared';

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
