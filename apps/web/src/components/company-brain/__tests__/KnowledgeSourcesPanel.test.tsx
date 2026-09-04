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
  version: 1,
  lastIndexedAt: '2026-09-03T06:01:00.000Z',
  errorMessage: null,
  createdAt: '2026-09-03T06:00:00.000Z',
  updatedAt: '2026-09-03T06:01:00.000Z',
};

const defaultProps = {
  canManage: true,
  isConfigured: true,
  isUploading: false,
  replacingSourceId: null,
  removingSourceId: null,
  onUpload: jest.fn().mockResolvedValue(undefined),
  onReplace: jest.fn().mockResolvedValue(undefined),
  onRemove: jest.fn().mockResolvedValue(undefined),
};

describe('KnowledgeSourcesPanel', () => {
  it('uploads a supported document', async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn().mockResolvedValue(undefined);
    render(<KnowledgeSourcesPanel {...defaultProps} sources={[]} onUpload={onUpload} />);
    const file = new File(['handbook'], 'handbook.txt', { type: 'text/plain' });

    await user.upload(screen.getByLabelText('Onboarding document'), file);
    await user.click(screen.getByRole('button', { name: 'Upload document' }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file));
  });

  it('requires a file before submitting', async () => {
    const user = userEvent.setup();
    const onUpload = jest.fn();
    render(<KnowledgeSourcesPanel {...defaultProps} sources={[]} onUpload={onUpload} />);

    await user.click(screen.getByRole('button', { name: 'Upload document' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a document first.');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('shows source status and hides management controls from members', () => {
    render(<KnowledgeSourcesPanel {...defaultProps} sources={[source]} canManage={false} />);

    expect(screen.getByText('Employee handbook.pdf')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.queryByLabelText('Onboarding document')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(`Actions for ${source.name}`)).not.toBeInTheDocument();
    expect(screen.getByText(/owner or admin can add/i)).toBeInTheDocument();
  });

  it('confirms a replacement before sending the selected document', async () => {
    const user = userEvent.setup();
    const onReplace = jest.fn().mockResolvedValue(undefined);
    render(<KnowledgeSourcesPanel {...defaultProps} sources={[source]} onReplace={onReplace} />);
    const replacement = new File(['updated handbook'], 'handbook-v2.txt', {
      type: 'text/plain',
    });

    await user.upload(
      screen.getByLabelText(`Replacement document for ${source.name}`),
      replacement,
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Replace this knowledge source?');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('handbook-v2.txt');
    await user.click(screen.getByRole('button', { name: 'Replace source' }));

    await waitFor(() => expect(onReplace).toHaveBeenCalledWith(source.id, replacement));
  });

  it('confirms destructive removal from the source action menu', async () => {
    const user = userEvent.setup();
    const onRemove = jest.fn().mockResolvedValue(undefined);
    render(<KnowledgeSourcesPanel {...defaultProps} sources={[source]} onRemove={onRemove} />);

    await user.click(screen.getByLabelText(`Actions for ${source.name}`));
    await user.click(screen.getByRole('menuitem', { name: 'Remove from brain' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('This cannot be undone.');
    await user.click(screen.getByRole('button', { name: 'Remove source' }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(source.id));
  });
});
