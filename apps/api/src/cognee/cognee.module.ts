import { Module } from '@nestjs/common';
import { COGNEE_RUNTIME_FACTORY, createCogneeRuntime } from './cognee.runtime';
import { CogneeService } from './cognee.service';

@Module({
  providers: [
    CogneeService,
    {
      provide: COGNEE_RUNTIME_FACTORY,
      useValue: createCogneeRuntime,
    },
  ],
  exports: [CogneeService],
})
export class CogneeModule {}
