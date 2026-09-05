'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { KnowledgeSource, KnowledgeSourceStatus } from '@app-starter/shared';
import { KNOWLEDGE_DOCUMENT_MIME_TYPES, MAX_KNOWLEDGE_DOCUMENT_BYTES } from '@app-starter/shared';
import {
  ExternalLink,
  FileText,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconTile } from '@/components/ui/icon-tile';
import { Label } from '@/components/ui/label';

const STATUS_LABELS: Record<KnowledgeSourceStatus, string> = {
  PROCESSING: 'Processing',
  READY: 'Ready',
  FAILED: 'Failed',
  UPDATING: 'Updating',
  REMOVING: 'Removing',
};

const BUSY_STATUSES = new Set<KnowledgeSourceStatus>(['PROCESSING', 'UPDATING', 'REMOVING']);

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
  replacingSourceId: string | null;
  removingSourceId: string | null;
  onUpload: (file: File) => Promise<void>;
  onReplace: (sourceId: string, file: File) => Promise<void>;
  onRemove: (sourceId: string) => Promise<void>;
  onReview?: (source: KnowledgeSource) => void;
}

export function KnowledgeSourcesPanel({
  sources,
  canManage,
  isConfigured,
  isUploading,
  replacingSourceId,
  removingSourceId,
  onUpload,
  onReplace,
  onRemove,
  onReview,
}: KnowledgeSourcesPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replacementInputs = useRef(new Map<string, HTMLInputElement>());
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pendingReplacement, setPendingReplacement] = useState<{
    source: KnowledgeSource;
    file: File;
  } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<KnowledgeSource | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadError(null);

    const input = inputRef.current;
    const file = input?.files?.[0];
    if (!input || !file) {
      setUploadError('Choose a document first.');
      return;
    }

    if (file.size > MAX_KNOWLEDGE_DOCUMENT_BYTES) {
      setUploadError('The document must be 10 MB or smaller.');
      return;
    }

    try {
      await onUpload(file);
      input.value = '';
      setSelectedFileName(null);
    } catch (uploadError) {
      setUploadError(
        uploadError && typeof uploadError === 'object' && 'message' in uploadError
          ? String(uploadError.message)
          : 'Could not upload the document.',
      );
    }
  };

  const handleReplacementSelected = (source: KnowledgeSource, file?: File) => {
    if (!file) {
      return;
    }

    if (file.size > MAX_KNOWLEDGE_DOCUMENT_BYTES) {
      setSourceError('The replacement document must be 10 MB or smaller.');
      return;
    }

    setSourceError(null);
    setPendingReplacement({ source, file });
  };

  const handleConfirmReplacement = () => {
    if (!pendingReplacement) {
      return;
    }

    const { source, file } = pendingReplacement;
    setPendingReplacement(null);
    void onReplace(source.id, file).catch(() => undefined);
  };

  const handleConfirmRemoval = () => {
    if (!pendingRemoval) {
      return;
    }

    const sourceId = pendingRemoval.id;
    setPendingRemoval(null);
    void onRemove(sourceId).catch(() => undefined);
  };

  return (
    <>
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
                  <span className="max-w-full text-sm font-medium [overflow-wrap:anywhere]">
                    {selectedFileName ?? 'Choose an onboarding document'}
                  </span>
                  <span className="mt-1 text-xs font-normal text-muted-foreground">
                    PDF, DOCX, TXT, Markdown, or HTML · up to 10 MB
                  </span>
                </Label>
                <input
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
                    setUploadError(null);
                  }}
                />
                <p id="knowledge-document-help" className="sr-only">
                  PDF, DOCX, TXT, Markdown, or HTML. Maximum 10 MB.
                </p>
                {uploadError && (
                  <p
                    id="knowledge-document-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {uploadError}
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
            {sourceError && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {sourceError}
              </p>
            )}
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
                  <div
                    key={source.id}
                    className="flex min-w-0 flex-wrap items-start justify-between gap-3 p-3 sm:flex-nowrap sm:p-4"
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <IconTile icon={FileText} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{source.name}</p>
                        {source.origin && (
                          <a
                            href={source.origin.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                          >
                            {source.origin.itemCount} curated{' '}
                            {source.origin.itemCount === 1 ? 'item' : 'items'}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Version {source.version} · {formatBytes(source.sizeBytes)} ·{' '}
                          {source.lastIndexedAt
                            ? `Indexed ${formatDate(source.lastIndexedAt)}`
                            : `Added ${formatDate(source.createdAt)}`}
                        </p>
                        {source.errorMessage && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer font-medium text-destructive">
                              Indexing details
                            </summary>
                            <p className="mt-1 max-w-xl leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                              {source.errorMessage}
                            </p>
                          </details>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
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
                      {canManage && (
                        <>
                          {!source.origin && (
                            <input
                              ref={(element) => {
                                if (element) {
                                  replacementInputs.current.set(source.id, element);
                                } else {
                                  replacementInputs.current.delete(source.id);
                                }
                              }}
                              type="file"
                              accept={KNOWLEDGE_DOCUMENT_MIME_TYPES.join(',')}
                              aria-label={`Replacement document for ${source.name}`}
                              className="sr-only"
                              disabled={!isConfigured || BUSY_STATUSES.has(source.status)}
                              onChange={(event) => {
                                handleReplacementSelected(source, event.target.files?.[0]);
                                event.target.value = '';
                              }}
                            />
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Actions for ${source.name}`}
                                disabled={
                                  BUSY_STATUSES.has(source.status) ||
                                  replacingSourceId === source.id ||
                                  removingSourceId === source.id
                                }
                              >
                                {replacingSourceId === source.id ||
                                removingSourceId === source.id ? (
                                  <Loader2 className="animate-spin" />
                                ) : (
                                  <MoreHorizontal />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                disabled={!isConfigured}
                                onSelect={() =>
                                  source.origin
                                    ? onReview?.(source)
                                    : replacementInputs.current.get(source.id)?.click()
                                }
                              >
                                <RefreshCw className="mr-2" />
                                {source.origin ? 'Review selection' : 'Replace document'}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => setPendingRemoval(source)}
                              >
                                <Trash2 className="mr-2" />
                                Remove from brain
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingReplacement !== null}
        onOpenChange={(open) => !open && setPendingReplacement(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this knowledge source?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingReplacement
                ? `${pendingReplacement.source.name} will be replaced by ${pendingReplacement.file.name}. Its source identity stays intact, but the previous content will stop contributing to future answers.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReplacement}>Replace source</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this knowledge source?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval
                ? `${pendingRemoval.name} and its derived knowledge will be removed from future answers. Original content in connected services is not deleted.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoval}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove source
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
