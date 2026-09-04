import { CompanyBrainApi } from '../company-brain-api';
import { apiClient } from '../api-client';

jest.mock('../api-client');

describe('CompanyBrainApi', () => {
  const organizationId = 'org-1';
  let companyBrainApi: CompanyBrainApi;

  beforeEach(() => {
    companyBrainApi = new CompanyBrainApi();
    jest.clearAllMocks();
  });

  it('loads status and sources from organization-scoped routes', async () => {
    (apiClient.get as jest.Mock)
      .mockResolvedValueOnce({ isConfigured: true })
      .mockResolvedValueOnce({ items: [], total: 0 });

    await companyBrainApi.getStatus(organizationId);
    await companyBrainApi.listSources(organizationId);

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      `/api/organizations/${organizationId}/brain/status`,
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      `/api/organizations/${organizationId}/brain/sources`,
    );
  });

  it('uploads the document as multipart form data', async () => {
    const file = new File(['handbook'], 'handbook.txt', { type: 'text/plain' });
    (apiClient.post as jest.Mock).mockResolvedValue({ id: 'source-1' });

    await companyBrainApi.uploadDocument(organizationId, file);

    const [endpoint, body] = (apiClient.post as jest.Mock).mock.calls[0];
    expect(endpoint).toBe(`/api/organizations/${organizationId}/brain/sources/documents`);
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBe(file);
  });

  it('replaces source content as multipart form data', async () => {
    const file = new File(['updated handbook'], 'handbook-v2.txt', { type: 'text/plain' });
    (apiClient.put as jest.Mock).mockResolvedValue({ id: 'source-1', version: 2 });

    await companyBrainApi.replaceSourceContent(organizationId, 'source-1', file);

    const [endpoint, body] = (apiClient.put as jest.Mock).mock.calls[0];
    expect(endpoint).toBe(`/api/organizations/${organizationId}/brain/sources/source-1/content`);
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBe(file);
  });

  it('removes a source through its organization-scoped route', async () => {
    (apiClient.delete as jest.Mock).mockResolvedValue(undefined);

    await companyBrainApi.removeSource(organizationId, 'source-1');

    expect(apiClient.delete).toHaveBeenCalledWith(
      `/api/organizations/${organizationId}/brain/sources/source-1`,
    );
  });

  it('submits a question without provider-specific fields', async () => {
    (apiClient.post as jest.Mock).mockResolvedValue({ status: 'NO_ANSWER' });

    await companyBrainApi.ask(organizationId, 'Where is the handbook?');

    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/organizations/${organizationId}/brain/questions`,
      { question: 'Where is the handbook?' },
    );
  });
});
