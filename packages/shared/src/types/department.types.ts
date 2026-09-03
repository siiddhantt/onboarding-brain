export interface DepartmentContact {
  id: string;
  organizationMemberId: string;
  userId: string;
  name: string | null;
  email: string;
  createdAt: string;
}

export interface Department {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  contacts: DepartmentContact[];
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentListResponse {
  items: Department[];
  total: number;
}

export interface CreateDepartmentRequest {
  name: string;
  description?: string;
}

export interface UpdateDepartmentRequest {
  name?: string;
  description?: string;
}

export interface AssignDepartmentContactRequest {
  organizationMemberId: string;
}
