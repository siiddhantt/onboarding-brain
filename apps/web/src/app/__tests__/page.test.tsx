import { render, screen } from '@testing-library/react';
import HomePage from '../page';

it('offers account setup and sign-in beside a clearly labelled example', () => {
  render(<HomePage />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Find your way.');
  expect(screen.getByRole('link', { name: /Get started/ })).toHaveAttribute('href', '/get-started');
  expect(screen.getByRole('link', { name: 'Open your workspace' })).toHaveAttribute(
    'href',
    '/login',
  );
  expect(screen.getByRole('figure')).toHaveTextContent('Example');
  expect(screen.getByRole('link', { name: 'View the project' })).toHaveAttribute(
    'href',
    'https://github.com/siiddhantt/onboarding-brain',
  );
});
