import type { ComponentType, ReactNode } from 'react';

export interface SubNavItem {
  path: string;
  label: string;
  exact?: boolean;
}

export interface SubNavLinkComponentProps {
  to: string;
  className: string;
  children: ReactNode;
  active: boolean;
}

export interface SubNavProps {
  items: SubNavItem[];
  activePath?: string;
  LinkComponent?: ComponentType<SubNavLinkComponentProps>;
  className?: string;
  ariaLabel?: string;
}

const SubNav = ({
  items,
  activePath = '',
  LinkComponent,
  className = '',
  ariaLabel = 'Sub-navigation',
  ...rest
}: SubNavProps) => {
  const isActive = (path: string, exact?: boolean) => {
    if (exact) return activePath === path;
    return activePath === path || (path !== '/' && activePath.startsWith(path + '/'));
  };

  const DefaultLink = ({
    to,
    className: linkClassName,
    children,
    active,
  }: SubNavLinkComponentProps) => (
    <a href={to} className={linkClassName} aria-current={active ? 'page' : undefined}>
      {children}
    </a>
  );

  const Link = LinkComponent ?? DefaultLink;

  return (
    <header className={`border-b border-border bg-card px-4 py-3 ${className}`.trim()} {...rest}>
      <nav className="flex items-center gap-1" aria-label={ariaLabel}>
        {items.map((item) => {
          const active = isActive(item.path, item.exact);
          const linkClassName = [
            'inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            active
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          ].join(' ');
          return (
            <Link key={item.path} to={item.path} className={linkClassName} active={active}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
};

export default SubNav;
