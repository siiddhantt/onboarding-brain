import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KnowledgeContent,
  KnowledgeEngine,
  KnowledgeEngineAnswer,
  KnowledgeEngineCitation,
  KnowledgeIngestionRequest,
  KnowledgeIngestionResult,
  KnowledgeItemRequest,
  KnowledgeReplacementRequest,
} from '../common/knowledge/knowledge-engine.interface';
import { cogneeDatasetName } from './cognee-dataset';

export const COGNEE_CLOUD_FETCH = Symbol('COGNEE_CLOUD_FETCH');

const INSUFFICIENT_CONTEXT = 'INSUFFICIENT_CONTEXT';
const ANSWER_SYSTEM_PROMPT = `Answer only from the provided context. If the context does not contain enough information, reply exactly ${INSUFFICIENT_CONTEXT}.`;
const REQUEST_TIMEOUT_MS = 120_000;

interface CogneeCloudSearchEntry {
  dataset_id?: string | null;
  dataset_name?: string | null;
  search_result?: unknown;
}

interface CogneeCloudRememberResponse {
  dataset_id?: string;
  items?: Array<{ id?: string }>;
}

interface CogneeCloudDataset {
  id?: string;
  name?: string;
}

interface CogneeCloudUpdateRun {
  dataset_id?: string;
  data_ingestion_info?: Array<{ data_id?: string }> | null;
}

@Injectable()
export class CogneeCloudService implements KnowledgeEngine {
  constructor(
    private readonly configService: ConfigService,
    @Inject(COGNEE_CLOUD_FETCH) private readonly fetcher: typeof fetch,
  ) {}

  isConfigured(): boolean {
    return (
      this.configService.get<string>('COGNEE_ENABLED', 'false') === 'true' &&
      this.configService.get<string>('COGNEE_PROVIDER', 'embedded') === 'cloud' &&
      Boolean(this.configService.get<string>('COGNEE_CLOUD_API_URL')?.trim()) &&
      Boolean(this.configService.get<string>('COGNEE_CLOUD_API_KEY')?.trim())
    );
  }

  async ingest(request: KnowledgeIngestionRequest): Promise<KnowledgeIngestionResult> {
    this.assertConfigured();

    const form = new FormData();
    const file = this.toFile(request.content);
    form.append('data', file.blob, file.name);
    form.append('datasetName', cogneeDatasetName(this.configService, request.organizationId));
    form.append('run_in_background', 'false');

    const response = await this.request<CogneeCloudRememberResponse>('/api/v1/remember', {
      method: 'POST',
      body: form,
    });
    const providerReference = response.items?.[0]?.id;

    if (!providerReference) {
      throw new ServiceUnavailableException('Cognee Cloud did not return an item reference.');
    }

    return {
      providerReference,
      providerContainerReference: response.dataset_id ?? null,
    };
  }

  async replace(request: KnowledgeReplacementRequest): Promise<KnowledgeIngestionResult> {
    this.assertConfigured();

    const containerReference = await this.resolveContainerReference(request);
    const file = this.toFile(request.content);
    const form = new FormData();
    form.append('data', file.blob, file.name);

    const query = new URLSearchParams({
      data_id: request.providerReference,
      dataset_id: containerReference,
    });
    const response = await this.request<Record<string, CogneeCloudUpdateRun>>(
      `/api/v1/update?${query}`,
      { method: 'PATCH', body: form },
    );

    return {
      providerReference: this.updatedItemReference(response) ?? request.providerReference,
      providerContainerReference: containerReference,
    };
  }

  async remove(request: KnowledgeItemRequest): Promise<void> {
    this.assertConfigured();

    const containerReference = await this.resolveContainerReference(request);
    await this.request<void>(
      `/api/v1/datasets/${encodeURIComponent(containerReference)}/data/${encodeURIComponent(request.providerReference)}`,
      { method: 'DELETE' },
    );
  }

  async ask(organizationId: string, question: string): Promise<KnowledgeEngineAnswer> {
    this.assertConfigured();

    const dataset = cogneeDatasetName(this.configService, organizationId);
    const contextResponse = await this.search(dataset, question, 'CHUNKS');
    const citations = this.extractCitations(contextResponse);

    if (citations.length === 0) {
      return { status: 'NO_ANSWER', answer: null, citations: [] };
    }

    const answerResponse = await this.search(dataset, question, 'RAG_COMPLETION', {
      systemPrompt: ANSWER_SYSTEM_PROMPT,
    });
    const answer = this.extractAnswer(answerResponse);

    if (!answer || answer.includes(INSUFFICIENT_CONTEXT)) {
      return { status: 'NO_ANSWER', answer: null, citations };
    }

    return { status: 'ANSWERED', answer, citations };
  }

  private async search(
    dataset: string,
    question: string,
    searchType: 'CHUNKS' | 'RAG_COMPLETION',
    extra: Record<string, unknown> = {},
  ): Promise<CogneeCloudSearchEntry[]> {
    return this.request<CogneeCloudSearchEntry[]>('/api/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: question,
        datasets: [dataset],
        searchType,
        topK: 5,
        ...extra,
      }),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const apiUrl = this.requiredSetting('COGNEE_CLOUD_API_URL').replace(/\/$/, '');
    const apiKey = this.requiredSetting('COGNEE_CLOUD_API_KEY');
    let response: Response;

    try {
      response = await this.fetcher(`${apiUrl}${path}`, {
        ...init,
        headers: {
          'X-Api-Key': apiKey,
          ...init.headers,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new ServiceUnavailableException('Cognee Cloud could not be reached.');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Cognee Cloud request failed with HTTP ${response.status}.`,
      );
    }

    try {
      const body = await response.text();
      return (body ? JSON.parse(body) : undefined) as T;
    } catch {
      throw new ServiceUnavailableException('Cognee Cloud returned an invalid response.');
    }
  }

  private async resolveContainerReference(request: KnowledgeItemRequest): Promise<string> {
    if (request.providerContainerReference) {
      return request.providerContainerReference;
    }

    const datasets = await this.request<CogneeCloudDataset[]>('/api/v1/datasets/', {
      method: 'GET',
    });
    const datasetName = cogneeDatasetName(this.configService, request.organizationId);
    const reference = datasets.find((dataset) => dataset.name === datasetName)?.id;

    if (!reference) {
      throw new ServiceUnavailableException('Cognee Cloud dataset could not be resolved.');
    }

    return reference;
  }

  private updatedItemReference(response: Record<string, CogneeCloudUpdateRun>): string | null {
    for (const run of Object.values(response)) {
      for (const item of run.data_ingestion_info ?? []) {
        if (item.data_id) {
          return item.data_id;
        }
      }
    }

    return null;
  }

  private toFile(content: KnowledgeContent): { blob: Blob; name: string } {
    if (content.kind === 'text') {
      return {
        blob: new Blob([content.text], { type: 'text/plain' }),
        name: this.textFileName(content.name),
      };
    }

    return {
      blob: new Blob([new Uint8Array(content.bytes)], { type: content.mimeType }),
      name: content.fileName,
    };
  }

  private textFileName(name: string): string {
    const normalized = name
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${normalized || 'knowledge-source'}.txt`;
  }

  private extractAnswer(entries: CogneeCloudSearchEntry[]): string | null {
    for (const entry of entries) {
      const result = entry.search_result;
      const candidates = Array.isArray(result) ? result : [result];

      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          return candidate.trim();
        }
      }
    }

    return null;
  }

  private extractCitations(entries: CogneeCloudSearchEntry[]): KnowledgeEngineCitation[] {
    const citations = new Map<string, KnowledgeEngineCitation>();

    for (const entry of entries) {
      if (!Array.isArray(entry.search_result)) {
        continue;
      }

      for (const result of entry.search_result) {
        if (!this.isRecord(result)) {
          continue;
        }

        const excerpt = this.nonEmptyString(result.text) ?? this.nonEmptyString(result.content);
        if (!excerpt) {
          continue;
        }

        const citation = {
          referenceId:
            this.nonEmptyString(result.document_id) ?? this.nonEmptyString(result.data_id),
          label:
            this.nonEmptyString(result.document_name) ??
            this.nonEmptyString(result.name) ??
            entry.dataset_name ??
            null,
          excerpt,
          score: typeof result.score === 'number' ? result.score : null,
        };
        citations.set(`${citation.referenceId}:${citation.excerpt}`, citation);
      }
    }

    return [...citations.values()];
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Cognee Cloud is disabled or missing its URL and API key.',
      );
    }
  }

  private requiredSetting(key: 'COGNEE_CLOUD_API_URL' | 'COGNEE_CLOUD_API_KEY'): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new ServiceUnavailableException(`Missing ${key}.`);
    }
    return value;
  }

  private nonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
