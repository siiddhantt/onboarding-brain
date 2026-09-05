import { Module } from '@nestjs/common';
import { CompanyBrainModule } from '../company-brain/company-brain.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RedisModule } from '../redis/redis.module';
import { DiscordConnector } from './discord/discord.connector';
import { SOURCE_CONNECTORS } from './source-connector.interface';
import { SourceImportsController } from './source-imports.controller';
import { SourceImportsService } from './source-imports.service';

@Module({
  imports: [CompanyBrainModule, OrganizationsModule, RedisModule],
  controllers: [SourceImportsController],
  providers: [
    DiscordConnector,
    {
      provide: SOURCE_CONNECTORS,
      useFactory: (discord: DiscordConnector) => [discord],
      inject: [DiscordConnector],
    },
    SourceImportsService,
  ],
})
export class SourceConnectorsModule {}
