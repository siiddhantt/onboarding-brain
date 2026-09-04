'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { CompanyBrainAnswer } from '@app-starter/shared';
import {
  MAX_COMPANY_BRAIN_QUESTION_CHARACTERS,
  MIN_COMPANY_BRAIN_QUESTION_CHARACTERS,
} from '@app-starter/shared';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ConversationTranscript,
  type ConversationResponse,
  type ConversationTurn,
} from './ConversationTranscript';

interface QuestionAnswerPanelProps {
  isConfigured: boolean;
  onAsk: (question: string) => Promise<CompanyBrainAnswer>;
  onOpenDirectory?: () => void;
}

export function QuestionAnswerPanel({
  isConfigured,
  onAsk,
  onOpenDirectory,
}: QuestionAnswerPanelProps) {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const nextTurnId = useRef(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [turns]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < MIN_COMPANY_BRAIN_QUESTION_CHARACTERS) {
      setInputError(
        `Enter a question with at least ${MIN_COMPANY_BRAIN_QUESTION_CHARACTERS} characters.`,
      );
      return;
    }

    const turnId = `turn-${nextTurnId.current++}`;
    setInputError(null);
    setIsAsking(true);
    setQuestion('');
    setTurns((currentTurns) => [
      ...currentTurns,
      { id: turnId, question: trimmedQuestion, response: { status: 'PENDING' } },
    ]);

    try {
      const result = await onAsk(trimmedQuestion);
      const response: ConversationResponse =
        result.status === 'ANSWERED' && result.answer
          ? { status: 'ANSWERED', answer: result.answer, citations: result.citations }
          : { status: 'NO_ANSWER', citations: result.citations };

      setTurns((currentTurns) =>
        currentTurns.map((turn) => (turn.id === turnId ? { ...turn, response } : turn)),
      );
    } catch (askError) {
      const message =
        askError && typeof askError === 'object' && 'message' in askError
          ? String(askError.message)
          : 'Try again in a moment.';
      setTurns((currentTurns) =>
        currentTurns.map((turn) =>
          turn.id === turnId ? { ...turn, response: { status: 'ERROR', message } } : turn,
        ),
      );
    } finally {
      setIsAsking(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <Card className="flex h-[clamp(24rem,calc(100svh-17rem),48rem)] flex-col overflow-hidden">
      <CardHeader className="shrink-0 border-b bg-muted/20">
        <CardTitle className="text-lg">Ask the company brain</CardTitle>
        <CardDescription>
          Answers are grounded in this organization&apos;s indexed knowledge.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div
          ref={transcriptRef}
          role="region"
          aria-label="Conversation history"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <ConversationTranscript turns={turns} onOpenDirectory={onOpenDirectory} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="shrink-0 border-t bg-card/95 p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur sm:p-5"
        >
          <div className="rounded-xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Label htmlFor="company-brain-question" className="sr-only">
              Question
            </Label>
            <Textarea
              ref={textareaRef}
              id="company-brain-question"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              rows={2}
              maxLength={MAX_COMPANY_BRAIN_QUESTION_CHARACTERS}
              placeholder="How do I submit an expense report?"
              disabled={!isConfigured || isAsking}
              aria-describedby="company-brain-question-error"
              className="min-h-[4.5rem] resize-none border-0 bg-transparent p-2 shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between gap-3 px-2 pt-2">
              <p className="text-xs text-muted-foreground">
                <span className="hidden sm:inline">
                  Enter to send · Shift + Enter for a new line
                </span>
                <span className="sm:hidden">Ask company knowledge</span>
              </p>
              <Button
                type="submit"
                size="sm"
                disabled={!isConfigured || isAsking || question.trim().length === 0}
                aria-label="Ask question"
              >
                {isAsking ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <Send className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">{isAsking ? 'Searching…' : 'Ask'}</span>
              </Button>
            </div>
            {inputError && (
              <p
                id="company-brain-question-error"
                role="alert"
                className="px-2 pt-2 text-sm text-destructive"
              >
                {inputError}
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
