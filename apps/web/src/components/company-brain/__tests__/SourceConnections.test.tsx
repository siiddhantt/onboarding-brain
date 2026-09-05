import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SourceConnection, SourceConnectorDescriptor } from '@app-starter/shared';
import { SourceConnectionForm } from '../SourceConnectionForm';
import { SourceConnectionPicker } from '../SourceConnectionPicker';
import { SaveSourceLocationDialog } from '../SaveSourceLocationDialog';
import { sourceConnectionsApi } from '@/lib/source-connections-api';

jest.mock('@/lib/source-connections-api', () => ({
  sourceConnectionsApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    discover: jest.fn(),
    saveLocation: jest.fn(),
    disconnect: jest.fn(),
    forgetLocation: jest.fn(),
  },
  sourceConnectionKeys: (org: string) => ['source-connections', org],
}));

const connector: SourceConnectorDescriptor = {
  id: 'fixture',
  name: 'Example source',
  locatorLabel: 'Page link',
  locatorPlaceholder: 'https://example.com/page',
  emptyStateHint: '',
  isConfigured: true,
  credentialLabel: 'Access token',
  canDiscoverLocations: true,
  connectionFields: [{ key: 'workspace', label: 'Workspace', placeholder: 'Workspace ID' }],
};
const location = {
  id: 'location-a',
  connectionId: 'connection-a',
  externalId: 'workspace/page',
  name: 'Team handbook',
  locator: 'page',
  url: 'https://example.com/page',
};
const connection: SourceConnection = {
  id: 'connection-a',
  connectorId: 'fixture',
  name: 'Team source',
  accountName: 'Workspace',
  config: { workspace: 'team' },
  status: 'ACTIVE',
  revision: 2,
  lastVerifiedAt: '2026-09-05T00:00:00Z',
  locations: [location],
};

describe('Source connections', () => {
  beforeEach(() => jest.clearAllMocks());
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );

  it('creates a named connection and clears its password field after saving without caching the secret', async () => {
    const user = userEvent.setup();
    const saved = jest.fn();
    const close = jest.fn();
    jest.mocked(sourceConnectionsApi.create).mockResolvedValue(connection);
    render(
      <SourceConnectionForm
        organizationId="org-a"
        connectors={[connector]}
        onClose={close}
        onSaved={saved}
      />,
    );
    await user.type(screen.getByLabelText('Connection name'), 'Team source');
    await user.type(screen.getByLabelText('Workspace'), 'team');
    await user.type(screen.getByLabelText('Access token'), 'private-token');
    expect(screen.getByLabelText('Access token')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Connect source' }));
    await waitFor(() =>
      expect(sourceConnectionsApi.create).toHaveBeenCalledWith('org-a', {
        connectorId: 'fixture',
        name: 'Team source',
        config: { workspace: 'team' },
        credential: 'private-token',
      }),
    );
    expect(screen.getByLabelText('Access token')).toHaveValue('');
    expect(saved).toHaveBeenCalledWith(connection);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps source identity fixed while replacing a credential and requires one to reconnect', async () => {
    const user = userEvent.setup();
    jest.mocked(sourceConnectionsApi.update).mockResolvedValue(connection);
    render(
      <SourceConnectionForm
        organizationId="org-a"
        connectors={[connector]}
        connection={{ ...connection, status: 'DISCONNECTED' }}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Workspace')).toBeDisabled();
    expect(screen.getByLabelText('Access token')).toBeRequired();
    await user.type(screen.getByLabelText('Access token'), 'replacement-token');
    await user.click(screen.getByRole('button', { name: 'Verify and save' }));
    await waitFor(() =>
      expect(sourceConnectionsApi.update).toHaveBeenCalledWith('org-a', 'connection-a', {
        name: 'Team source',
        credential: 'replacement-token',
        expectedRevision: 2,
      }),
    );
  });

  it('previews a persisted location without asking for an ID, and requires confirmation before disconnecting', async () => {
    const user = userEvent.setup();
    const onPreview = jest.fn();
    jest.mocked(sourceConnectionsApi.list).mockResolvedValue([connection]);
    jest
      .mocked(sourceConnectionsApi.disconnect)
      .mockResolvedValue({ ...connection, status: 'DISCONNECTED', revision: 3 });
    render(
      <SourceConnectionPicker
        organizationId="org-a"
        connectors={[connector]}
        isBusy={false}
        onChange={jest.fn()}
        onPreview={onPreview}
      />,
      { wrapper },
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled());
    expect(screen.getByRole('combobox', { name: 'Saved location' })).toHaveTextContent(
      'Team handbook',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(onPreview).toHaveBeenCalledWith('location-a');
    await user.click(screen.getByRole('button', { name: 'Connection options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Disconnect source…' }));
    expect(sourceConnectionsApi.disconnect).not.toHaveBeenCalled();
    expect(screen.getByText(/Published knowledge is kept/)).toBeInTheDocument();
    jest
      .mocked(sourceConnectionsApi.list)
      .mockResolvedValue([{ ...connection, status: 'DISCONNECTED', revision: 3 }]);
    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() =>
      expect(sourceConnectionsApi.disconnect).toHaveBeenCalledWith('org-a', connection),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled());
  });

  it('discovers and saves named locations without implicitly publishing them', async () => {
    const user = userEvent.setup();
    const saved = jest.fn();
    jest
      .mocked(sourceConnectionsApi.discover)
      .mockResolvedValue([
        location,
        { ...location, externalId: 'workspace/new', name: 'New guide', locator: 'new' },
      ]);
    jest
      .mocked(sourceConnectionsApi.saveLocation)
      .mockResolvedValue({ ...location, id: 'new-location' });
    render(
      <SaveSourceLocationDialog
        organizationId="org-a"
        connection={connection}
        connector={connector}
        onClose={jest.fn()}
        onSaved={saved}
      />,
      { wrapper },
    );
    await user.click(await screen.findByRole('option', { name: 'New guide Save' }));
    await waitFor(() =>
      expect(sourceConnectionsApi.saveLocation).toHaveBeenCalledWith('org-a', 'connection-a', {
        locator: 'new',
        expectedRevision: 2,
      }),
    );
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-location' }));
  });
});
