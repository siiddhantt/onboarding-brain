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
    } catch (uploadError) {
      setError(
        uploadError && typeof uploadError === 'object' && 'message' in uploadError
          ? String(uploadError.message)
          : 'Could not upload the document.',
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge sources</CardTitle>
        <CardDescription>
          Add the policies and guides employees should be able to search.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {canManage ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="knowledge-document">Onboarding document</Label>
              <Input
                ref={inputRef}
                id="knowledge-document"
                name="file"
                type="file"
                accept={KNOWLEDGE_DOCUMENT_MIME_TYPES.join(',')}
                disabled={!isConfigured || isUploading}
                aria-describedby="knowledge-document-help knowledge-document-error"
              />
              <p id="knowledge-document-help" className="text-xs text-muted-foreground">
                PDF, DOCX, TXT, Markdown, or HTML. Maximum 10 MB.
              </p>
              {error && (
                <p id="knowledge-document-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <Button type="submit" size="sm" disabled={!isConfigured || isUploading}>
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {isUploading ? 'Indexing…' : 'Upload document'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            An organization owner or admin can add knowledge sources.
          </p>
        )}

        <div className="space-y-2 border-t pt-4">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No knowledge sources yet.</p>
          ) : (
            sources.map((source) => (
              <div
                key={source.id}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="flex min-w-0 gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{source.name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(source.sizeBytes)}</p>
                    {source.errorMessage && (
                      <p className="mt-1 text-xs text-destructive">{source.errorMessage}</p>
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
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
