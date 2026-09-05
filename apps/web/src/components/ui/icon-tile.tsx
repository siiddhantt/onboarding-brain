import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A fixed square prevents icons stretching with multi-line card content. */
export const IconTile = ({ icon: Icon, className }: { icon: LucideIcon; className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-flex h-8 w-8 shrink-0 self-start items-center justify-center rounded-lg bg-muted text-muted-foreground',
      className,
    )}
  >
    <Icon className="h-4 w-4" />
  </span>
);
