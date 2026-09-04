import { BrainCircuit, Loader2, SearchX } from 'lucide-react';
import type { CompanyBrainCitation } from '@app-starter/shared';
import { Button } from '@/components/ui/button';
import { AnswerSourcesDisclosure } from './AnswerSourcesDisclosure';
import { CompanyBrainMarkdown } from './CompanyBrainMarkdown';

export type ConversationResponse =
  | { status: 'PENDING' }
  | { status: 'ANSWERED'; answer: string; citations: CompanyBrainCitation[] }
  | { status: 'NO_ANSWER'; citations: CompanyBrainCitation[] }
  | { status: 'ERROR'; message: string };

export interface ConversationTurn {
  id: string;
  question: string;
  response: ConversationResponse;
}

interface ConversationTranscriptProps {
  turns: ConversationTurn[];
  onOpenDirectory?: () => void;
}

export function ConversationTranscript({ turns, onOpenDirectory }: ConversationTranscriptProps) {
  if (turns.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-4 rounded-xl border bg-muted/40 p-3 text-muted-foreground">
          <BrainCircuit className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">What would you like to know?</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Ask about policies, processes, or anything covered by your organization&apos;s indexed
          knowledge.
        </p>
      </div>
    );
  }

  return (
    <ol
      role="log"
      aria-label="Company brain conversation"
      aria-relevant="additions text"
      className="space-y-7 px-4 py-5 sm:px-6 sm:py-6"
    >
      {turns.map((turn) => (
        <li key={turn.id} className="space-y-5">
          <div className="flex justify-end">
            <div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground sm:max-w-[75%]">
              <span className="sr-only">You: </span>
              {turn.question}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div className="min-w-0 max-w-[52rem] flex-1 text-sm">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Company brain
              </p>

              {turn.response.status === 'PENDING' && (
                <div
                  role="status"
                  aria-busy="true"
                  className="flex items-center gap-2 py-2 text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching company knowledge…
                </div>
              )}

              {turn.response.status === 'ANSWERED' && (
                <>
                  <CompanyBrainMarkdown content={turn.response.answer} />
                  <AnswerSourcesDisclosure citations={turn.response.citations} />
                </>
              )}

              {turn.response.status === 'NO_ANSWER' && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <SearchX className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        I could not find enough supported information to answer that.
                      </p>
                      <p className="mt-1 leading-6 text-muted-foreground">
                        Try rephrasing the question or check which department can help.
                      </p>
                      {onOpenDirectory && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={onOpenDirectory}
                        >
                          View department contacts
                        </Button>
                      )}
                    </div>
                  </div>
                  <AnswerSourcesDisclosure citations={turn.response.citations} verb="checked" />
                </div>
              )}

              {turn.response.status === 'ERROR' && (
                <div role="alert" className="rounded-lg border border-destructive/30 p-4">
                  <p className="font-medium text-destructive">The question could not be sent.</p>
                  <p className="mt-1 leading-6 text-muted-foreground">{turn.response.message}</p>
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
