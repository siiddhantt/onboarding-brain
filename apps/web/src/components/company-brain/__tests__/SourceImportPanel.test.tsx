import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SourcePreview } from '@app-starter/shared';
import { SourceImportPanel } from '../SourceImportPanel';
import { companyBrainApi } from '@/lib/company-brain-api';

jest.mock('@/lib/company-brain-api', () => ({
  companyBrainApi: { listConnectors: jest.fn(), previewSource: jest.fn(), importSource: jest.fn() },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn() } }));

describe('SourceImportPanel', () => {
  const snapshot: SourcePreview = {
    id: 'preview-1',
    connectorId: 'fixture',
    externalId: 'collection',
    locator: 'collection',
    name: 'Onboarding policy',
    url: 'https://example.com/policy',
    items: [
      {
        id: 'policy',
        title: 'Expense policy',
        text: 'Submit through Ramp.',
        url: 'https://example.com/policy/1',
        updatedAt: '2026-09-05T00:00:00Z',
      },
      {
        id: 'chatter',
        title: 'Unrelated chat',
        text: 'Anyone up for coffee?',
        url: 'https://example.com/policy/2',
        updatedAt: '2026-09-05T00:00:00Z',
      },
    ],
    selectedIds: [],
    savedItemIds: [],
    sourceId: null,
    sourceVersion: null,
    wasRemoved: false,
    nextCursor: null,
    expiresAt: '2099-09-05T00:15:00Z',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    (companyBrainApi.listConnectors as jest.Mock).mockResolvedValue([
      {
        id: 'fixture',
        name: 'Example source',
        locatorLabel: 'Collection',
        locatorPlaceholder: 'Collection ID',
        emptyStateHint: '',
        isConfigured: true,
      },
    ]);
    (companyBrainApi.previewSource as jest.Mock).mockResolvedValue(snapshot);
    (companyBrainApi.importSource as jest.Mock).mockResolvedValue({
      id: 'source-1',
      status: 'READY',
      version: 1,
    });
  });
  const setup = async () => {
    const user = userEvent.setup();
    const onImported = jest.fn().mockResolvedValue(undefined);
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <SourceImportPanel organizationId="org-1" isConfigured onImported={onImported} />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: /Import from a connected source/ }));
    const input = await screen.findByLabelText('Collection');
    await user.type(input, 'collection');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    await screen.findByText('Onboarding policy');
    return { user, onImported };
  };

  it('requires selection and sharing confirmation, then submits IDs rather than client-authored content', async () => {
    const { user, onImported } = await setup();
    const submit = screen.getByRole('button', { name: 'Import selected knowledge' });
    expect(submit).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Include Unrelated chat' })).not.toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Include Expense policy' }));
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /I have permission to share/ }));
    await user.click(submit);
    await waitFor(() =>
      expect(companyBrainApi.importSource).toHaveBeenCalledWith('org-1', {
        previewId: 'preview-1',
        selectedIds: ['policy'],
        shareWithOrganization: true,
        restoreRemoved: false,
      }),
    );
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1));
  });

  it('requires an explicit re-add decision for a removed source', async () => {
    (companyBrainApi.previewSource as jest.Mock).mockResolvedValue({
      ...snapshot,
      wasRemoved: true,
      sourceId: 'removed-source',
      sourceVersion: 2,
    });
    const { user } = await setup();
    await user.click(screen.getByRole('checkbox', { name: 'Include Expense policy' }));
    await user.click(screen.getByRole('checkbox', { name: /I have permission to share/ }));
    const submit = screen.getByRole('button', { name: 'Import selected knowledge' });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Explicitly re-add/ }));
    await user.click(submit);
    await waitFor(() =>
      expect(companyBrainApi.importSource).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ restoreRemoved: true }),
      ),
    );
  });

  it('preserves manual selection across pagination without automatically selecting new items', async () => {
    (companyBrainApi.previewSource as jest.Mock)
      .mockResolvedValueOnce({ ...snapshot, nextCursor: 'older' })
      .mockResolvedValueOnce({ ...snapshot, id: 'preview-2' });
    const { user } = await setup();
    await user.click(screen.getByRole('checkbox', { name: 'Include Expense policy' }));
    await user.click(screen.getByRole('button', { name: 'Load older items' }));
    await waitFor(() =>
      expect(companyBrainApi.previewSource).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ previewId: 'preview-1', cursor: 'older' }),
      ),
    );
    expect(screen.getByRole('checkbox', { name: 'Include Expense policy' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Include Unrelated chat' })).not.toBeChecked();
  });
});
