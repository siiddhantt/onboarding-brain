'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Building2, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompanyBrainNavigationProps {
  organizationId: string;
}

export function CompanyBrainNavigation({ organizationId }: CompanyBrainNavigationProps) {
  const pathname = usePathname();
  const basePath = `/organizations/${organizationId}/brain`;
  const items = [
    { href: basePath, label: 'Ask', icon: MessageSquareText, exact: true },
    { href: `${basePath}/knowledge`, label: 'Knowledge', icon: BookOpen },
    { href: `${basePath}/directory`, label: 'Directory', icon: Building2 },
  ];

  return (
    <nav aria-label="Company brain" className="border-b">
      <div className="flex min-w-0 gap-3 overflow-x-auto sm:gap-6">
        {items.map((item) => {
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors',
                isActive
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
