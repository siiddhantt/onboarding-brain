import { render, screen } from '@testing-library/react';
import { Building2, LayoutDashboard } from 'lucide-react';
import SidebarNav from '../SidebarNav';

describe('SidebarNav', () => {
  it('renders a compact accessible icon rail with distinct active and hover states', () => {
    render(
      <SidebarNav
        activePath="/dashboard"
        items={[
          { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
          { path: '/organizations', label: 'Organizations', icon: Building2 },
        ]}
      />,
    );

    const home = screen.getByRole('link', { name: 'Home' });
    const organizations = screen.getByRole('link', { name: 'Organizations' });

    expect(home).toHaveAttribute('aria-current', 'page');
    expect(home).toHaveClass('bg-accent', 'shadow-sm');
    expect(organizations).toHaveClass('hover:bg-accent/55');
    expect(screen.getByText('Organizations')).toHaveClass('sr-only');
  });
});
