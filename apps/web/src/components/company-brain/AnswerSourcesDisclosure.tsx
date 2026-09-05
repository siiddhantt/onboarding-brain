'use client';

import { useState } from 'react';
import type { CompanyBrainCitation } from '@app-starter/shared';
import { ChevronDown, ExternalLink, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AnswerSourcesDisclosureProps {
  citations: CompanyBrainCitation[];
  verb?: 'used' | 'checked';
}

function SourceExcerpt({ citation }: { citation: CompanyBrainCitation }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = (citation.excerpt?.length ?? 0) > 220;

  if (!citation.excerpt) {
    return null;
  }

  return (
    <div className="mt-1.5">
      <p className={`text-sm leading-6 text-muted-foreground ${isExpanded ? '' : 'line-clamp-3'}`}>
        {citation.excerpt}
      </p>
      {isLong && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-xs"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded ? 'Show less' : 'Show full excerpt'}
        </Button>
      )}
    </div>
  );
}

export function AnswerSourcesDisclosure({
  citations,
  verb = 'used',
}: AnswerSourcesDisclosureProps) {
  if (citations.length === 0) {
    return null;
  }

  const sourceLabel = `${citations.length} ${citations.length === 1 ? 'source' : 'sources'} ${verb}`;

  return (
    <details className="group mt-5 border-t pt-3">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>{sourceLabel}</span>
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
      </summary>
      <ol className="mt-2 space-y-2" aria-label={sourceLabel}>
        {citations.map((citation, index) => (
          <li
            key={`${citation.sourceId ?? citation.sourceName}-${index}`}
            className="flex gap-3 rounded-lg border bg-muted/25 p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="truncate text-sm font-medium">{citation.sourceName}</p>
              </div>
              <SourceExcerpt citation={citation} />
              {citation.sourceUrl && (
                <a
                  href={citation.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                  Open original source
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {Boolean(citation.sourceLinks?.length) && (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">
                    Items in this curated source ({citation.sourceLinks!.length})
                  </summary>
                  <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                    {citation.sourceLinks!.map((link) => (
                      <li key={link.url}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-words underline-offset-4 hover:underline"
                        >
                          {link.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
