import { Suspense } from 'react';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import OrganizationSettingsPage from '../organizations/[organizationId]/settings/page';
import { domainMappingsApi } from '@/lib/domain-mappings-api';

jest.mock('@/lib/domain-mappings-api', () => ({ domainMappingsApi: { list: jest.fn() } }));
jest.mock('@/components/organizations/InviteOrganizationMembersDialog', () => ({
  InviteOrganizationMembersDialog: () => null,
}));

async function renderSettings(role?: 'MEMBER' | 'ADMIN' | 'OWNER') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(['organization', 'org-1'], { id: 'org-1', name: 'Northstar' });
  client.setQueryData(['organization-role', 'org-1'], role ? { role } : {});
  client.setQueryData(['organization-members', 'org-1'], { users: [] });
  (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('section=domains'));
  const params = Promise.resolve({ organizationId: 'org-1' });
  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <Suspense fallback="Loading">
          <OrganizationSettingsPage params={params} />
        </Suspense>
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (domainMappingsApi.list as jest.Mock).mockResolvedValue({ domainMappings: [] });
});

it.each(['MEMBER', undefined] as const)(
  'hides and does not fetch custom domains for role %s',
  async (role) => {
    await renderSettings(role);
    expect(screen.queryByRole('tab', { name: 'Custom domain' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'General' })).toHaveAttribute('aria-selected', 'true');
    expect(domainMappingsApi.list).not.toHaveBeenCalled();
  },
);

it.each(['OWNER', 'ADMIN'] as const)(
  'keeps optional domain setup available for %s',
  async (role) => {
    await renderSettings(role);
    expect(screen.getByRole('tab', { name: 'Custom domain' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(/it does not control which email addresses/)).toBeInTheDocument();
    expect(domainMappingsApi.list).toHaveBeenCalledWith('org-1');
  },
);
