'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { MAX_SOURCE_PREVIEW_ITEMS, MAX_SOURCE_SELECTION_ITEMS } from '@app-starter/shared';
import type {
  SourceConnectorDescriptor,
  SourcePreview,
  SourcePreviewQuery,
} from '@app-starter/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SourcePreviewItem } from './SourcePreviewItem';
import { matchesPreview, previewQuery, type PreviewFilters } from './source-preview';

interface SourcePreviewBrowserProps {
  preview: SourcePreview;
  connector?: SourceConnectorDescriptor;
  selectedIds: Set<string>;
  isBusy: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onSearch: (query: SourcePreviewQuery) => void;
  onLoadMore: () => void;
}

export const SourcePreviewBrowser = ({
  preview,
  connector,
  selectedIds,
  isBusy,
  onToggle,
  onSearch,
  onLoadMore,
}: SourcePreviewBrowserProps) => {
  const [filters, setFilters] = useState<PreviewFilters>({ text: '', from: '', to: '' });
  const [scope, setScope] = useState('loaded');
  const [onlySelected, setOnlySelected] = useState(false);
  const isDateInvalid = Boolean(filters.from && filters.to && filters.from > filters.to);
  const query = isDateInvalid ? {} : previewQuery(filters);
  const dateField = connector?.search?.dateField ?? 'updatedAt';
  const resultIds = new Set(preview.resultIds ?? preview.items.map((item) => item.id));
  const savedIds = new Set(preview.savedItemIds);
  const selected = preview.items.filter((item) => selectedIds.has(item.id));
  const matches = preview.items.filter(
    (item) =>
      !selectedIds.has(item.id) &&
      !isDateInvalid &&
      (scope === 'source' ? resultIds.has(item.id) : matchesPreview(item, query, dateField)),
  );
  const visible = [...selected, ...(onlySelected ? [] : matches)];
  const hasPendingSearch =
    scope === 'source' && JSON.stringify(query) !== JSON.stringify(preview.query ?? {});
  const handleFilter = (field: keyof PreviewFilters, value: string) =>
    setFilters((previous) => ({ ...previous, [field]: value }));

  return (
    <section className="min-w-0 space-y-3" aria-label="Curate source items">
      <form
        className="min-w-0 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (scope === 'source' && !isDateInvalid) onSearch(query);
        }}
      >
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <div className="relative min-w-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            />
            <Input
              aria-label="Filter preview items"
              className="min-w-0 pl-9"
              maxLength={500}
              placeholder={scope === 'source' ? 'Find in this source…' : 'Filter loaded items…'}
              value={filters.text}
              onChange={(event) => handleFilter('text', event.target.value)}
            />
          </div>
          {connector?.search && (
            <Select value={scope} onValueChange={setScope} disabled={isBusy}>
              <SelectTrigger aria-label="Search scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="loaded">Loaded items</SelectItem>
                <SelectItem value="source">Search source</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-2 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="preview-from" className="text-xs">
              {dateField === 'createdAt' ? 'Created' : 'Updated'} from
            </Label>
            <Input
              id="preview-from"
              type="date"
              className="min-w-0 max-w-full text-sm"
              value={filters.from}
              max={filters.to || '9999-12-30'}
              aria-invalid={isDateInvalid}
              onChange={(event) => handleFilter('from', event.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="preview-to" className="text-xs">
              Through
            </Label>
            <Input
              id="preview-to"
              type="date"
              className="min-w-0 max-w-full text-sm"
              value={filters.to}
              min={filters.from || undefined}
              max="9999-12-30"
              aria-invalid={isDateInvalid}
              onChange={(event) => handleFilter('to', event.target.value)}
            />
          </div>
          {scope === 'source' && (
            <Button
              type="submit"
              variant="outline"
              className="col-span-2 sm:col-span-1"
              disabled={isBusy || isDateInvalid || preview.limitReached}
            >
              {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Search source
            </Button>
          )}
        </div>
        {isDateInvalid && (
          <p role="alert" className="text-xs text-destructive">
            Choose an end date on or after the start date.
          </p>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          {scope === 'source'
            ? hasPendingSearch
              ? 'Apply Search source to update the results below.'
              : Object.keys(preview.query ?? {}).length
                ? 'Results from the source’s search index, within this collection only.'
                : 'Showing fetched source items. Set filters to search this collection.'
            : 'Filters cover loaded items only. Load more to browse further.'}{' '}
          Dates use your local time. Selected items stay visible.
        </p>
        {(filters.text || filters.from || filters.to) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBusy}
            onClick={() => setFilters({ text: '', from: '', to: '' })}
          >
            Clear filters
          </Button>
        )}
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span role="status" className="text-muted-foreground">
          {preview.items.length} loaded · {selected.length} selected · {matches.length} other
          matches
        </span>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={onlySelected}
            onChange={(event) => setOnlySelected(event.target.checked)}
          />
          Selected only
        </label>
      </div>
      <div
        role="region"
        aria-label="Source preview items"
        aria-busy={isBusy}
        tabIndex={0}
        className="max-h-[min(32rem,60dvh)] min-w-0 max-w-full overflow-y-auto overscroll-contain rounded-lg border [scrollbar-gutter:stable] [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ul className="min-w-0 divide-y">
          {visible.map((item) => (
            <SourcePreviewItem
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              isSaved={savedIds.has(item.id)}
              isDisabled={
                isBusy ||
                (!selectedIds.has(item.id) && selectedIds.size >= MAX_SOURCE_SELECTION_ITEMS)
              }
              onToggle={onToggle}
            />
          ))}
        </ul>
        {!visible.length && (
          <p className="p-4 text-sm text-muted-foreground">
            {onlySelected
              ? 'No items selected yet.'
              : 'No matching readable items in this view. Try different filters or load more.'}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {preview.limitReached
            ? `Preview limit: ${MAX_SOURCE_PREVIEW_ITEMS} items. Save your selection before starting a new preview.`
            : preview.nextCursor
              ? 'More items are available; they are not loaded until you ask.'
              : 'End of the available results for this preview.'}
        </p>
        {preview.nextCursor && (
          <Button type="button" variant="outline" size="sm" disabled={isBusy} onClick={onLoadMore}>
            {isBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load more items
          </Button>
        )}
      </div>
    </section>
  );
};
