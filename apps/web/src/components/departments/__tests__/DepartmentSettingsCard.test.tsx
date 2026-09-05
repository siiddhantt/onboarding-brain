import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Department } from '@app-starter/shared';
import type { OrganizationUser } from '@/lib/organizations-api';
import { departmentsApi } from '@/lib/departments-api';
import { DepartmentSettingsCard } from '../DepartmentSettingsCard';

jest.mock('@/lib/departments-api', () => ({ departmentsApi: { assignContact: jest.fn() } }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const department: Department = {
  id: 'department-1',
  organizationId: 'org-1',
  name: 'Finance',
  slug: 'finance',
  description: null,
  contacts: [],
  createdAt: '2026-09-05T12:00:00Z',
  updatedAt: '2026-09-05T12:00:00Z',
};
const membership = (id: string, email: string, organizationId = 'org-1'): OrganizationUser => ({
  id,
  userId: `user-${id}`,
  organizationId,
  role: 'MEMBER',
  createdAt: department.createdAt,
  user: {
    id: `user-${id}`,
    email,
    name: 'Sid',
    emailVerifiedAt: department.createdAt,
    lastLoginAt: null,
    createdAt: department.createdAt,
  },
});
const members = [
  membership('member-1', 'siddhant@example.com'),
  membership('member-2', 'sid@example.com'),
];

describe('DepartmentSettingsCard membership picker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('distinguishes same-name members by email and excludes memberships from other organizations', async () => {
    const user = userEvent.setup();
    const onChanged = jest.fn().mockResolvedValue(undefined);
    const { container } = render(
      <DepartmentSettingsCard
        organizationId="org-1"
        department={department}
        members={[...members, membership('outsider', 'outsider@example.com', 'org-2')]}
        onChanged={onChanged}
      />,
    );
    await user.click(container.querySelector('summary')!);
    await user.click(screen.getByRole('combobox', { name: 'Choose a contact for Finance' }));
    const list = screen.getByRole('listbox');
    expect(within(list).getByRole('option', { name: /siddhant@example.com/ })).toBeVisible();
    expect(within(list).queryByText('outsider@example.com')).not.toBeInTheDocument();
    await user.click(within(list).getByRole('option', { name: /sid@example.com/ }));
    await user.click(screen.getByRole('button', { name: 'Assign' }));
    expect(departmentsApi.assignContact).toHaveBeenCalledWith('org-1', department.id, {
      organizationMemberId: 'member-2',
    });
  });

  it('clears a selected contact when their membership disappears', async () => {
    const user = userEvent.setup();
    const onChanged = jest.fn().mockResolvedValue(undefined);
    const { container, rerender } = render(
      <DepartmentSettingsCard
        organizationId="org-1"
        department={department}
        members={members}
        onChanged={onChanged}
      />,
    );
    await user.click(container.querySelector('summary')!);
    await user.click(screen.getByRole('combobox', { name: 'Choose a contact for Finance' }));
    await user.click(screen.getByRole('option', { name: /sid@example.com/ }));
    expect(screen.getByRole('button', { name: 'Assign' })).toBeEnabled();
    rerender(
      <DepartmentSettingsCard
        organizationId="org-1"
        department={department}
        members={[members[0]!]}
        onChanged={onChanged}
      />,
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled());
    expect(departmentsApi.assignContact).not.toHaveBeenCalled();
  });
});
