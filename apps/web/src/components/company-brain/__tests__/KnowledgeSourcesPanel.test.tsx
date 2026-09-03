import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { KnowledgeSource } from '@app-starter/shared';
import { KnowledgeSourcesPanel } from '../KnowledgeSourcesPanel';

const source: KnowledgeSource = {
  id: 'source-1',
  organizationId: 'org-1',
  createdById: 'user-1',
  sourceType: 'DOCUMENT',
  name: 'Employee handbook.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  status: 'READY',
  errorMessage: null,
  createdAt: '2026-09-03T06:00:00.000Z',
  updatedAt: '2026-09-03T06:01:00.000Z',
};

describe('KnowledgeSourcesPanel', () => {
  it('uploads a supported document', async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn().mockResolvedValue(undefined);
    render(
      <KnowledgeSourcesPanel
        sources={[]}
        canManage
        isConfigured
        isUploading={false}
        onUpload={onUpload}
      />,
    );
    const file = new File(['handbook'], 'handbook.txt', { type: 'text/plain' });

    await user.upload(screen.getByLabelText('Onboarding document'), file);
    await user.click(screen.getByRole('button', { name: 'Upload document' }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
  });

  it('requires a file before submitting', async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn();
    render(
      <KnowledgeSourcesPanel
        sources={[]}
        canManage
        isConfigured
        isUploading={false}
        onUpload={onUpload}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Upload document' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a document first.');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('shows source status and hides management controls from members', () => {
    render(
      <KnowledgeSourcesPanel
        sources={[source]}
        canManage={false}
        isConfigured
        isUploading={false}
        onUpload={jest.fn()}
      />,
    );

    expect(screen.getByText('Employee handbook.pdf')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.queryByLabelText('Onboarding document')).not.toBeInTheDocument();
    expect(screen.getByText(/owner or admin can add/i)).toBeInTheDocument();
  });
});
