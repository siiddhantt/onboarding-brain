import Link from 'next/link';
import { ArrowRight, FileText, MessageSquareText, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WelcomePreview } from '@/components/landing/WelcomePreview';
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
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-10 sm:px-8 sm:pt-16 lg:pt-20">
      <section
        className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16"
        aria-labelledby="welcome-title"
      >
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">A little context goes a long way.</p>
          <h1
            id="welcome-title"
            className="font-display text-[clamp(2.25rem,4.5vw,3rem)] font-medium leading-[1.12] tracking-[-0.04em] text-balance"
          >
            Find your way.
            <br />
            One question at a time.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Turn your team’s documents and shared knowledge into answers you can trace back to the
            source. For your first day, and every day after.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/get-started">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="rounded-full">
              <Link href="/login">Open your workspace</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Already invited? Follow the link in your email.
          </p>
        </div>
        <WelcomePreview />
      </section>

      <section
        className="mt-12 grid gap-8 border-t border-border py-10 sm:grid-cols-3 lg:mt-16"
        aria-label="What you can do"
      >
        {CAPABILITIES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="space-y-3">
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div className="space-y-2">
              <h2 className="font-display text-sm font-medium">{title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        ))}
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
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
