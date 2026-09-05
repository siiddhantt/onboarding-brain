import { useId } from 'react';
import { ExternalLink } from 'lucide-react';
import type { SourceRecord } from '@app-starter/shared';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SourcePreviewItemProps {
  item: SourceRecord;
  isSelected: boolean;
  isSaved: boolean;
  isDisabled: boolean;
  onToggle: (id: string, checked: boolean) => void;
}

export const SourcePreviewItem = ({
  item,
  isSelected,
  isSaved,
  isDisabled,
  onToggle,
}: SourcePreviewItemProps) => {
  const id = useId();
  return (
    <li className={cn('flex min-w-0 items-start gap-3 p-3 sm:p-4', isSelected && 'bg-muted/25')}>
      <input
        type="checkbox"
        id={id}
        className="mt-1 h-4 w-4 shrink-0 accent-primary"
        checked={isSelected}
        disabled={isDisabled}
        onChange={(event) => onToggle(item.id, event.target.checked)}
        aria-label={`Include ${item.title}`}
      />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <Label htmlFor={id} className="text-xs font-medium leading-5">
          {item.title}
        </Label>
        {isSaved && <span className="ml-2 text-[11px] text-muted-foreground">Saved snapshot</span>}
        {item.text.length > 240 ? (
          <details className="mt-1.5 text-sm">
            <summary className="cursor-pointer list-none whitespace-pre-wrap leading-6 [&::-webkit-details-marker]:hidden">
              {item.text.slice(0, 240)}…{' '}
              <span className="text-xs text-muted-foreground">Expand</span>
            </summary>
            <p className="mt-2 whitespace-pre-wrap leading-6">{item.text}</p>
          </details>
        ) : (
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6">{item.text}</p>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Open original <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
        </a>
      </div>
    </li>
  );
};
