export const KNOWLEDGE_ENGINE = Symbol('KNOWLEDGE_ENGINE');

export type KnowledgeContent =
  | {
      kind: 'text';
      name: string;
      text: string;
    }
  | {
      kind: 'binary';
      bytes: Buffer;
      fileName: string;
      mimeType: string;
    };

export interface KnowledgeIngestionRequest {
  organizationId: string;
  content: KnowledgeContent;
}

export interface KnowledgeIngestionResult {
  providerReference: string | null;
}

export interface KnowledgeEngineCitation {
  referenceId: string | null;
  label: string | null;
  excerpt: string | null;
  score: number | null;
}

export interface KnowledgeEngineAnswer {
  status: 'ANSWERED' | 'NO_ANSWER';
  answer: string | null;
  citations: KnowledgeEngineCitation[];
}

/**
 * Product-facing boundary for a knowledge engine.
 *
 * Connectors normalize documents and conversations into `KnowledgeContent`;
 * the company-brain domain never depends on Cognee or another provider's DTOs.
 */
export interface KnowledgeEngine {
  isConfigured(): boolean;
  ingest(request: KnowledgeIngestionRequest): Promise<KnowledgeIngestionResult>;
  ask(organizationId: string, question: string): Promise<KnowledgeEngineAnswer>;
}
