import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Name must be at least 1 character' })
  @MaxLength(100, { message: 'Name must be 100 characters or fewer' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must be 500 characters or fewer' })
  description?: string;
}
