import { Module } from '@nestjs/common';
import { KNOWLEDGE_ENGINE } from '../common/knowledge/knowledge-engine.interface';
import { COGNEE_RUNTIME_FACTORY, createCogneeRuntime } from './cognee.runtime';
import { CogneeService } from './cognee.service';

@Module({
  providers: [
    CogneeService,
    {
      provide: COGNEE_RUNTIME_FACTORY,
      useValue: createCogneeRuntime,
    },
    {
      provide: KNOWLEDGE_ENGINE,
      useExisting: CogneeService,
    },
  ],
  exports: [KNOWLEDGE_ENGINE],
})
export class CogneeModule {}
