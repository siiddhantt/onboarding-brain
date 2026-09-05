'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  SavedSourceLocation,
  SourceConnection,
  SourceConnectorDescriptor,
} from '@app-starter/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { sourceConnectionsApi } from '@/lib/source-connections-api';

interface Props {
  organizationId: string;
  connection: SourceConnection;
  connector: SourceConnectorDescriptor;
  initialLocator?: string;
  onClose: () => void;
  onSaved: (location: SavedSourceLocation) => Promise<void>;
}

export const SaveSourceLocationDialog = ({
  organizationId,
  connection,
  connector,
  initialLocator = '',
  onClose,
  onSaved,
}: Props) => {
  const [locator, setLocator] = useState(initialLocator);
  const discovery = useQuery({
    queryKey: ['source-discovery', organizationId, connection.id, connection.revision],
    queryFn: () => sourceConnectionsApi.discover(organizationId, connection.id),
    enabled: connector.canDiscoverLocations,
    retry: false,
  });
  const save = useMutation({
    mutationFn: (value: string) =>
      sourceConnectionsApi.saveLocation(organizationId, connection.id, {
        locator: value,
        expectedRevision: connection.revision,
      }),
    onSuccess: async (location) => {
      await onSaved(location);
      onClose();
    },
  });
  const savedIds = new Set(connection.locations.map((location) => location.externalId));

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save a location</DialogTitle>
          <DialogDescription>
            Choose once, then reopen it by name. Nothing is imported until you preview and approve
            it.
          </DialogDescription>
        </DialogHeader>
        {connector.canDiscoverLocations && (
          <div className="min-w-0 space-y-2">
            <Command className="rounded-lg border">
              <CommandInput placeholder="Find a location…" aria-label="Find a location" />
              <CommandList className="max-h-56">
                <CommandEmpty>
                  {discovery.isLoading ? 'Loading locations…' : 'No matching locations.'}
                </CommandEmpty>
                {discovery.data?.map((location) => (
                  <CommandItem
                    key={location.externalId}
                    value={location.name}
                    disabled={save.isPending || savedIds.has(location.externalId)}
                    onSelect={() => save.mutate(location.locator)}
                  >
                    <span className="min-w-0 flex-1 truncate">{location.name}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {savedIds.has(location.externalId) ? 'Saved' : 'Save'}
                    </span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
            {discovery.isError && (
              <p role="alert" className="text-xs text-destructive">
                Locations could not be listed. Check access or try a link below.{' '}
                <button className="underline" onClick={() => discovery.refetch()}>
                  Retry
                </button>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Public threads or locations not listed here can be saved by link below.
            </p>
          </div>
        )}
        <form
          className="space-y-3 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(locator.trim());
          }}
        >
          <Label htmlFor="saved-source-locator">{connector.locatorLabel}</Label>
          <Input
            id="saved-source-locator"
            placeholder={connector.locatorPlaceholder}
            value={locator}
            maxLength={300}
            disabled={save.isPending}
            onChange={(event) => setLocator(event.target.value)}
          />
          {save.isError && (
            <p role="alert" className="text-sm text-destructive">
              {save.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || !locator.trim()}>
              {save.isPending ? 'Checking access…' : 'Save location'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
