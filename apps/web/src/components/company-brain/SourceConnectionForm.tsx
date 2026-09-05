'use client';

import { useState } from 'react';
import type { SourceConnection, SourceConnectorDescriptor } from '@app-starter/shared';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sourceConnectionsApi } from '@/lib/source-connections-api';

interface Props {
  organizationId: string;
  connectors: SourceConnectorDescriptor[];
  connection?: SourceConnection;
  onClose: () => void;
  onSaved: (connection: SourceConnection) => Promise<void>;
}

export const SourceConnectionForm = ({
  organizationId,
  connectors,
  connection,
  onClose,
  onSaved,
}: Props) => {
  const [connectorId, setConnectorId] = useState(
    connection?.connectorId ?? connectors[0]?.id ?? '',
  );
  const [name, setName] = useState(connection?.name ?? '');
  const [config, setConfig] = useState<Record<string, string>>(connection?.config ?? {});
  const [credential, setCredential] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connector = connectors.find((item) => item.id === connectorId);
  const needsCredential = !connection || connection.status === 'DISCONNECTED';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      // Secrets stay in this form's memory, not React Query's mutation cache.
      const result = connection
        ? await sourceConnectionsApi.update(organizationId, connection.id, {
            name,
            ...(credential.trim() ? { credential: credential.trim() } : {}),
            expectedRevision: connection.revision,
          })
        : await sourceConnectionsApi.create(organizationId, {
            connectorId,
            name,
            config,
            credential: credential.trim(),
          });
      setCredential('');
      await onSaved(result);
      onClose();
    } catch (failure) {
      setError(
        failure && typeof failure === 'object' && 'message' in failure
          ? String(failure.message)
          : 'The connection could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{connection ? 'Manage connection' : 'Connect a source'}</DialogTitle>
          <DialogDescription>
            Only owners and admins in this organization can use this connection. Connecting does not
            publish any content.
          </DialogDescription>
        </DialogHeader>
        <form className="min-w-0 space-y-4" onSubmit={handleSubmit}>
          {!connection && (
            <div className="space-y-2">
              <Label htmlFor="connection-provider">Source</Label>
              <Select
                value={connectorId}
                disabled={isSaving}
                onValueChange={(value) => {
                  setConnectorId(value);
                  setConfig({});
                  setCredential('');
                  setError(null);
                }}
              >
                <SelectTrigger id="connection-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {connectors.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="connection-name">Connection name</Label>
            <Input
              id="connection-name"
              placeholder="e.g. Team community"
              value={name}
              maxLength={100}
              required
              disabled={isSaving}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          {connector?.connectionFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`connection-${field.key}`}>{field.label}</Label>
              <Input
                id={`connection-${field.key}`}
                value={config[field.key] ?? ''}
                placeholder={field.placeholder}
                maxLength={300}
                required
                disabled={Boolean(connection) || isSaving}
                onChange={(event) =>
                  setConfig((previous) => ({ ...previous, [field.key]: event.target.value }))
                }
              />
            </div>
          ))}
          {connection && (
            <p className="text-xs text-muted-foreground">
              A different source account needs a new connection. Saved locations stay when you
              replace credentials.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="connection-credential">
              {connector?.credentialLabel ?? 'Credential'}
              {!needsCredential && ' (replace, optional)'}
            </Label>
            <Input
              id="connection-credential"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              value={credential}
              maxLength={4096}
              required={needsCredential}
              disabled={isSaving}
              onChange={(event) => setCredential(event.target.value)}
              aria-describedby="credential-help"
            />
            <p id="credential-help" className="text-xs leading-5 text-muted-foreground">
              Encrypted on the server and never shown again.
              {!needsCredential && ' Leave blank to keep the current credential and check access.'}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {connector && !connector.isConfigured && (
            <p className="text-sm text-muted-foreground">
              The app operator must configure the credential encryption key first.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={isSaving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !connector?.isConfigured}>
              {isSaving ? 'Checking access…' : connection ? 'Verify and save' : 'Connect source'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
