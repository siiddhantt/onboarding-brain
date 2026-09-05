import { FileText, LockKeyhole } from 'lucide-react';
import { BRAND_NAME, LOGO_PATH } from '@/lib/brand';

/** Illustrative content, not a live answer or a claim about the visitor's company. */
export const WelcomePreview = () => (
  <figure className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
    <figcaption className="flex items-center justify-between gap-3 border-b pb-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-2 font-medium text-foreground">
        <img src={LOGO_PATH} alt="" width={24} height={24} />
        {BRAND_NAME}
      </span>
      <span>Example</span>
    </figcaption>
    <div className="space-y-6 py-6 text-sm leading-relaxed sm:py-8">
      <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-sm bg-muted/60 px-4 py-3">
        How do I get access to the tools I need?
      </p>
      <div className="space-y-3 pr-2">
        <p className="font-medium">Start with your team’s access guide.</p>
        <p className="text-muted-foreground">
          It lists the tools your team uses and how to request access. For anything missing, find
          your IT contact in the department directory.
        </p>
        <div className="flex flex-wrap gap-2 pt-1" aria-label="Illustrative sources">
          {['IT access guide', 'Team handbook'].map((source) => (
            <span
              key={source}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {source}
            </span>
          ))}
        </div>
      </div>
    </div>
    <p className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
      <LockKeyhole className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Your workspace. Your team’s knowledge.
    </p>
  </figure>
);
