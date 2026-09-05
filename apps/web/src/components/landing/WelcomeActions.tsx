'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export const WelcomeActions = () => {
  const { isAuthenticated, isLoaded } = useAuth();

  return (
    <div className="space-y-3">
      <div className="flex min-h-12 flex-wrap items-center gap-2">
        {!isLoaded ? (
          <Button size="lg" className="rounded-full" disabled>
            Open your workspace
          </Button>
        ) : isAuthenticated ? (
          <Button asChild size="lg" className="rounded-full">
            <Link href="/dashboard">
              Open your workspace
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg" className="rounded-full">
              <Link href="/get-started">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full">
              <Link href="/login">Sign in</Link>
            </Button>
          </>
        )}
      </div>
      {isLoaded && !isAuthenticated && (
        <p className="text-xs text-muted-foreground">
          Already invited? Follow the link in your email.
        </p>
      )}
    </div>
  );
};
