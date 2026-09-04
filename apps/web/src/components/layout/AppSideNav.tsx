'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Building2, LayoutDashboard, Settings } from 'lucide-react';
import SidebarNav from '@/components/ui/SidebarNav';

const SIDE_NAV_ITEMS = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/organizations', label: 'Organizations', icon: Building2 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

/**
 * Main app sidebar using the shared SidebarNav.
 * Home → /dashboard, plus organizations and settings.
 */
export function AppSideNav() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-16 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
      aria-label="Main navigation"
    >
      <SidebarNav
        activePath={pathname ?? ''}
        LinkComponent={({ to, className, children, active }) => (
          <Link href={to} className={className} aria-current={active ? 'page' : undefined}>
            {children}
          </Link>
        )}
        items={SIDE_NAV_ITEMS}
        className="pt-3"
      />
    </aside>
  );
}
