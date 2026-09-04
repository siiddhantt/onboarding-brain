import type { ReactNode } from 'react';

export interface HeaderProps {
  children?: ReactNode;
  className?: string;
  fixed?: boolean;
}

const Header = ({ children, className = '', fixed = true, ...rest }: HeaderProps) => {
  const positionClass = fixed ? 'fixed top-0 left-0 right-0 z-30' : 'relative';
  const baseClass =
    'h-14 border-b border-border bg-card text-card-foreground flex items-center justify-between px-4';
  const combined = [positionClass, baseClass, className].filter(Boolean).join(' ');
  return (
    <header className={combined} {...rest}>
      {children}
    </header>
  );
};

export default Header;
