'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import LandingHero from '@/components/landing/LandingHero';
import { AuthCard } from '@/components/landing/AuthCard';
import { authStorage } from '@/lib/auth-storage';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab');
  const initialMode = tab === 'signup' ? 'signup' : 'login';
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    if (authStorage.isAuthenticated()) {
      const redirect = searchParams.get('redirect');

      if (redirect) {
        router.push(redirect);
      } else {
        router.push('/dashboard');
      }
    } else {
      // Show login page if not authenticated
      setIsCheckingAuth(false);
    }
  }, [router]);

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </main>
    );
  }

  // Only show login/signup if not authenticated
  return (
    <main className="min-h-[calc(100svh-4rem)] bg-background px-4 py-6 pb-36 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:gap-16 lg:px-12 xl:px-20">
      <div className="hidden lg:block">
        <LandingHero />
      </div>
      <div className="mx-auto w-full max-w-md lg:mx-0">
        <AuthCard initialMode={initialMode} />
      </div>
    </main>
  );
}
