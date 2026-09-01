import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CogneeRememberResult, CogneeSearchResponse } from '@cognee/cognee-ts';
import { CogneeRuntime, CogneeRuntimeFactory } from './cognee.runtime';
import { CogneeService } from './cognee.service';

describe('CogneeService', () => {
  const organizationId = '9a2bec79-0e02-4d13-a46e-bb0533806244';
  const rememberResult = { status: 'PipelineRunCompleted' } as CogneeRememberResult;
  const searchResult = { search_type: 'HYBRID_COMPLETION' } as CogneeSearchResponse;

  let runtime: CogneeRuntime;
  let runtimeFactory: jest.MockedFunction<CogneeRuntimeFactory>;
  let configService: Pick<ConfigService, 'get'>;
  let service: CogneeService;

  beforeEach(() => {
    runtime = {
      client: {
        warm: jest.fn().mockResolvedValue(undefined),
        remember: jest.fn().mockResolvedValue(rememberResult),
        search: jest.fn().mockResolvedValue(searchResult),
      },
      shutdown: jest.fn(),
    };
    runtimeFactory = jest.fn().mockResolvedValue(runtime);
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          COGNEE_ENABLED: 'true',
          COGNEE_DATASET_PREFIX: 'organization',
          OPENAI_MODEL: 'gpt-4o-mini',
          OPENAI_TOKEN: 'test-token',
        };

        return values[key] ?? defaultValue;
      }),
    };
    service = new CogneeService(configService as ConfigService, runtimeFactory);
  });

  it('initializes and warms the SDK only when it is first used', async () => {
    expect(runtimeFactory).not.toHaveBeenCalled();

    await service.search(organizationId, 'Where is the handbook?');
    await service.search(organizationId, 'How do I submit expenses?');

    expect(runtimeFactory).toHaveBeenCalledTimes(1);
    expect(runtimeFactory).toHaveBeenCalledWith({
      llmModel: 'gpt-4o-mini',
      llmApiKey: 'test-token',
    });
    expect(runtime.client.warm).toHaveBeenCalledTimes(1);
  });

  it('ingests text into the organization dataset and tenant', async () => {
    const result = await service.rememberText(organizationId, 'Expenses require manager approval.');

    expect(result).toBe(rememberResult);
    expect(runtime.client.remember).toHaveBeenCalledWith(
      { type: 'text', text: 'Expenses require manager approval.' },
      `organization-${organizationId}`,
      { tenant: organizationId },
    );
  });

  it('restricts search to the organization dataset', async () => {
    const result = await service.search(organizationId, 'Who approves expenses?');

    expect(result).toBe(searchResult);
    expect(runtime.client.search).toHaveBeenCalledWith('Who approves expenses?', {
      datasets: [`organization-${organizationId}`],
      searchType: 'HYBRID_COMPLETION',
    });
  });

  it('rejects calls without loading the SDK when Cognee is disabled', async () => {
    configService.get = jest.fn((key: string, defaultValue?: unknown) =>
      key === 'COGNEE_ENABLED' ? 'false' : defaultValue,
    );
    service = new CogneeService(configService as ConfigService, runtimeFactory);

    await expect(service.search(organizationId, 'Where is the handbook?')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(runtimeFactory).not.toHaveBeenCalled();
  });

  it('shuts down an initialized runtime when the module is destroyed', async () => {
    await service.search(organizationId, 'Where is the handbook?');

    await service.onModuleDestroy();

    expect(runtime.shutdown).toHaveBeenCalledTimes(1);
  });

  it('shuts down a failed runtime and retries initialization on the next call', async () => {
    const warm = runtime.client.warm as jest.Mock;
    warm.mockRejectedValueOnce(new Error('warm failed')).mockResolvedValueOnce(undefined);

    await expect(service.search(organizationId, 'First attempt')).rejects.toThrow('warm failed');
    await expect(service.search(organizationId, 'Second attempt')).resolves.toBe(searchResult);

    expect(runtime.shutdown).toHaveBeenCalledTimes(1);
    expect(runtimeFactory).toHaveBeenCalledTimes(2);
  });
});
