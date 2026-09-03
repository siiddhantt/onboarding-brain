import { render, screen } from '@testing-library/react';
import type { Department } from '@app-starter/shared';
import { DepartmentDirectory } from '../DepartmentDirectory';

const department: Department = {
  id: 'department-1',
  organizationId: 'organization-1',
  name: 'Finance',
  slug: 'finance-AbCdE',
  description: 'Expenses and purchasing',
  contacts: [
    {
      id: 'contact-1',
      organizationMemberId: 'member-1',
      userId: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      createdAt: '2026-09-03T12:00:00.000Z',
    },
  ],
  createdAt: '2026-09-03T12:00:00.000Z',
  updatedAt: '2026-09-03T12:00:00.000Z',
};

describe('DepartmentDirectory', () => {
  it('shows configured departments and contacts', () => {
    render(<DepartmentDirectory departments={[department]} />);

    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Expenses and purchasing')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('shows a clear empty state', () => {
    render(<DepartmentDirectory departments={[]} />);

    expect(screen.getByText('No departments have been configured yet.')).toBeInTheDocument();
  });
});
