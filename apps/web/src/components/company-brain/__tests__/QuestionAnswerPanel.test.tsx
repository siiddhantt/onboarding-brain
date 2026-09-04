import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionAnswerPanel } from '../QuestionAnswerPanel';

jest.mock('../CompanyBrainMarkdown', () => ({
  CompanyBrainMarkdown: ({ content }: { content: string }) => <div>{content}</div>,
}));

describe('QuestionAnswerPanel', () => {
  it('keeps the conversation scrollable while the composer stays pinned to the bottom', () => {
    render(<QuestionAnswerPanel isConfigured onAsk={jest.fn()} />);

    expect(screen.getByRole('region', { name: 'Conversation history' })).toHaveClass(
      'flex-1',
      'overflow-y-auto',
    );
    expect(screen.getByLabelText('Question').closest('form')).toHaveClass(
      'sticky',
      'bottom-0',
      'shrink-0',
    );
    expect(screen.queryByText('Ask the company brain')).not.toBeInTheDocument();
  });

  it('grows the composer to a maximum height and resets it after sending', async () => {
    const user = userEvent.setup();
    const onAsk = jest.fn().mockResolvedValue({
      status: 'ANSWERED',
      answer: 'Answer',
      citations: [],
    });
    render(<QuestionAnswerPanel isConfigured onAsk={onAsk} />);

    const input = screen.getByLabelText('Question') as HTMLTextAreaElement;
    Object.defineProperty(input, 'scrollHeight', {
      configurable: true,
      get: () => (input.value ? 240 : 44),
    });

    fireEvent.change(input, { target: { value: 'First line\nSecond line' } });
    expect(input.style.height).toBe('160px');
    expect(input.style.overflowY).toBe('auto');

    await user.click(screen.getByRole('button', { name: 'Ask question' }));

    await waitFor(() => {
      expect(input).toHaveValue('');
      expect(input.style.height).toBe('44px');
      expect(input.style.overflowY).toBe('hidden');
    });
  });

  it('submits a trimmed question and renders its source-backed answer', async () => {
    const user = userEvent.setup();
    const onAsk = jest.fn().mockResolvedValue({
      status: 'ANSWERED',
      answer: 'Use the finance portal.',
      citations: [
        {
          sourceId: 'source-1',
          sourceName: 'Employee handbook.pdf',
          excerpt: 'Submit expenses within 30 days.',
          score: 0.9,
        },
      ],
    });
    render(<QuestionAnswerPanel isConfigured onAsk={onAsk} />);

    await user.type(screen.getByLabelText('Question'), '  How do I submit expenses?  ');
    await user.click(screen.getByRole('button', { name: 'Ask question' }));

    await waitFor(() => {
      expect(onAsk).toHaveBeenCalledWith('How do I submit expenses?');
    });
    expect(await screen.findByText('Use the finance portal.')).toBeInTheDocument();
    expect(screen.getByText('Employee handbook.pdf')).toBeInTheDocument();
    expect(screen.getByText('Submit expenses within 30 days.')).toBeInTheDocument();
  });

  it('states that no answer was generated when knowledge is insufficient', async () => {
    const user = userEvent.setup();
    const onAsk = jest.fn().mockResolvedValue({
      status: 'NO_ANSWER',
      answer: null,
      citations: [],
    });
    render(<QuestionAnswerPanel isConfigured onAsk={onAsk} />);

    await user.type(screen.getByLabelText('Question'), 'Unknown policy?');
    await user.click(screen.getByRole('button', { name: 'Ask question' }));

    expect(
      await screen.findByText(/could not find enough supported information/i),
    ).toBeInTheDocument();
  });

  it('keeps earlier questions and answers in the conversation', async () => {
    const user = userEvent.setup();
    const onAsk = jest
      .fn()
      .mockResolvedValueOnce({ status: 'ANSWERED', answer: 'First answer', citations: [] })
      .mockResolvedValueOnce({ status: 'ANSWERED', answer: 'Second answer', citations: [] });
    render(<QuestionAnswerPanel isConfigured onAsk={onAsk} />);

    const input = screen.getByLabelText('Question');
    await user.type(input, 'First question');
    await user.click(screen.getByRole('button', { name: 'Ask question' }));
    expect(await screen.findByText('First answer')).toBeInTheDocument();

    await user.type(input, 'Second question');
    await user.click(screen.getByRole('button', { name: 'Ask question' }));

    expect(await screen.findByText('Second answer')).toBeInTheDocument();
    expect(screen.getByText('First question')).toBeInTheDocument();
    expect(screen.getByText('First answer')).toBeInTheDocument();
  });

  it('disables questions while the knowledge engine is not configured', () => {
    render(<QuestionAnswerPanel isConfigured={false} onAsk={jest.fn()} />);

    expect(screen.getByLabelText('Question')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled();
  });
});
