import type {
  AssignDepartmentContactRequest,
  CreateDepartmentRequest,
  Department,
  DepartmentListResponse,
  UpdateDepartmentRequest,
} from '@app-starter/shared';
import { apiClient } from './api-client';

export class DepartmentsApi {
  async list(organizationId: string): Promise<DepartmentListResponse> {
    return apiClient.get<DepartmentListResponse>(
      `/api/organizations/${organizationId}/departments`,
    );
  }

  async create(organizationId: string, data: CreateDepartmentRequest): Promise<Department> {
    return apiClient.post<Department>(`/api/organizations/${organizationId}/departments`, data);
  }

  async update(
    organizationId: string,
    departmentId: string,
    data: UpdateDepartmentRequest,
  ): Promise<Department> {
    return apiClient.patch<Department>(
      `/api/organizations/${organizationId}/departments/${departmentId}`,
      data,
    );
  }

  async archive(organizationId: string, departmentId: string): Promise<void> {
    await apiClient.delete(`/api/organizations/${organizationId}/departments/${departmentId}`);
  }

  async assignContact(
    organizationId: string,
    departmentId: string,
    data: AssignDepartmentContactRequest,
  ): Promise<Department> {
    return apiClient.post<Department>(
      `/api/organizations/${organizationId}/departments/${departmentId}/contacts`,
      data,
    );
  }

  async removeContact(
    organizationId: string,
    departmentId: string,
    contactId: string,
  ): Promise<void> {
    await apiClient.delete(
      `/api/organizations/${organizationId}/departments/${departmentId}/contacts/${contactId}`,
    );
  }
}

export const departmentsApi = new DepartmentsApi();
