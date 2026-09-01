import { Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CogneeRememberResult, CogneeSearchResponse } from '@cognee/cognee-ts';
import { COGNEE_RUNTIME_FACTORY, CogneeRuntime, CogneeRuntimeFactory } from './cognee.runtime';

@Injectable()
export class CogneeService implements OnModuleDestroy {
  private runtimePromise?: Promise<CogneeRuntime>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(COGNEE_RUNTIME_FACTORY)
    private readonly runtimeFactory: CogneeRuntimeFactory,
  ) {}

  async rememberText(organizationId: string, text: string): Promise<CogneeRememberResult> {
    const { client } = await this.getRuntime();

    return client.remember({ type: 'text', text }, this.datasetNameFor(organizationId), {
      tenant: organizationId,
    });
  }

  async search(organizationId: string, query: string): Promise<CogneeSearchResponse> {
    const { client } = await this.getRuntime();

    return client.search(query, {
      datasets: [this.datasetNameFor(organizationId)],
      searchType: 'HYBRID_COMPLETION',
    });
  }

  async onModuleDestroy(): Promise<void> {
    const pendingRuntime = this.runtimePromise;

    if (!pendingRuntime) {
      return;
    }

    try {
      const runtime = await pendingRuntime;
      runtime.shutdown();
    } catch {
      // Initialization already surfaced the actionable error to its caller.
    }
  }

  private async getRuntime(): Promise<CogneeRuntime> {
    if (this.configService.get<string>('COGNEE_ENABLED', 'false') !== 'true') {
      throw new ServiceUnavailableException(
        'Cognee is disabled. Set COGNEE_ENABLED=true and configure OPENAI_TOKEN to enable it.',
      );
    }

    this.runtimePromise ??= this.initializeRuntime();

    return this.runtimePromise;
  }

  private async initializeRuntime(): Promise<CogneeRuntime> {
    let runtime: CogneeRuntime | undefined;

    try {
      runtime = await this.runtimeFactory(this.runtimeSettings());
      await runtime.client.warm();
      return runtime;
    } catch (error) {
      runtime?.shutdown();
      this.runtimePromise = undefined;
      throw error;
    }
  }

  private runtimeSettings(): Record<string, unknown> {
    return {
      llmModel: this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini'),
      llmApiKey: this.configService.get<string>('OPENAI_TOKEN'),
    };
  }

  private datasetNameFor(organizationId: string): string {
    const prefix = this.configService.get<string>('COGNEE_DATASET_PREFIX', 'organization');
    return `${prefix}-${organizationId}`;
  }
}
