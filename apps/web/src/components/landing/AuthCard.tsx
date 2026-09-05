'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { GoogleAuthButton } from '@/components/auth/GoogleAuthButton';
import { SignUpForm } from './SignUpForm';
import { LoginForm } from './LoginForm';

interface AuthCardProps {
  initialMode?: 'signup' | 'login';
}

export function AuthCard({ initialMode = 'login' }: AuthCardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab');
  const redirectParam = searchParams.get('redirect');
  const emailParam = searchParams.get('email');
  const [mode, setMode] = useState<'signup' | 'login'>(tab === 'signup' ? 'signup' : initialMode);

  // Update mode when tab query param changes
  useEffect(() => {
    if (tab === 'signup') {
      setMode('signup');
    } else if (tab === 'login') {
      setMode('login');
    }
  }, [tab]);

  const handleSwitchToLogin = () => {
    setMode('login');
    // Update URL to preserve redirect and email parameters
    const params = new URLSearchParams();
    params.set('tab', 'login');
    if (redirectParam) {
      params.set('redirect', redirectParam);
    }
    if (emailParam) {
      params.set('email', emailParam);
    }
    router.push(`/login?${params.toString()}`);
  };

  const handleSwitchToSignup = () => {
    setMode('signup');
    // Update URL to preserve redirect and email parameters
    const params = new URLSearchParams();
    params.set('tab', 'signup');
    if (redirectParam) {
      params.set('redirect', redirectParam);
    }
    if (emailParam) {
      params.set('email', emailParam);
    }
    router.push(`/login?${params.toString()}`);
  };

  const googleReturnUrl = redirectParam || undefined;

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl shadow-sm">
      <CardHeader className="pb-5">
        <h1 className="font-display text-2xl font-medium tracking-tight">
          {mode === 'signup' ? 'Create your account' : 'Sign in'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {mode === 'signup'
            ? 'Set up your workspace and invite your team.'
            : 'Good to see you. Pick up where you left off.'}
        </p>
      </CardHeader>
      <CardContent>
        {mode === 'signup' ? (
          <>
            <div className="mb-4">
              <GoogleAuthButton mode="signup" className="mb-4" returnUrl={googleReturnUrl} />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
            </div>
            <SignUpForm key="signup" onSwitchToLogin={handleSwitchToLogin} />
          </>
        ) : (
          <>
            <div className="mb-4">
              <GoogleAuthButton mode="login" className="mb-4" returnUrl={googleReturnUrl} />
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
            </div>
            <LoginForm key="login" onSwitchToSignup={handleSwitchToSignup} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
