'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus } from 'lucide-react';
import type {
  KnowledgeSource,
  SavedSourceLocation,
  SourceConnection,
  SourceConnectorDescriptor,
} from '@app-starter/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { sourceConnectionKeys, sourceConnectionsApi } from '@/lib/source-connections-api';
import { SourceConnectionForm } from './SourceConnectionForm';
import { SaveSourceLocationDialog } from './SaveSourceLocationDialog';

interface Props {
  organizationId: string;
  connectors: SourceConnectorDescriptor[];
  reviewSource?: KnowledgeSource | null;
  isBusy: boolean;
  onChange: (locationId: string, connectorId: string) => void;
  onPreview: (locationId: string) => void;
}

type ConnectionDialog = 'create' | 'manage' | 'location' | 'disconnect' | 'forget';

export const SourceConnectionPicker = ({
  organizationId,
  connectors,
  reviewSource,
  isBusy,
  onChange,
  onPreview,
}: Props) => {
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [dialog, setDialog] = useState<{
    type: ConnectionDialog;
    connection?: SourceConnection;
    location?: SavedSourceLocation;
  } | null>(null);
  const query = useQuery({
    queryKey: sourceConnectionKeys(organizationId),
    queryFn: () => sourceConnectionsApi.list(organizationId),
  });
  const origin = reviewSource?.origin;
  const matching = query.data?.find(
    (item) =>
      item.connectorId === origin?.connectorId &&
      item.locations.some((location) => location.externalId === origin.externalId),
  );
  const connection =
    query.data?.find((item) => item.id === connectionId) ??
    matching ??
    query.data?.find(
      (item) => item.status === 'ACTIVE' && (!origin || item.connectorId === origin.connectorId),
    ) ??
    query.data?.[0];
  const location =
    connection?.locations.find((item) => item.id === locationId) ??
    connection?.locations.find((item) => item.externalId === origin?.externalId) ??
    (!origin ? connection?.locations[0] : undefined);
  const connector = connectors.find((item) => item.id === connection?.connectorId);
  const isActive = connection?.status === 'ACTIVE';
  // Keep the target and revision shown when opening, even if cached lists refresh.
  const handleOpenDialog = (type: ConnectionDialog) => setDialog({ type, connection, location });
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: sourceConnectionKeys(organizationId) });
  const removal = useMutation({
    mutationFn: () =>
      dialog?.type === 'disconnect'
        ? sourceConnectionsApi.disconnect(organizationId, dialog.connection!).then(() => undefined)
        : sourceConnectionsApi.forgetLocation(organizationId, dialog!.location!.id),
    onSuccess: async () => {
      await invalidate();
      setLocationId('');
      setDialog(null);
    },
  });
  const isDisabled = isBusy || removal.isPending;
  const activeLocationId = isActive ? (location?.id ?? '') : '';
  const activeConnectorId = connection?.connectorId ?? '';

  useEffect(() => {
    onChange(activeLocationId, activeConnectorId);
  }, [activeLocationId, activeConnectorId, connection?.revision, onChange]);

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading connections…</p>;
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        Connections could not be loaded.{' '}
        <button className="underline" onClick={() => query.refetch()}>
          Retry
        </button>
      </p>
    );

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="source-connection">Connection</Label>
          <Select
            value={connection?.id ?? ''}
            disabled={isDisabled || !query.data?.length}
            onValueChange={(value) => {
              setConnectionId(value);
              setLocationId('');
            }}
          >
            <SelectTrigger id="source-connection">
              <SelectValue placeholder="Connect a source to begin" />
            </SelectTrigger>
            <SelectContent>
              {query.data?.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                  {item.status === 'DISCONNECTED' && ' · Disconnected'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="source-location">Saved location</Label>
          <Select
            value={location?.id ?? ''}
            disabled={isDisabled || !isActive || !connection?.locations.length}
            onValueChange={setLocationId}
          >
            <SelectTrigger id="source-location">
              <SelectValue placeholder="Save a location once" />
            </SelectTrigger>
            <SelectContent>
              {connection?.locations.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="sm:col-span-2 lg:col-span-1"
          disabled={isDisabled || !activeLocationId}
          onClick={() => onPreview(activeLocationId)}
        >
          Preview
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          disabled={isDisabled || !connectors.length}
          onClick={() => handleOpenDialog('create')}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Connect source
        </Button>
        {connection && (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={isDisabled || !isActive || !connector}
              onClick={() => handleOpenDialog('location')}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Save location
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Connection options"
                  disabled={isDisabled}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={!connector} onSelect={() => handleOpenDialog('manage')}>
                  {isActive ? 'Manage connection' : 'Reconnect source'}
                </DropdownMenuItem>
                {location && (
                  <DropdownMenuItem
                    onSelect={() => {
                      removal.reset();
                      handleOpenDialog('forget');
                    }}
                  >
                    Forget saved location…
                  </DropdownMenuItem>
                )}
                {isActive && (
                  <DropdownMenuItem
                    onSelect={() => {
                      removal.reset();
                      handleOpenDialog('disconnect');
                    }}
                  >
                    Disconnect source…
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {connection.accountName} · {isActive ? 'Connected' : 'Disconnected'}
            </p>
          </>
        )}
      </div>
      {!query.data?.length && (
        <p className="text-xs leading-5 text-muted-foreground">
          Connect a source for this organization, then choose locations by name. Each organization
          keeps its own connections.
        </p>
      )}
      {connection && !isActive && (
        <p className="text-xs leading-5 text-muted-foreground">
          Reconnect from connection options to browse again. Previously published knowledge is
          unchanged.
        </p>
      )}
      {origin && !matching && (
        <p className="text-xs leading-5 text-muted-foreground">
          This published source has no saved location yet. Connect its account and save its original
          link to review it; existing knowledge is unchanged.
        </p>
      )}
      {(dialog?.type === 'create' || dialog?.type === 'manage') && (
        <SourceConnectionForm
          organizationId={organizationId}
          connectors={connectors}
          connection={dialog.type === 'manage' ? dialog.connection : undefined}
          onClose={() => setDialog(null)}
          onSaved={async (result) => {
            await invalidate();
            setConnectionId(result.id);
            setLocationId('');
          }}
        />
      )}
      {dialog?.type === 'location' && dialog.connection && connector && (
        <SaveSourceLocationDialog
          organizationId={organizationId}
          connection={dialog.connection}
          connector={connector}
          initialLocator={origin?.connectorId === connector.id && !matching ? origin.url : ''}
          onClose={() => setDialog(null)}
          onSaved={async (saved) => {
            await invalidate();
            setLocationId(saved.id);
          }}
        />
      )}
      {(dialog?.type === 'disconnect' || dialog?.type === 'forget') && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !removal.isPending) setDialog(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog.type === 'disconnect'
                  ? `Disconnect ${dialog.connection?.name}?`
                  : `Forget ${dialog.location?.name}?`}
              </DialogTitle>
              <DialogDescription>
                {dialog.type === 'disconnect'
                  ? 'The stored credential will be erased and previews invalidated. Saved locations remain for reconnection. This does not revoke the token at its provider.'
                  : 'This removes the shortcut and invalidates its previews. You can save the location again later.'}{' '}
                Published knowledge is kept; remove it separately from indexed knowledge if needed.
                An import already in progress may still finish.
              </DialogDescription>
            </DialogHeader>
            {removal.isError && (
              <p role="alert" className="text-sm text-destructive">
                {removal.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={removal.isPending} onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={removal.isPending}
                onClick={() => removal.mutate()}
              >
                {removal.isPending
                  ? 'Saving…'
                  : dialog.type === 'disconnect'
                    ? 'Disconnect'
                    : 'Forget location'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
