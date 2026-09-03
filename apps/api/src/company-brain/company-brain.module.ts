import { Module } from '@nestjs/common';
import { CogneeModule } from '../cognee/cognee.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CompanyBrainController } from './company-brain.controller';
import { CompanyBrainService } from './company-brain.service';

@Module({
  imports: [PrismaModule, OrganizationsModule, CogneeModule],
  controllers: [CompanyBrainController],
  providers: [CompanyBrainService],
  exports: [CompanyBrainService],
})
export class CompanyBrainModule {}
