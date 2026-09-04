'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { hasUserMadeChoice, setConsentPreferences } from '@/lib/consent';
import { CookiePreferencesModal } from './CookiePreferencesModal';
import Link from 'next/link';

export const CookieConsentBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Show banner if user hasn't made a choice yet
    if (!hasUserMadeChoice()) {
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    setConsentPreferences({
      essential: true,
      analytics: true,
      marketing: true,
    });
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    setConsentPreferences({
      essential: true,
      analytics: false,
      marketing: false,
    });
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-3 shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <p className="flex-1 text-sm leading-5 text-muted-foreground">
            <span className="font-semibold text-foreground">
              We use cookies to improve your experience.
            </span>{' '}
            Essential cookies keep sign-in secure; optional analytics help us improve the product.
            Learn more in our{' '}
            <Link href="/privacy" className="underline hover:text-foreground transition-colors">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/cookies" className="underline hover:text-foreground transition-colors">
              Cookie Policy
            </Link>
            .
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRejectAll}>
              Reject All
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)}>
              Customize
            </Button>
            <Button size="sm" onClick={handleAcceptAll}>
              Accept All
            </Button>
          </div>
        </div>
      </div>

      <CookiePreferencesModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          // If modal was closed and choice was made, hide banner
          if (hasUserMadeChoice()) {
            setIsVisible(false);
          }
        }}
      />
    </>
  );
};
