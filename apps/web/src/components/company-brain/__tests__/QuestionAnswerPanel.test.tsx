import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionAnswerPanel } from '../QuestionAnswerPanel';

describe('QuestionAnswerPanel', () => {
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
      await screen.findByText(/could not find an answer.*No answer was generated/i),
    ).toBeInTheDocument();
  });

  it('disables questions while the knowledge engine is not configured', () => {
    render(<QuestionAnswerPanel isConfigured={false} onAsk={jest.fn()} />);

    expect(screen.getByLabelText('Question')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ask question' })).toBeDisabled();
  });
});
