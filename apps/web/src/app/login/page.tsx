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
      <div className="min-h-[calc(100svh-4rem)] bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Only show login/signup if not authenticated
  return (
    <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-10 bg-background px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
      <div className="hidden lg:block">
        <LandingHero />
      </div>
      <div className="mx-auto w-full max-w-md lg:mx-0">
        <AuthCard initialMode={initialMode} />
      </div>
    </div>
  );
}
