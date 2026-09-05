import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      .mockResolvedValueOnce({
        ...snapshot,
        id: 'preview-2',
        items: [
          ...snapshot.items,
          { ...snapshot.items[0], id: 'older-policy', title: 'Older policy' },
        ],
      });
    const { user } = await setup();
    expect(companyBrainApi.previewSource).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('checkbox', { name: 'Include Expense policy' }));
    await user.click(screen.getByRole('button', { name: 'Load more items' }));
    await waitFor(() =>
      expect(companyBrainApi.previewSource).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ previewId: 'preview-1', cursor: 'older' }),
      ),
    );
    expect(screen.getByRole('checkbox', { name: 'Include Expense policy' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Include Unrelated chat' })).not.toBeChecked();
    expect(await screen.findByRole('checkbox', { name: 'Include Older policy' })).not.toBeChecked();
    expect(companyBrainApi.previewSource).toHaveBeenCalledTimes(2);
  });

  it('keeps selected items first and visible while text and date filters narrow unselected items', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('checkbox', { name: 'Include Unrelated chat' }));
    const list = within(screen.getByRole('region', { name: 'Source preview items' }));
    expect(list.getAllByRole('checkbox')[0]).toHaveAccessibleName('Include Unrelated chat');
    await user.type(screen.getByLabelText('Filter preview items'), 'Ramp');
    expect(list.getAllByRole('checkbox')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Updated from'), { target: { value: '2026-09-06' } });
    expect(list.getAllByRole('checkbox')).toHaveLength(1);
    expect(list.getByRole('checkbox', { name: 'Include Unrelated chat' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /I have permission to share/ }));
    await user.click(screen.getByRole('button', { name: 'Import selected knowledge' }));
    await waitFor(() =>
      expect(companyBrainApi.importSource).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ selectedIds: ['chatter'] }),
      ),
    );
  });

  it('uses native search only on submit and preserves selections through queries, failures and pages', async () => {
    const descriptors = await companyBrainApi.listConnectors('org-1');
    (companyBrainApi.listConnectors as jest.Mock).mockResolvedValue([
      { ...descriptors[0], search: { dateField: 'createdAt' } },
    ]);
    const { user } = await setup();
    await user.click(screen.getByRole('checkbox', { name: 'Include Expense policy' }));
    await user.click(screen.getByRole('combobox', { name: 'Search scope' }));
    await user.click(screen.getByRole('option', { name: 'Search source' }));
    await user.type(screen.getByLabelText('Filter preview items'), 'coffee');
    expect(companyBrainApi.previewSource).toHaveBeenCalledTimes(1);
    (companyBrainApi.previewSource as jest.Mock).mockRejectedValueOnce(
      new Error('Search unavailable'),
    );
    await user.click(screen.getByRole('button', { name: 'Search source' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Search unavailable');
    expect(screen.getByRole('checkbox', { name: 'Include Expense policy' })).toBeChecked();
    (companyBrainApi.previewSource as jest.Mock).mockResolvedValueOnce({
      ...snapshot,
      id: 'searched',
      query: { text: 'coffee' },
      resultIds: ['chatter'],
      nextCursor: 'page-2',
    });
    await user.click(screen.getByRole('button', { name: 'Search source' }));
    await screen.findByRole('button', { name: 'Load more items' });
    expect(companyBrainApi.previewSource).toHaveBeenLastCalledWith('org-1', {
      connectorId: 'fixture',
      locator: 'collection',
      previewId: 'preview-1',
      query: { text: 'coffee' },
    });
    await user.click(screen.getByRole('button', { name: 'Load more items' }));
    await waitFor(() =>
      expect(companyBrainApi.previewSource).toHaveBeenLastCalledWith('org-1', {
        connectorId: 'fixture',
        locator: 'collection',
        previewId: 'searched',
        cursor: 'page-2',
        query: { text: 'coffee' },
      }),
    );
    expect(screen.getByRole('checkbox', { name: 'Include Expense policy' })).toBeChecked();
  });
});
