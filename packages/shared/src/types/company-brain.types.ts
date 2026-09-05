export type KnowledgeSourceType = 'DOCUMENT' | 'EXTERNAL';
export type KnowledgeSourceStatus = 'PROCESSING' | 'READY' | 'FAILED' | 'UPDATING' | 'REMOVING';

export interface KnowledgeSource {
  id: string;
  organizationId: string;
  createdById: string;
  sourceType: KnowledgeSourceType;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: KnowledgeSourceStatus;
  version: number;
  lastIndexedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  origin?: {
    connectorId: string;
    externalId: string;
    url: string;
    itemCount: number;
  };
}

export interface KnowledgeSourceListResponse {
  items: KnowledgeSource[];
  total: number;
}

export interface CompanyBrainStatusResponse {
  isConfigured: boolean;
}

export interface AskCompanyBrainRequest {
  question: string;
}

export interface CompanyBrainCitation {
  sourceId: string | null;
  sourceName: string;
  excerpt: string | null;
  score: number | null;
  sourceUrl?: string;
  sourceLinks?: { title: string; url: string }[];
}

export interface CompanyBrainAnswer {
  status: 'ANSWERED' | 'NO_ANSWER';
  answer: string | null;
  citations: CompanyBrainCitation[];
}
