import { DepartmentsApi } from '../departments-api';
import { apiClient } from '../api-client';

jest.mock('../api-client');

describe('DepartmentsApi', () => {
  const organizationId = 'organization-1';
  const departmentId = 'department-1';
  let departmentsApi: DepartmentsApi;

  beforeEach(() => {
    departmentsApi = new DepartmentsApi();
    jest.clearAllMocks();
  });

  it('uses organization-scoped routes for department configuration', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ items: [], total: 0 });
    (apiClient.post as jest.Mock).mockResolvedValue({ id: departmentId });
    (apiClient.patch as jest.Mock).mockResolvedValue({ id: departmentId });

    await departmentsApi.list(organizationId);
    await departmentsApi.create(organizationId, { name: 'Finance' });
    await departmentsApi.update(organizationId, departmentId, { name: 'Accounting' });

    expect(apiClient.get).toHaveBeenCalledWith(`/api/organizations/${organizationId}/departments`);
    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/organizations/${organizationId}/departments`,
      { name: 'Finance' },
    );
    expect(apiClient.patch).toHaveBeenCalledWith(
      `/api/organizations/${organizationId}/departments/${departmentId}`,
      { name: 'Accounting' },
    );
  });

  it('uses nested routes for assigning and removing contacts', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ id: departmentId });
    (apiClient.delete as jest.Mock).mockResolvedValue(undefined);

    await departmentsApi.assignContact(organizationId, departmentId, {
      organizationMemberId: 'member-1',
    });
    await departmentsApi.removeContact(organizationId, departmentId, 'contact-1');

    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/organizations/${organizationId}/departments/${departmentId}/contacts`,
      { organizationMemberId: 'member-1' },
    );
    expect(apiClient.delete).toHaveBeenCalledWith(
      `/api/organizations/${organizationId}/departments/${departmentId}/contacts/contact-1`,
    );
  });
});
