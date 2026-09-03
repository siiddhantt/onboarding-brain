'use client';

import { useState, type FormEvent } from 'react';
import type { CompanyBrainAnswer } from '@app-starter/shared';
import {
  MAX_COMPANY_BRAIN_QUESTION_CHARACTERS,
  MIN_COMPANY_BRAIN_QUESTION_CHARACTERS,
} from '@app-starter/shared';
import { Loader2, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface QuestionAnswerPanelProps {
  isConfigured: boolean;
  onAsk: (question: string) => Promise<CompanyBrainAnswer>;
}

export function QuestionAnswerPanel({ isConfigured, onAsk }: QuestionAnswerPanelProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<CompanyBrainAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < MIN_COMPANY_BRAIN_QUESTION_CHARACTERS) {
      setError(
        `Enter a question with at least ${MIN_COMPANY_BRAIN_QUESTION_CHARACTERS} characters.`,
      );
      return;
    }

    setError(null);
    setIsAsking(true);

    try {
      setAnswer(await onAsk(trimmedQuestion));
    } catch (askError) {
      setAnswer(null);
      setError(
        askError && typeof askError === 'object' && 'message' in askError
          ? String(askError.message)
          : 'Could not ask the company brain.',
      );
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask the company brain</CardTitle>
        <CardDescription>
          Answers are grounded in this organization&apos;s indexed knowledge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="company-brain-question">Question</Label>
            <Textarea
              id="company-brain-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={4}
              maxLength={MAX_COMPANY_BRAIN_QUESTION_CHARACTERS}
              placeholder="How do I submit an expense report?"
              disabled={!isConfigured || isAsking}
              aria-describedby="company-brain-question-error"
            />
            {error && (
              <p
                id="company-brain-question-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            )}
          </div>
          <Button type="submit" disabled={!isConfigured || isAsking}>
            {isAsking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <MessageSquareText className="mr-2 h-4 w-4" />
            )}
            {isAsking ? 'Searching…' : 'Ask question'}
          </Button>
        </form>

        {answer && (
          <div className="space-y-4 border-t pt-4" aria-live="polite">
            {answer.status === 'ANSWERED' && answer.answer ? (
              <p className="whitespace-pre-wrap text-sm leading-6">{answer.answer}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                I could not find an answer in the indexed knowledge. No answer was generated.
              </p>
            )}

            {answer.citations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Sources</h3>
                <ol className="space-y-2">
                  {answer.citations.map((citation, index) => (
                    <li
                      key={`${citation.sourceId ?? citation.sourceName}-${index}`}
                      className="rounded-md bg-muted p-3 text-sm"
                    >
                      <p className="font-medium">{citation.sourceName}</p>
                      {citation.excerpt && (
                        <p className="mt-1 text-muted-foreground">{citation.excerpt}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
