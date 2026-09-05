import { render, screen } from '@testing-library/react';
import { UnifiedHeader } from '../UnifiedHeader';
import { LOGO_PATH } from '@/lib/brand';
import { useAuth } from '@/hooks/use-auth';
import { getManagementUrl } from '@/lib/url-generator';

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));

// Mock other components used in UnifiedHeader
jest.mock('@/components/public/UserProfileMenu', () => ({
  UserProfileMenu: () => <div>UserProfileMenu</div>,
}));
jest.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div>ThemeToggle</div>,
}));
jest.mock('@/components/notifications/NotificationCenter', () => ({
  NotificationCenter: () => <div>NotificationCenter</div>,
}));

describe('UnifiedHeader', () => {
  beforeEach(() => {
    (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isAuthenticated: false });
  });

  it('uses default logo when customLogoUrl is not provided', () => {
    render(<UnifiedHeader />);
    const brand = screen.getByRole('link', { name: 'Onboarding Brain home' });
    expect(brand.querySelector('img')).toHaveAttribute('src', LOGO_PATH);
    expect(brand).toHaveTextContent('Onboarding Brain');
  });

  it('uses custom logo when customLogoUrl is provided', () => {
    const customLogoUrl = 'https://example.com/custom-logo.png';
    render(<UnifiedHeader customLogoUrl={customLogoUrl} />);
    const brand = screen.getByRole('link', { name: 'Onboarding Brain home' });
    expect(brand.querySelector('img')).toHaveAttribute('src', customLogoUrl);
    expect(brand).toHaveTextContent('');
  });

  it('uses default logo when customLogoUrl is null', () => {
    render(<UnifiedHeader customLogoUrl={null} />);
    const brand = screen.getByRole('link', { name: 'Onboarding Brain home' });
    expect(brand.querySelector('img')).toHaveAttribute('src', LOGO_PATH);
    expect(brand).toHaveTextContent('Onboarding Brain');
  });

  it('exposes sign-in without opening a mobile menu', () => {
    render(<UnifiedHeader />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      getManagementUrl('/login'),
    );
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
  });

  it('keeps workspace navigation for signed-in users', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isAuthenticated: true });
    render(<UnifiedHeader />);
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Get started' })).not.toBeInTheDocument();
  });

  it('does not show guest actions before auth is loaded', () => {
    (useAuth as jest.Mock).mockReturnValue({ isLoaded: false, isAuthenticated: false });
    render(<UnifiedHeader />);
    expect(screen.queryByRole('link', { name: /Sign in|Get started/ })).not.toBeInTheDocument();
  });
});
