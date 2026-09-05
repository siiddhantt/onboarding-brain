import { BookOpenCheck, Users } from 'lucide-react';

export default function LandingHero() {
  return (
    <section className="max-w-xl">
      <p className="mb-5 text-sm font-medium text-muted-foreground">
        A little context goes a long way.
      </p>
      <h2 className="max-w-lg font-display text-4xl font-medium leading-tight tracking-tight text-balance xl:text-5xl">
        A place for all those “quick questions.”
      </h2>
      <p className="mt-4 max-w-lg text-lg leading-8 text-muted-foreground">
        Find the guide, understand the process, or figure out who to ask. Your team’s knowledge, a
        little easier to find.
      </p>
      <div className="mt-8 grid max-w-lg gap-4 sm:grid-cols-2">
        <div className="flex items-start gap-3 text-sm">
          <BookOpenCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <span>Answers with sources you can check</span>
        </div>
        <div className="flex items-start gap-3 text-sm">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <span>A directory of the people who can help</span>
        </div>
      </div>
    </section>
  );
}
