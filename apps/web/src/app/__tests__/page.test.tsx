import { render, screen } from '@testing-library/react';
import HomePage from '../page';
import { useAuth } from '@/hooks/use-auth';

jest.mock('@/hooks/use-auth', () => ({ useAuth: jest.fn() }));

beforeEach(() => {
  (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isAuthenticated: false });
});

it('offers account setup and sign-in beside a clearly labelled example', () => {
  render(<HomePage />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Find your way.');
  expect(screen.getByRole('link', { name: /Get started/ })).toHaveAttribute('href', '/get-started');
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('figure')).toHaveTextContent('Example');
  expect(screen.getByRole('link', { name: 'View the project' })).toHaveAttribute(
    'href',
    'https://github.com/siiddhantt/onboarding-brain',
  );
});

it('sends signed-in users directly to their workspace without account setup prompts', () => {
  (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isAuthenticated: true });
  render(<HomePage />);
  expect(screen.getByRole('link', { name: /Open your workspace/ })).toHaveAttribute(
    'href',
    '/dashboard',
  );
  expect(screen.queryByRole('link', { name: /Get started|Sign in/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Already invited/)).not.toBeInTheDocument();
});

it('does not flash signup links while restoring a session', () => {
  (useAuth as jest.Mock).mockReturnValue({ isLoaded: false, isAuthenticated: false });
  render(<HomePage />);
  expect(screen.queryByRole('link', { name: /Get started|Sign in/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open your workspace' })).toBeDisabled();
});

it('updates welcome actions when the session changes without a page reload', () => {
  const { rerender } = render(<HomePage />);
  (useAuth as jest.Mock).mockReturnValue({ isLoaded: true, isAuthenticated: true });
  rerender(<HomePage />);
  expect(screen.queryByRole('link', { name: /Get started/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open your workspace/ })).toHaveAttribute(
    'href',
    '/dashboard',
  );
});
