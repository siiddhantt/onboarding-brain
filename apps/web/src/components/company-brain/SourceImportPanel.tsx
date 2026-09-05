'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDown, ExternalLink, Loader2, Plug } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_SOURCE_SELECTION_ITEMS } from '@app-starter/shared';
import type { KnowledgeSource, PreviewSourceRequest, SourcePreview } from '@app-starter/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconTile } from '@/components/ui/icon-tile';
import { SourcePreviewBrowser } from './SourcePreviewBrowser';
import { companyBrainApi } from '@/lib/company-brain-api';
import { cn } from '@/lib/utils';

interface SourceImportPanelProps {
  organizationId: string;
  isConfigured: boolean;
  reviewSource?: KnowledgeSource | null;
  onImported: () => Promise<void>;
}

const errorMessage = (error: unknown): string =>
  error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'The source could not be loaded. Try again.';

export const SourceImportPanel = ({
  organizationId,
  isConfigured,
  reviewSource,
  onImported,
}: SourceImportPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [connectorId, setConnectorId] = useState('');
  const [locator, setLocator] = useState('');
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [canShare, setCanShare] = useState(false);
  const [canRestore, setCanRestore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectorsQuery = useQuery({
    queryKey: ['source-connectors', organizationId],
    queryFn: () => companyBrainApi.listConnectors(organizationId),
  });
  const activeId = connectorId || connectorsQuery.data?.[0]?.id || '';
  const connector = connectorsQuery.data?.find((item) => item.id === activeId);

  useEffect(() => {
    if (!reviewSource?.origin) return;
    setConnectorId(reviewSource.origin.connectorId);
    setLocator(reviewSource.origin.url);
    setIsOpen(true);
    setPreview(null);
    setError(null);
    setCanShare(false);
    setCanRestore(false);
  }, [reviewSource]);

  const previewMutation = useMutation({
    mutationFn: (request: PreviewSourceRequest) =>
      companyBrainApi.previewSource(organizationId, request),
    onSuccess: (result, request) => {
      setPreview(result);
      if (!request.previewId) setSelectedIds(new Set(result.selectedIds));
      setCanShare(false);
      setCanRestore(false);
      setError(null);
    },
    onError: (failure) => setError(errorMessage(failure)),
  });
  const importMutation = useMutation({
    mutationFn: () =>
      companyBrainApi.importSource(organizationId, {
        previewId: preview!.id,
        selectedIds: [...selectedIds],
        shareWithOrganization: true,
        restoreRemoved: canRestore,
      }),
    onSuccess: (source) => {
      if (source.status !== 'READY') {
        setError(source.errorMessage ?? 'The selected content could not be indexed.');
        return;
      }
      toast.success(`Source ready · version ${source.version}`);
      setPreview(null);
      setSelectedIds(new Set());
      setError(null);
    },
    onError: (failure) => setError(errorMessage(failure)),
    onSettled: onImported,
  });
  const isBusy = previewMutation.isPending || importMutation.isPending;

  const handleToggleItem = (id: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setCanShare(false);
  };

  return (
    <Card className="w-full min-w-0">
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-xl p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
        aria-expanded={isOpen}
        aria-controls="source-import-content"
        onClick={() => setIsOpen(!isOpen)}
      >
        <IconTile icon={Plug} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Import from a connected source</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Preview first. Only the items you choose become company knowledge.
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen && (
        <CardContent id="source-import-content" className="min-w-0 space-y-4 border-t p-4 sm:p-6">
          {connectorsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading connectors…</p>
          )}
          {connectorsQuery.isError && (
            <p role="alert" className="text-sm text-destructive">
              Connectors could not be loaded. Refresh the page.
            </p>
          )}
          <form
            className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              previewMutation.mutate({ connectorId: activeId, locator });
            }}
          >
            <div className="min-w-0 space-y-2">
              <Label htmlFor="source-connector">Source</Label>
              <Select
                value={activeId}
                disabled={isBusy}
                onValueChange={(value) => {
                  setConnectorId(value);
                  setPreview(null);
                  setLocator('');
                  setError(null);
                }}
              >
                <SelectTrigger id="source-connector">
                  <SelectValue placeholder="Choose a source" />
                </SelectTrigger>
                <SelectContent>
                  {connectorsQuery.data?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="source-locator">{connector?.locatorLabel ?? 'Source location'}</Label>
              <Input
                id="source-locator"
                value={locator}
                maxLength={300}
                placeholder={connector?.locatorPlaceholder}
                disabled={isBusy || !connector?.isConfigured}
                onChange={(event) => {
                  setLocator(event.target.value);
                  setPreview(null);
                }}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={isBusy || !connector?.isConfigured || !locator.trim()}
            >
              {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Preview
            </Button>
          </form>
          {connector && !connector.isConfigured && (
            <p className="text-xs leading-5 text-muted-foreground">
              {connector.name} is not configured for this organization. Ask the app operator to
              configure its credentials and source access.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {preview && (
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
                >
                  <span className="min-w-0 [overflow-wrap:anywhere]">{preview.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {selectedIds.size} selected · maximum {MAX_SOURCE_SELECTION_ITEMS}
                </span>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {preview.sourceId && !preview.wasRemoved
                  ? 'Saving updates this source’s selection; unchecked items are removed from its indexed content. '
                  : ''}
                New items start unchecked. Previews expire after 15 minutes.
              </p>
              {preview.wasRemoved && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                  This source was removed. Nothing is selected or restored automatically.
                </p>
              )}
              <SourcePreviewBrowser
                key={preview.externalId}
                preview={preview}
                connector={connector}
                selectedIds={selectedIds}
                isBusy={isBusy}
                onToggle={handleToggleItem}
                onSearch={(query) =>
                  previewMutation.mutate({
                    connectorId: preview.connectorId,
                    locator: preview.locator,
                    previewId: preview.id,
                    query,
                  })
                }
                onLoadMore={() =>
                  previewMutation.mutate({
                    connectorId: preview.connectorId,
                    locator: preview.locator,
                    previewId: preview.id,
                    cursor: preview.nextCursor!,
                    query: preview.query,
                  })
                }
              />
              {preview.savedItemIds.length > 0 && (
                <p className="text-xs leading-5 text-muted-foreground">
                  Saved snapshots are previously selected items outside the fetched results. They
                  stay unless you uncheck them. Missing from a preview does not mean deleted.
                </p>
              )}
              <div className="space-y-3 rounded-lg bg-muted/40 p-3 text-xs leading-5">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={canShare}
                    disabled={isBusy}
                    onChange={(event) => setCanShare(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                  />
                  <span>
                    I have permission to share the selected content with{' '}
                    <strong>everyone in this organization</strong>. Source-channel permissions are
                    not copied into the brain.
                  </span>
                </label>
                {preview.wasRemoved && (
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={canRestore}
                      disabled={isBusy}
                      onChange={(event) => setCanRestore(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    />
                    <span>Explicitly re-add this removed source with the current selection.</span>
                  </label>
                )}
              </div>
              <Button
                type="button"
                disabled={
                  isBusy ||
                  !isConfigured ||
                  !selectedIds.size ||
                  !canShare ||
                  (preview.wasRemoved && !canRestore)
                }
                onClick={() => importMutation.mutate()}
              >
                {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {importMutation.isPending
                  ? 'Indexing selection…'
                  : preview.sourceId && !preview.wasRemoved
                    ? 'Save selected knowledge'
                    : 'Import selected knowledge'}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
