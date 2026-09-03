import Link from 'next/link';
import { BrainCircuit, Building2, FileText, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UniversalLayout } from '@/components/layout/UniversalLayout';

export const metadata = {
  title: 'Onboarding Brain',
  description: 'Source-backed answers from the onboarding knowledge your organization provides.',
};

const CAPABILITIES = [
  {
    icon: FileText,
    title: 'Bring your onboarding knowledge',
    description: 'Add the policies, handbooks, and process documents your team already maintains.',
  },
  {
    icon: MessageSquareText,
    title: 'Ask grounded questions',
    description: 'Get concise answers tied to the source material instead of unsupported guesses.',
  },
  {
    icon: Building2,
    title: 'Keep company context separate',
    description: 'Members and knowledge are scoped to the organization they belong to.',
  },
  {
    icon: BrainCircuit,
    title: 'Build a shared company memory',
    description:
      'Capture reviewed answers so the onboarding brain can improve as the team uses it.',
  },
];

/**
 * Marketing home. Authenticated users are sent to /dashboard by the header,
 * so this stays a plain public page rather than redirecting.
 */
export default function HomePage() {
  return (
    <UniversalLayout>
      <main className="mx-auto max-w-5xl px-4 py-20">
        <section className="space-y-6 text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Answers new teammates can trust
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Bring onboarding documents into one company brain and answer questions from the
            knowledge your team provides, with sources.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">Open your workspace</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-8 sm:grid-cols-2">
          {CAPABILITIES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-4">
              <Icon className="mt-1 h-6 w-6 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <h2 className="font-medium">{title}</h2>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </section>
      </main>
    </UniversalLayout>
  );
}
