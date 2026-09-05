'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { UserProfileMenu } from '@/components/public/UserProfileMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Header,
  HeaderBrand,
  HeaderActions,
  HeaderMobileMenuTrigger,
} from '@/components/ui/navigation';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/Sheet';
import { BRAND_NAME, LOGO_PATH } from '@/lib/brand';
import { Menu, Home, Building2, Settings } from 'lucide-react';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';

import { useAuth } from '@/hooks/use-auth';

import { getManagementUrl } from '@/lib/url-generator';

export function UnifiedHeader({
  customLogoUrl,
  logoHeight,
}: {
  customLogoUrl?: string | null;
  logoHeight?: number | null;
}) {
  const { isAuthenticated, isLoaded } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Before mount or during initial load, show unauthenticated UI to avoid flashing
  const showAuthenticatedUI = isLoaded && isAuthenticated;

  return (
    <Header
      fixed={false}
      className="sticky top-0 z-50 w-full h-16 border-border bg-card/80 backdrop-blur-md px-4 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3 h-full w-full">
        <div className="flex items-center gap-6 min-w-0">
          <HeaderBrand
            as={Link}
            href="/"
            logoSrc={customLogoUrl || LOGO_PATH}
            aria-label={`${BRAND_NAME} home`}
            logoAlt=""
            brandName={customLogoUrl ? '' : BRAND_NAME}
            logoHeight={logoHeight}
            isCustomLogo={!!customLogoUrl}
            className={customLogoUrl && !logoHeight ? 'max-h-10 w-auto' : undefined}
          />
        </div>

        <HeaderActions className="shrink-0 gap-1 sm:gap-3">
          <ThemeToggle />
          {showAuthenticatedUI ? (
            <>
              <div className="hidden sm:block">
                <NotificationCenter />
              </div>
              <UserProfileMenu />
            </>
          ) : isLoaded ? (
            <>
              <Button asChild size="sm" className="hidden rounded-full md:inline-flex">
                <Link href={getManagementUrl('/get-started')}>Get started</Link>
              </Button>
              <Button asChild size="sm" variant="ghost" className="rounded-full">
                <Link href={getManagementUrl('/login')}>Sign in</Link>
              </Button>
            </>
          ) : null}

          {showAuthenticatedUI && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <HeaderMobileMenuTrigger aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                </HeaderMobileMenuTrigger>
              </SheetTrigger>
              <SheetContent side="right">
                <div className="flex flex-col gap-3">
                  <nav className="flex flex-col gap-2" aria-label="Main navigation">
                    <Link
                      href={getManagementUrl('/dashboard')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Home className="h-5 w-5 flex-shrink-0" />
                      <span>Home</span>
                    </Link>
                    <Link
                      href={getManagementUrl('/organizations')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Building2 className="h-5 w-5 flex-shrink-0" />
                      <span>Organizations</span>
                    </Link>
                    <Link
                      href={getManagementUrl('/settings')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Settings className="h-5 w-5 flex-shrink-0" />
                      <span>Settings</span>
                    </Link>
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </HeaderActions>
      </div>
    </Header>
  );
}
