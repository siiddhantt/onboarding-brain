import { Transform } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import type {
  CreateSourceConnectionRequest,
  SaveSourceLocationRequest,
  SourceConnectionRevisionRequest,
  UpdateSourceConnectionRequest,
} from '@app-starter/shared';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class ConnectionRevisionDto implements SourceConnectionRevisionRequest {
  @IsInt()
  @Min(1)
  expectedRevision: number;
}

export class CreateConnectionDto implements CreateSourceConnectionRequest {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  connectorId: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsObject()
  config: Record<string, string>;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  credential: string;
}

export class UpdateConnectionDto
  extends ConnectionRevisionDto
  implements UpdateSourceConnectionRequest
{
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  credential?: string;
}

export class SaveLocationDto extends ConnectionRevisionDto implements SaveSourceLocationRequest {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  locator: string;
}
