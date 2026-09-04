import type { ReactNode, ComponentType } from 'react';

export interface SidebarNavLinkItem {
  path: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

export interface SidebarNavDividerItem {
  type: 'divider';
}

export interface SidebarNavSpacerItem {
  type: 'spacer';
}

export type SidebarNavItem = SidebarNavLinkItem | SidebarNavDividerItem | SidebarNavSpacerItem;

export interface SidebarNavLinkComponentProps {
  to: string;
  className: string;
  children: ReactNode;
  active: boolean;
  label: string;
}

export interface SidebarNavProps {
  items: SidebarNavItem[];
  className?: string;
  activePath?: string;
  LinkComponent?: ComponentType<SidebarNavLinkComponentProps>;
}

function isLinkItem(item: SidebarNavItem): item is SidebarNavLinkItem {
  return 'path' in item && 'label' in item;
}

const SidebarNav = ({ items, className = '', activePath = '', LinkComponent }: SidebarNavProps) => {
  const isNavActive = (path: string) => {
    if (path === '/') return activePath === '/';
    return activePath.startsWith(path);
  };

  const linkIndices = items.map((item, i) => (isLinkItem(item) ? i : -1)).filter((i) => i >= 0);
  const lastLinkIndex = linkIndices.length > 0 ? linkIndices[linkIndices.length - 1]! : -1;

  const DefaultLink = ({
    to,
    className: linkClassName,
    children,
    active,
    label,
  }: SidebarNavLinkComponentProps) => (
    <a
      href={to}
      className={linkClassName}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
    >
      {children}
    </a>
  );

  const Link = LinkComponent ?? DefaultLink;

  return (
    <div
      className={`flex flex-col h-full overflow-y-auto ${className}`.trim()}
      role="navigation"
      aria-label="Sidebar navigation"
    >
      {items.map((item, index) => {
        if ('type' in item && item.type === 'divider') {
          return (
            <div key={`divider-${index}`} className="mx-2 my-2 border-t border-sidebar-border" />
          );
        }
        if ('type' in item && item.type === 'spacer') {
          return <div key={`spacer-${index}`} className="flex-1" />;
        }
        const linkItem = item as SidebarNavLinkItem;
        const { path, label, icon: Icon } = linkItem;
        const active = isNavActive(path);
        const isLastLink = index === lastLinkIndex;
        const linkClassName = [
          'group relative mx-2 flex h-11 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
          isLastLink ? 'mb-2' : '',
          active
            ? 'bg-accent text-accent-foreground shadow-sm'
            : 'text-sidebar-foreground/65 hover:bg-accent/55 hover:text-accent-foreground',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <Link key={path} to={path} className={linkClassName} active={active} label={label}>
            {active && (
              <span
                aria-hidden="true"
                className="absolute -left-2 h-5 w-0.5 rounded-full bg-accent-foreground"
              />
            )}
            {Icon && <Icon className="h-5 w-5 shrink-0" />}
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </div>
  );
};

export default SidebarNav;
