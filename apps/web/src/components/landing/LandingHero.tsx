import { BookOpenCheck, BrainCircuit, ShieldCheck } from 'lucide-react';

export default function LandingHero() {
  return (
    <section className="max-w-xl">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <BrainCircuit className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="max-w-lg text-4xl font-semibold tracking-tight text-balance">
        Company knowledge, ready when your team needs it.
      </h2>
      <p className="mt-4 max-w-lg text-lg leading-8 text-muted-foreground">
        Ask onboarding questions, trace every answer to its source, and find the right team when the
        knowledge is not there yet.
      </p>
      <div className="mt-8 grid max-w-lg gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 text-sm">
          <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <span>Grounded in your organization&apos;s own knowledge</span>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <span>No unsupported answers when evidence is weak</span>
        </div>
      </div>
    </section>
  );
}
