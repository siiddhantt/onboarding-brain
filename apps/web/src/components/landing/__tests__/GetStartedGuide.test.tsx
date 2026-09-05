import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { GetStartedGuide } from '../GetStartedGuide';

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));

const mockReplace = jest.fn();

beforeEach(() => {
  mockReplace.mockClear();
  (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });
  (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isAuthenticated: false });
});

it('shows the account creation guide to signed-out visitors', () => {
  render(<GetStartedGuide />);
  expect(screen.getByRole('link', { name: /Create your account/ })).toHaveAttribute(
    'href',
    '/login?tab=signup',
  );
  expect(mockReplace).not.toHaveBeenCalled();
});

it('redirects signed-in visitors without displaying signup instructions', () => {
  (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isAuthenticated: true });
  render(<GetStartedGuide />);
  expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  expect(screen.queryByText('Create your account')).not.toBeInTheDocument();
});

it('waits for auth and follows a session restored after the page opens', () => {
  (useAuth as jest.Mock).mockReturnValue({ isLoaded: false, isAuthenticated: false });
  const { rerender } = render(<GetStartedGuide />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
  (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isAuthenticated: true });
  rerender(<GetStartedGuide />);
  expect(mockReplace).toHaveBeenCalledWith('/dashboard');
  expect(screen.queryByText('Create your account')).not.toBeInTheDocument();
});
