'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { KnowledgeSource, KnowledgeSourceStatus } from '@app-starter/shared';
import { KNOWLEDGE_DOCUMENT_MIME_TYPES, MAX_KNOWLEDGE_DOCUMENT_BYTES } from '@app-starter/shared';
import { FileText, Loader2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_LABELS: Record<KnowledgeSourceStatus, string> = {
  PROCESSING: 'Processing',
  READY: 'Ready',
  FAILED: 'Failed',
};

const formatBytes = (bytes: number | null): string => {
  if (bytes === null) {
    return 'Unknown size';
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value: string): string =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value),
  );

interface KnowledgeSourcesPanelProps {
  sources: KnowledgeSource[];
  canManage: boolean;
  isConfigured: boolean;
  isUploading: boolean;
  onUpload: (file: File) => Promise<void>;
}

export function KnowledgeSourcesPanel({
  sources,
  canManage,
  isConfigured,
  isUploading,
  onUpload,
}: KnowledgeSourcesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a document first.');
      return;
    }

    if (file.size > MAX_KNOWLEDGE_DOCUMENT_BYTES) {
      setError('The document must be 10 MB or smaller.');
      return;
    }

    try {
      await onUpload(file);
      event.currentTarget.reset();
      setSelectedFileName(null);
    } catch (uploadError) {
      setError(
        uploadError && typeof uploadError === 'object' && 'message' in uploadError
          ? String(uploadError.message)
          : 'Could not upload the document.',
      );
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/20 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-lg">Knowledge sources</CardTitle>
          <CardDescription>Manage the policies and guides employees can search.</CardDescription>
        </div>
        <Badge variant="outline" className="w-fit">
          {sources.length} {sources.length === 1 ? 'source' : 'sources'}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {canManage ? (
          <section className="border-b p-5 sm:p-6" aria-labelledby="add-knowledge-source">
            <div className="mb-4">
              <h2 id="add-knowledge-source" className="text-sm font-semibold">
                Add a document
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                It stays isolated to this organization when it is indexed.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Label
                htmlFor="knowledge-document"
                className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-center transition-colors hover:bg-muted/40"
              >
                <span className="sr-only">Onboarding document</span>
                <Upload className="mb-2 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium">
                  {selectedFileName ?? 'Choose an onboarding document'}
                </span>
                <span className="mt-1 text-xs font-normal text-muted-foreground">
                  PDF, DOCX, TXT, Markdown, or HTML · up to 10 MB
                </span>
              </Label>
              <Input
                ref={inputRef}
                id="knowledge-document"
                name="file"
                type="file"
                aria-label="Onboarding document"
                accept={KNOWLEDGE_DOCUMENT_MIME_TYPES.join(',')}
                disabled={!isConfigured || isUploading}
                aria-describedby="knowledge-document-help knowledge-document-error"
                className="sr-only"
                onChange={(event) => {
                  setSelectedFileName(event.target.files?.[0]?.name ?? null);
                  setError(null);
                }}
              />
              <p id="knowledge-document-help" className="sr-only">
                PDF, DOCX, TXT, Markdown, or HTML. Maximum 10 MB.
              </p>
              {error && (
                <p id="knowledge-document-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" size="sm" disabled={!isConfigured || isUploading}>
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading ? 'Indexing…' : 'Upload document'}
              </Button>
            </form>
          </section>
        ) : (
          <div className="border-b px-5 py-4 text-sm text-muted-foreground sm:px-6">
            An organization owner or admin can add knowledge sources.
          </div>
        )}

        <section className="p-5 sm:p-6" aria-labelledby="indexed-knowledge">
          <h2 id="indexed-knowledge" className="mb-3 text-sm font-semibold">
            Indexed knowledge
          </h2>
          {sources.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-10 text-center">
              <FileText className="mx-auto mb-3 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">No knowledge sources yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the first onboarding document to start answering questions.
              </p>
            </div>
          ) : (
            <div className="max-h-[32rem] divide-y overflow-y-auto rounded-lg border">
              {sources.map((source) => (
                <div key={source.id} className="flex items-start justify-between gap-4 p-4">
                  <div className="flex min-w-0 gap-3">
                    <div className="rounded-md bg-muted p-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{source.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatBytes(source.sizeBytes)} · Added {formatDate(source.createdAt)}
                      </p>
                      {source.errorMessage && (
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer font-medium text-destructive">
                            Indexing details
                          </summary>
                          <p className="mt-1 max-w-xl leading-5 text-muted-foreground">
                            {source.errorMessage}
                          </p>
                        </details>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      source.status === 'FAILED'
                        ? 'destructive'
                        : source.status === 'READY'
                          ? 'secondary'
                          : 'outline'
                    }
                  >
                    {STATUS_LABELS[source.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
