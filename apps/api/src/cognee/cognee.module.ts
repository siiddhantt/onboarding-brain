import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KNOWLEDGE_ENGINE } from '../common/knowledge/knowledge-engine.interface';
import { COGNEE_CLOUD_FETCH, CogneeCloudService } from './cognee-cloud.service';
import { COGNEE_RUNTIME_FACTORY, createCogneeRuntime } from './cognee.runtime';
import { CogneeService } from './cognee.service';

@Module({
  providers: [
    CogneeService,
    CogneeCloudService,
    {
      provide: COGNEE_CLOUD_FETCH,
      useValue: globalThis.fetch,
    },
    {
      provide: COGNEE_RUNTIME_FACTORY,
      useValue: createCogneeRuntime,
    },
    {
      provide: KNOWLEDGE_ENGINE,
      inject: [ConfigService, CogneeService, CogneeCloudService],
      useFactory: (
        configService: ConfigService,
        embedded: CogneeService,
        cloud: CogneeCloudService,
      ) =>
        configService.get<string>('COGNEE_PROVIDER', 'embedded') === 'cloud' ? cloud : embedded,
    },
  ],
  exports: [KNOWLEDGE_ENGINE],
})
export class CogneeModule {}
