'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OtpSignUpForm } from './OtpSignUpForm';
import { PasswordSignUpForm } from './PasswordSignUpForm';

interface SignUpFormProps {
  onSwitchToLogin?: () => void;
}

export function SignUpForm({ onSwitchToLogin }: SignUpFormProps) {
  const [method, setMethod] = useState<'otp' | 'password'>('password');

  return (
    <div>
      <Tabs
        value={method}
        onValueChange={(v) => {
          if (v === 'otp' || v === 'password') {
            setMethod(v);
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="password">Email & Password</TabsTrigger>
          <TabsTrigger value="otp">One-Time Code</TabsTrigger>
        </TabsList>
        <TabsContent value="otp">
          <OtpSignUpForm />
        </TabsContent>
        <TabsContent value="password">
          <PasswordSignUpForm />
        </TabsContent>
      </Tabs>
      {process.env.NODE_ENV === 'development' && (
        <p className="mt-4 rounded-lg border bg-muted/30 px-3 py-2 text-xs leading-5 text-muted-foreground">
          Local development: verification emails and one-time codes appear in{' '}
          <a
            href="http://localhost:8025"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline underline-offset-4"
          >
            the development inbox
          </a>
          .
        </p>
      )}
      {onSwitchToLogin && (
        <div className="text-center text-sm text-muted-foreground mt-4">
          Already have an account?{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onSwitchToLogin();
            }}
            className="text-primary hover:underline font-medium cursor-pointer"
          >
            Log in
          </a>
        </div>
      )}
    </div>
  );
}
