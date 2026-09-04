'use client';

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type { CompanyBrainAnswer } from '@app-starter/shared';
import {
  MAX_COMPANY_BRAIN_QUESTION_CHARACTERS,
  MIN_COMPANY_BRAIN_QUESTION_CHARACTERS,
} from '@app-starter/shared';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  ConversationTranscript,
  type ConversationResponse,
  type ConversationTurn,
} from './ConversationTranscript';

const COMPOSER_MIN_HEIGHT_PX = 44;
const COMPOSER_MAX_HEIGHT_PX = 160;

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

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const contentHeight = Math.max(textarea.scrollHeight, COMPOSER_MIN_HEIGHT_PX);
    textarea.style.height = `${Math.min(contentHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
    textarea.style.overflowY = contentHeight > COMPOSER_MAX_HEIGHT_PX ? 'auto' : 'hidden';
  }, [question]);

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
    <section
      aria-label="Company brain chat"
      className="-mb-12 flex h-[calc(100dvh-18rem)] min-h-96 flex-col"
    >
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
        className="sticky bottom-0 z-10 shrink-0 bg-background/95 pb-1 pt-3 backdrop-blur"
      >
        <div className="rounded-2xl border bg-card p-1.5 shadow-sm transition-[border-color,box-shadow] focus-within:border-foreground/25 focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-2 sm:p-2">
          <Label htmlFor="company-brain-question" className="sr-only">
            Question
          </Label>
          <textarea
            ref={textareaRef}
            id="company-brain-question"
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={MAX_COMPANY_BRAIN_QUESTION_CHARACTERS}
            placeholder="How do I submit an expense report?"
            disabled={!isConfigured || isAsking}
            aria-describedby="company-brain-question-error"
            className="block min-h-11 max-h-40 w-full resize-none bg-transparent px-2.5 py-2.5 text-[16px] leading-6 text-foreground outline-none placeholder:text-[13px] placeholder:font-normal placeholder:tracking-[-0.01em] placeholder:text-muted-foreground/55 disabled:cursor-not-allowed disabled:opacity-50 sm:placeholder:text-sm md:text-sm"
          />
          <div className="flex items-center justify-between gap-3 px-2 pb-0.5 pt-0.5">
            <p className="text-[11px] leading-4 text-muted-foreground/65 sm:text-xs">
              <span className="hidden sm:inline">Enter to send · Shift + Enter for a new line</span>
              <span className="sm:hidden">Ask company knowledge</span>
            </p>
            <Button
              type="submit"
              size="sm"
              className="rounded-full px-3 sm:px-4"
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
    </section>
  );
}
