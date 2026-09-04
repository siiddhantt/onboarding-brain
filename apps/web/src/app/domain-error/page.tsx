import React from 'react';
import Link from 'next/link';

export default async function DomainErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; reason?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const domain = resolvedSearchParams.domain || 'This domain';
  const reason = resolvedSearchParams.reason;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">Domain not active</h1>
          <p className="text-muted-foreground">
            {reason === 'not_found'
              ? `The domain "${domain}" is not currently associated with an organization.`
              : `We couldn't verify the configuration for "${domain}".`}
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            If you administer this domain, check the organization&apos;s domain settings and DNS
            configuration.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              Go to Onboarding Brain
            </Link>
            <Link
              href="mailto:support@example.com"
              className="inline-flex items-center justify-center rounded-md border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
