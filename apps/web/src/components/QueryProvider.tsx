'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { authStorage, AUTH_CHANGE_EVENT } from '@/lib/auth-storage';

const getAuthIdentity = () =>
  authStorage.isAuthenticated() ? (authStorage.getUser()?.id ?? 'anonymous') : 'anonymous';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  useEffect(() => {
    let identity = getAuthIdentity();
    const handleAuthChange = () => {
      const nextIdentity = getAuthIdentity();
      if (identity === nextIdentity) return;
      identity = nextIdentity;
      // Account switches must discard cached roles/data without remounting an invite flow.
      queryClient.getMutationCache().clear();
      void queryClient.resetQueries();
    };
    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
