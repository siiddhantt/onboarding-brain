import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CogneeRememberResult, CogneeSearchResponse } from '@cognee/cognee-ts';
import type { CogneeRuntime, CogneeRuntimeFactory } from './cognee.runtime';
import { CogneeService } from './cognee.service';

describe('CogneeService', () => {
  const organizationId = '9a2bec79-0e02-4d13-a46e-bb0533806244';
  const rememberResult = {
    status: 'PipelineRunCompleted',
    dataset_id: 'dataset-1',
    items: [{ id: 'document-1' }],
  } as CogneeRememberResult;
  const searchResult = {
    search_type: 'HYBRID_COMPLETION',
    result: { kind: 'Text', data: 'Submit expenses through the finance portal.' },
    context: {
      handbook: [
        {
          id: 'chunk-1',
          score: 0.91,
          payload: {
            data_id: 'document-1',
            name: 'Employee handbook.pdf',
            text: 'Expense reports require manager approval.',
          },
        },
      ],
    },
    graphs: null,
    diagnostics: null,
    datasets: [`organization-${organizationId}`],
    only_context: false,
    use_combined_context: false,
    verbose: false,
  } as CogneeSearchResponse;

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

  it('reports whether the integration is configured without loading the SDK', () => {
    expect(service.isConfigured()).toBe(true);
    expect(runtimeFactory).not.toHaveBeenCalled();
  });

  it('initializes and warms the SDK only when it is first used', async () => {
    await service.ask(organizationId, 'Where is the handbook?');
    await service.ask(organizationId, 'How do I submit expenses?');

    expect(runtimeFactory).toHaveBeenCalledTimes(1);
    expect(runtimeFactory).toHaveBeenCalledWith({
      llmModel: 'gpt-4o-mini',
      llmApiKey: 'test-token',
    });
    expect(runtime.client.warm).toHaveBeenCalledTimes(1);
  });

  it('ingests binary documents into the organization dataset and tenant', async () => {
    const bytes = Buffer.from('document');

    const actual = await service.ingest({
      organizationId,
      content: {
        kind: 'binary',
        bytes,
        fileName: 'handbook.pdf',
        mimeType: 'application/pdf',
      },
    });

    expect(actual).toEqual({ providerReference: 'document-1' });
    expect(runtime.client.remember).toHaveBeenCalledWith(
      { type: 'binary', bytes, name: 'handbook.pdf' },
      `organization-${organizationId}`,
      { tenant: organizationId },
    );
  });

  it('uses the same ingestion path for connector text', async () => {
    await service.ingest({
      organizationId,
      content: { kind: 'text', name: 'Discord #people-ops', text: 'Expense policy' },
    });

    expect(runtime.client.remember).toHaveBeenCalledWith(
      { type: 'text', text: 'Expense policy' },
      `organization-${organizationId}`,
      { tenant: organizationId },
    );
  });

  it('normalizes answers and citations without leaking Cognee response types', async () => {
    const actual = await service.ask(organizationId, 'Who approves expenses?');

    expect(runtime.client.search).toHaveBeenCalledWith('Who approves expenses?', {
      datasets: [`organization-${organizationId}`],
      searchType: 'HYBRID_COMPLETION',
    });
    expect(actual).toEqual({
      status: 'ANSWERED',
      answer: 'Submit expenses through the finance portal.',
      citations: [
        {
          referenceId: 'document-1',
          label: 'Employee handbook.pdf',
          excerpt: 'Expense reports require manager approval.',
          score: 0.91,
        },
      ],
    });
  });

  it('returns NO_ANSWER when the provider supplies no answer text', async () => {
    const noAnswer = {
      ...searchResult,
      result: { kind: 'Items', data: [] },
      context: null,
    } as CogneeSearchResponse;
    (runtime.client.search as jest.Mock).mockResolvedValue(noAnswer);

    await expect(service.ask(organizationId, 'Unknown question')).resolves.toEqual({
      status: 'NO_ANSWER',
      answer: null,
      citations: [],
    });
  });

  it('does not expose a generated answer without supporting evidence', async () => {
    (runtime.client.search as jest.Mock).mockResolvedValue({
      ...searchResult,
      context: null,
    } as CogneeSearchResponse);

    await expect(service.ask(organizationId, 'Unsupported question')).resolves.toEqual({
      status: 'NO_ANSWER',
      answer: null,
      citations: [],
    });
  });

  it('does not expose an answer that has no supporting evidence', async () => {
    (runtime.client.search as jest.Mock).mockResolvedValue({
      ...searchResult,
      context: null,
    });

    await expect(service.ask(organizationId, 'Unsupported question')).resolves.toEqual({
      status: 'NO_ANSWER',
      answer: null,
      citations: [],
    });
  });

  it('rejects calls without loading the SDK when Cognee is disabled', async () => {
    configService.get = jest.fn((key: string, defaultValue?: unknown) =>
      key === 'COGNEE_ENABLED' ? 'false' : defaultValue,
    );
    service = new CogneeService(configService as ConfigService, runtimeFactory);

    await expect(service.ask(organizationId, 'Where is the handbook?')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(runtimeFactory).not.toHaveBeenCalled();
  });

  it('shuts down an initialized runtime when the module is destroyed', async () => {
    await service.ask(organizationId, 'Where is the handbook?');

    await service.onModuleDestroy();

    expect(runtime.shutdown).toHaveBeenCalledTimes(1);
  });

  it('shuts down a failed runtime and retries initialization on the next call', async () => {
    const warm = runtime.client.warm as jest.Mock;
    warm.mockRejectedValueOnce(new Error('warm failed')).mockResolvedValueOnce(undefined);

    await expect(service.ask(organizationId, 'First attempt')).rejects.toThrow('warm failed');
    await expect(service.ask(organizationId, 'Second attempt')).resolves.toMatchObject({
      status: 'ANSWERED',
    });

    expect(runtime.shutdown).toHaveBeenCalledTimes(1);
    expect(runtimeFactory).toHaveBeenCalledTimes(2);
  });
});
