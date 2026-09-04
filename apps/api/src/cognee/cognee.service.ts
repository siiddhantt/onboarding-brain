import { Inject, Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CogneeSearchItem, CogneeSearchOutput, CogneeSearchResponse } from '@cognee/cognee-ts';
import {
  KnowledgeContent,
  KnowledgeEngine,
  KnowledgeEngineAnswer,
  KnowledgeEngineCitation,
  KnowledgeIngestionRequest,
  KnowledgeIngestionResult,
} from '../common/knowledge/knowledge-engine.interface';
import { cogneeDatasetName } from './cognee-dataset';
import { COGNEE_RUNTIME_FACTORY, CogneeRuntime, CogneeRuntimeFactory } from './cognee.runtime';

@Injectable()
export class CogneeService implements KnowledgeEngine, OnModuleDestroy {
  private runtimePromise?: Promise<CogneeRuntime>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(COGNEE_RUNTIME_FACTORY)
    private readonly runtimeFactory: CogneeRuntimeFactory,
  ) {}

  isConfigured(): boolean {
    return this.configService.get<string>('COGNEE_ENABLED', 'false') === 'true';
  }

  async ingest(request: KnowledgeIngestionRequest): Promise<KnowledgeIngestionResult> {
    const { client } = await this.getRuntime();
    const result = await client.remember(
      this.toCogneeInput(request.content),
      cogneeDatasetName(this.configService, request.organizationId),
      { tenant: request.organizationId },
    );

    return {
      providerReference: result.items[0]?.id ?? result.dataset_id,
    };
  }

  async ask(organizationId: string, question: string): Promise<KnowledgeEngineAnswer> {
    const { client } = await this.getRuntime();
    const response = await client.search(question, {
      datasets: [cogneeDatasetName(this.configService, organizationId)],
      searchType: 'HYBRID_COMPLETION',
    });
    const answer = this.extractAnswer(response.result);
    const citations = this.extractCitations(response);
    const isGrounded = Boolean(answer) && citations.length > 0;

    return {
      status: isGrounded ? 'ANSWERED' : 'NO_ANSWER',
      answer: isGrounded ? answer : null,
      citations,
    };
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
    if (!this.isConfigured()) {
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

  private toCogneeInput(content: KnowledgeContent) {
    if (content.kind === 'text') {
      return { type: 'text' as const, text: content.text };
    }

    return {
      type: 'binary' as const,
      bytes: content.bytes,
      name: content.fileName,
    };
  }

  private extractAnswer(output: CogneeSearchOutput): string | null {
    if (output.kind === 'Text') {
      return this.nonEmpty(output.data);
    }

    if (output.kind === 'Texts') {
      const text = output.data
        .map((item) => item.trim())
        .filter(Boolean)
        .join('\n\n');
      return text || null;
    }

    if (output.kind === 'Items') {
      const text = output.data
        .map((item) => this.payloadText(item.payload))
        .filter((item): item is string => item !== null)
        .join('\n\n');
      return text || null;
    }

    if (output.kind === 'Structured' && this.isRecord(output.data)) {
      return this.firstString(output.data, ['answer', 'text', 'content']);
    }

    return null;
  }

  private extractCitations(response: CogneeSearchResponse): KnowledgeEngineCitation[] {
    const candidates = Object.entries(response.context ?? {}).flatMap(([label, items]) =>
      items.map((item) => ({ item, fallbackLabel: label })),
    );

    if (response.result.kind === 'Items') {
      candidates.push(
        ...response.result.data.map((item) => ({ item, fallbackLabel: 'Company knowledge' })),
      );
    }

    const citations = candidates.map(({ item, fallbackLabel }) =>
      this.toCitation(item, fallbackLabel),
    );
    const unique = new Map<string, KnowledgeEngineCitation>();

    for (const citation of citations) {
      const key = [citation.referenceId, citation.label, citation.excerpt].join(':');
      unique.set(key, citation);
    }

    return [...unique.values()];
  }

  private toCitation(item: CogneeSearchItem, fallbackLabel: string): KnowledgeEngineCitation {
    return {
      referenceId:
        this.firstString(item.payload, ['data_id', 'document_id', 'source_id', 'id']) ?? item.id,
      label:
        this.firstString(item.payload, ['name', 'title', 'file_name', 'source']) ?? fallbackLabel,
      excerpt: this.payloadText(item.payload),
      score: item.score,
    };
  }

  private payloadText(payload: Record<string, unknown>): string | null {
    return this.firstString(payload, ['text', 'content', 'chunk_text', 'summary']);
  }

  private firstString(value: Record<string, unknown>, keys: readonly string[]): string | null {
    for (const key of keys) {
      const candidate = value[key];
      if (typeof candidate === 'string') {
        const text = this.nonEmpty(candidate);
        if (text) {
          return text;
        }
      }
    }

    return null;
  }

  private nonEmpty(value: string): string | null {
    const trimmed = value.trim();
    return trimmed || null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
