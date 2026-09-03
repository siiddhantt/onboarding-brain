import type {
  AskCompanyBrainRequest,
  CompanyBrainAnswer,
  CompanyBrainStatusResponse,
  KnowledgeSource,
  KnowledgeSourceListResponse,
} from '@app-starter/shared';
import { apiClient } from './api-client';

export class CompanyBrainApi {
  async getStatus(organizationId: string): Promise<CompanyBrainStatusResponse> {
    return apiClient.get<CompanyBrainStatusResponse>(
      `/api/organizations/${organizationId}/brain/status`,
    );
  }

  async listSources(organizationId: string): Promise<KnowledgeSourceListResponse> {
    return apiClient.get<KnowledgeSourceListResponse>(
      `/api/organizations/${organizationId}/brain/sources`,
    );
  }

  async uploadDocument(organizationId: string, file: File): Promise<KnowledgeSource> {
    const formData = new FormData();
    formData.append('file', file);

    return apiClient.post<KnowledgeSource>(
      `/api/organizations/${organizationId}/brain/sources/documents`,
      formData,
    );
  }

  async ask(organizationId: string, question: string): Promise<CompanyBrainAnswer> {
    const request: AskCompanyBrainRequest = { question };
    return apiClient.post<CompanyBrainAnswer>(
      `/api/organizations/${organizationId}/brain/questions`,
      request,
    );
  }
}

export const companyBrainApi = new CompanyBrainApi();
