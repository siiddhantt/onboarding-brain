import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CogneeCloudService } from './cognee-cloud.service';

describe('CogneeCloudService', () => {
  const organizationId = '9a2bec79-0e02-4d13-a46e-bb0533806244';
  const datasetName = `organization-${organizationId}`;
  const apiUrl = 'https://tenant.example.com';
  const apiKey = 'test-api-key';
  let fetcher: jest.MockedFunction<typeof fetch>;
  let configService: Pick<ConfigService, 'get'>;
  let service: CogneeCloudService;

  const jsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  beforeEach(() => {
    fetcher = jest.fn();
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          COGNEE_ENABLED: 'true',
          COGNEE_PROVIDER: 'cloud',
          COGNEE_DATASET_PREFIX: 'organization',
          COGNEE_CLOUD_API_URL: apiUrl,
          COGNEE_CLOUD_API_KEY: apiKey,
        };
        return values[key] ?? defaultValue;
      }),
    };
    service = new CogneeCloudService(configService as ConfigService, fetcher);
  });

  it('uploads a document to the organization-derived dataset', async () => {
    fetcher.mockResolvedValue(
      jsonResponse({
        dataset_id: 'dataset-1',
        items: [{ id: 'document-1' }],
      }),
    );

    const actual = await service.ingest({
      organizationId,
      content: {
        kind: 'binary',
        bytes: Buffer.from('Expense policy'),
        fileName: 'expense-policy.md',
        mimeType: 'text/markdown',
      },
    });

    expect(actual).toEqual({
      providerReference: 'document-1',
      providerContainerReference: 'dataset-1',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`${apiUrl}/api/v1/remember`);
    expect(init?.headers).toMatchObject({ 'X-Api-Key': apiKey });
    const form = init?.body as FormData;
    expect(form.get('datasetName')).toBe(datasetName);
    expect((form.get('data') as File).name).toBe('expense-policy.md');
  });

  it('normalizes connector text into a text file for the same ingestion endpoint', async () => {
    fetcher.mockResolvedValue(
      jsonResponse({ dataset_id: 'dataset-1', items: [{ id: 'document-1' }] }),
    );

    await service.ingest({
      organizationId,
      content: {
        kind: 'text',
        name: 'Discord #people ops',
        text: 'Ask Finance about expenses.',
      },
    });

    const form = fetcher.mock.calls[0][1]?.body as FormData;
    expect((form.get('data') as File).name).toBe('Discord-people-ops.txt');
  });

  it('replaces a single item using its opaque provider references', async () => {
    fetcher.mockResolvedValue(
      jsonResponse({
        'dataset-1': {
          dataset_id: 'dataset-1',
          data_ingestion_info: [{ data_id: 'document-2' }],
        },
      }),
    );
    const replacement = Buffer.from('Updated expense policy');

    const actual = await service.replace({
      organizationId,
      providerReference: 'document-1',
      providerContainerReference: 'dataset-1',
      content: {
        kind: 'binary',
        bytes: replacement,
        fileName: 'expense-policy-v2.md',
        mimeType: 'text/markdown',
      },
    });

    expect(actual).toEqual({
      providerReference: 'document-2',
      providerContainerReference: 'dataset-1',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe(`${apiUrl}/api/v1/update?data_id=document-1&dataset_id=dataset-1`);
    expect(init?.method).toBe('PATCH');
    expect((init?.body as FormData).get('data')).toBeInstanceOf(File);
  });

  it('resolves the provider container for legacy sources before replacing them', async () => {
    fetcher
      .mockResolvedValueOnce(jsonResponse([{ id: 'dataset-1', name: datasetName }]))
      .mockResolvedValueOnce(jsonResponse({}));

    await service.replace({
      organizationId,
      providerReference: 'document-1',
      providerContainerReference: null,
      content: { kind: 'text', name: 'Discord policy', text: 'Updated policy' },
    });

    expect(fetcher.mock.calls[0][0]).toBe(`${apiUrl}/api/v1/datasets/`);
    expect(fetcher.mock.calls[1][0]).toBe(
      `${apiUrl}/api/v1/update?data_id=document-1&dataset_id=dataset-1`,
    );
  });

  it('removes a single item and its derived provider knowledge', async () => {
    fetcher.mockResolvedValue(new Response(null, { status: 204 }));

    await service.remove({
      organizationId,
      providerReference: 'document-1',
      providerContainerReference: 'dataset-1',
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`${apiUrl}/api/v1/datasets/dataset-1/data/document-1`);
    expect(fetcher.mock.calls[0][1]?.method).toBe('DELETE');
  });

  it('retrieves evidence before returning a grounded answer', async () => {
    fetcher
      .mockResolvedValueOnce(
        jsonResponse([
          {
            dataset_name: datasetName,
            search_result: [
              {
                document_id: 'document-1',
                document_name: 'expense-policy',
                text: 'Employees submit expenses through Ramp.',
                score: 0.93,
              },
            ],
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            dataset_name: datasetName,
            search_result: ['Employees submit expenses through Ramp.'],
          },
        ]),
      );

    const actual = await service.ask(organizationId, 'How do I submit an expense?');

    expect(actual).toEqual({
      status: 'ANSWERED',
      answer: 'Employees submit expenses through Ramp.',
      citations: [
        {
          referenceId: 'document-1',
          label: 'expense-policy',
          excerpt: 'Employees submit expenses through Ramp.',
          score: 0.93,
        },
      ],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toMatchObject({
      datasets: [datasetName],
      searchType: 'CHUNKS',
    });
    expect(JSON.parse(fetcher.mock.calls[1][1]?.body as string)).toMatchObject({
      datasets: [datasetName],
      searchType: 'RAG_COMPLETION',
    });
  });

  it('does not request a generated answer when retrieval finds no evidence', async () => {
    fetcher.mockResolvedValue(jsonResponse([{ dataset_name: datasetName, search_result: [] }]));

    await expect(service.ask(organizationId, 'Unknown question')).resolves.toEqual({
      status: 'NO_ANSWER',
      answer: null,
      citations: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not expose a completion that reports insufficient context', async () => {
    fetcher
      .mockResolvedValueOnce(
        jsonResponse([
          {
            dataset_name: datasetName,
            search_result: [{ document_id: 'document-1', text: 'Unrelated context' }],
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([{ dataset_name: datasetName, search_result: ['INSUFFICIENT_CONTEXT'] }]),
      );

    await expect(service.ask(organizationId, 'Unknown question')).resolves.toMatchObject({
      status: 'NO_ANSWER',
      answer: null,
    });
  });

  it('reports provider failures without including the response body or credential', async () => {
    fetcher.mockResolvedValue(jsonResponse({ detail: `Invalid key ${apiKey}` }, 401));

    const action = service.ask(organizationId, 'Question');

    await expect(action).rejects.toThrow(ServiceUnavailableException);
    await expect(action).rejects.not.toThrow(apiKey);
  });
});
