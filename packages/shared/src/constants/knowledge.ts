export const MAX_KNOWLEDGE_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MIN_COMPANY_BRAIN_QUESTION_CHARACTERS = 3;
export const MAX_COMPANY_BRAIN_QUESTION_CHARACTERS = 1000;

export const KNOWLEDGE_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/html',
] as const;

export type KnowledgeDocumentMimeType = (typeof KNOWLEDGE_DOCUMENT_MIME_TYPES)[number];
