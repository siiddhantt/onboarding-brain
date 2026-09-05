import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { AUTH_CHANGE_EVENT } from '@/lib/auth-storage';
import { QueryProvider } from '../QueryProvider';

let mockIdentity: string | null = 'owner';
jest.mock('@/lib/auth-storage', () => ({
  AUTH_CHANGE_EVENT: 'app-starter:auth-change',
  authStorage: {
    isAuthenticated: () => mockIdentity !== null,
    getUser: () => ({ id: mockIdentity }),
  },
}));

describe('QueryProvider account isolation', () => {
  let client: QueryClient;
  const load = jest.fn<Promise<string>, []>();
  const mounted = jest.fn();
  const Probe = () => {
    client = useQueryClient();
    const { data } = useQuery({ queryKey: ['organization-members', 'org-1'], queryFn: load });
    return <div ref={mounted}>{data ?? 'Loading'}</div>;
  };

  beforeEach(() => {
    mockIdentity = 'owner';
    load.mockReset().mockResolvedValue('Owner data');
    mounted.mockClear();
  });

  it.each([AUTH_CHANGE_EVENT, 'storage'])(
    'clears active and inactive data on %s without remounting the page',
    async (event) => {
      render(
        <QueryProvider>
          <Probe />
        </QueryProvider>,
      );
      await screen.findByText('Owner data');
      client.setQueryData(['departments', 'org-1'], 'Private cached data');
      let finishMemberRequest!: (value: string) => void;
      load.mockImplementation(
        () =>
          new Promise((resolve) => {
            finishMemberRequest = resolve;
          }),
      );
      act(() => {
        mockIdentity = 'member';
        window.dispatchEvent(new Event(event));
      });
      expect(client.getQueryData(['organization-members', 'org-1'])).toBeUndefined();
      await screen.findByText('Loading');
      await act(async () => finishMemberRequest('Member data'));
      await screen.findByText('Member data');
      expect(client.getQueryData(['departments', 'org-1'])).toBeUndefined();
      expect(mounted).toHaveBeenCalledTimes(1);
    },
  );

  it('ignores a late response from the previous account', async () => {
    let finishOwnerRequest!: (value: string) => void;
    load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOwnerRequest = resolve;
        }),
    );
    render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    load.mockResolvedValue('Member data');
    act(() => {
      mockIdentity = 'member';
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    });
    await screen.findByText('Member data');
    await act(async () => finishOwnerRequest('Owner data'));
    expect(screen.queryByText('Owner data')).not.toBeInTheDocument();
  });

  it('keeps data on token refresh but clears it on logout', async () => {
    render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );
    await screen.findByText('Owner data');
    act(() => window.dispatchEvent(new Event(AUTH_CHANGE_EVENT)));
    expect(load).toHaveBeenCalledTimes(1);
    load.mockResolvedValue('Signed out');
    act(() => {
      mockIdentity = null;
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    });
    await screen.findByText('Signed out');
    expect(screen.queryByText('Owner data')).not.toBeInTheDocument();
  });
});
