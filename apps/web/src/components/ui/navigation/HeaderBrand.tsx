import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface HeaderBrandProps {
  to?: string;
  href?: string;
  logoSrc?: string;
  logoAlt?: string;
  brandName?: ReactNode;
  logoHeight?: number | null;
  isCustomLogo?: boolean;
  as?: ElementType;
  className?: string;
  [key: string]: unknown;
}

const HeaderBrand = ({
  to,
  href,
  logoSrc,
  logoAlt = 'Logo',
  brandName,
  logoHeight,
  isCustomLogo,
  as: Component = 'a',
  className = '',
  ...rest
}: HeaderBrandProps) => {
  const linkProps = to != null ? { to } : { href: href ?? '#' };
  return (
    <Component
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-sm text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...linkProps}
      {...rest}
    >
      {logoSrc && (
        <img
          src={logoSrc}
          alt={logoAlt}
          className={
            logoHeight
              ? 'w-auto flex-shrink-0'
              : isCustomLogo
                ? 'max-h-10 w-auto object-contain flex-shrink-0'
                : 'h-8 w-8 flex-shrink-0'
          }
          style={logoHeight ? { height: `${logoHeight}px`, maxHeight: '40px' } : undefined}
        />
      )}
      {brandName != null && (
        <span className="min-w-0 font-display text-sm font-medium leading-tight tracking-tight sm:text-[17px]">
          {brandName}
        </span>
      )}
    </Component>
  );
};

export default HeaderBrand;
