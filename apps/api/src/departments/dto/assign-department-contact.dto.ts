import { IsUUID } from 'class-validator';

export class AssignDepartmentContactDto {
  @IsUUID()
  organizationMemberId: string;
}
