import type {
  CreateSourceConnectionRequest,
  SaveSourceLocationRequest,
  SavedSourceLocation,
  SourceConnection,
  SourceLocation,
  UpdateSourceConnectionRequest,
} from '@app-starter/shared';
import { apiClient } from './api-client';

const base = (org: string) => `/api/organizations/${org}/brain`;

export const sourceConnectionsApi = {
  list: (org: string) => apiClient.get<SourceConnection[]>(`${base(org)}/connections`),
  create: (org: string, input: CreateSourceConnectionRequest) =>
    apiClient.post<SourceConnection>(`${base(org)}/connections`, input),
  update: (org: string, id: string, input: UpdateSourceConnectionRequest) =>
    apiClient.patch<SourceConnection>(`${base(org)}/connections/${id}`, input),
  disconnect: (org: string, connection: SourceConnection) =>
    apiClient.post<SourceConnection>(`${base(org)}/connections/${connection.id}/disconnect`, {
      expectedRevision: connection.revision,
    }),
  discover: (org: string, id: string) =>
    apiClient.get<SourceLocation[]>(`${base(org)}/connections/${id}/discover`),
  saveLocation: (org: string, id: string, input: SaveSourceLocationRequest) =>
    apiClient.post<SavedSourceLocation>(`${base(org)}/connections/${id}/locations`, input),
  forgetLocation: (org: string, id: string) =>
    apiClient.delete<void>(`${base(org)}/locations/${id}`),
};

export const sourceConnectionKeys = (org: string) => ['source-connections', org] as const;
