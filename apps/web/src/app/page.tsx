import { FileText, MessageSquareText, Users } from 'lucide-react';
import { WelcomePreview } from '@/components/landing/WelcomePreview';
import { WelcomeActions } from '@/components/landing/WelcomeActions';
import { BRAND_NAME } from '@/lib/brand';

export const metadata = {
  title: BRAND_NAME,
  description: 'Source-backed answers from the onboarding knowledge your organization provides.',
};

const CAPABILITIES = [
  {
    icon: FileText,
    title: 'Bring what you know',
    description: 'Start with your handbooks, guides, and the messages worth keeping.',
  },
  {
    icon: MessageSquareText,
    title: 'Ask in your own words',
    description: 'Find an answer, with sources you can open and check for yourself.',
  },
  {
    icon: Users,
    title: 'Know who to ask next',
    description: 'When the answer is missing, the team directory helps you find the right person.',
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col px-5 sm:px-8">
      <div className="flex flex-1 flex-col justify-center py-[clamp(1rem,3vh,2rem)]">
        <section
          className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr] xl:gap-12"
          aria-labelledby="welcome-title"
        >
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">A little context goes a long way.</p>
            <h1
              id="welcome-title"
              className="font-display text-[clamp(2.25rem,5.5vh,3rem)] font-medium leading-[1.12] tracking-[-0.04em] text-balance"
            >
              Find your way.
              <br />
              One question at a time.
            </h1>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              Turn your team’s documents and shared knowledge into answers you can trace back to the
              source. For your first day, and every day after.
            </p>
            <WelcomeActions />
          </div>
          <WelcomePreview />
        </section>

        <section
          className="mt-6 grid gap-6 border-t border-border pt-6 sm:grid-cols-3"
          aria-label="What you can do"
        >
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="space-y-2">
                <h2 className="font-display text-sm font-medium">{title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border py-4 text-xs text-muted-foreground">
        <p>Open source. Built with Cognee.</p>
        <a
          href="https://github.com/siiddhantt/onboarding-brain"
          className="rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View the project
        </a>
      </footer>
    </div>
  );
}
