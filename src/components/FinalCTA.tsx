import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="container-narrow pb-24 pt-8 md:pb-32">
      <div className="surface relative overflow-hidden px-8 py-14 text-center md:px-12 md:py-20">
        <div className="absolute inset-0 bg-dawn-gradient opacity-80" aria-hidden />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Your SOL is going to earn rewards anyway.{' '}
            <span className="bg-sunrise-gradient bg-clip-text text-transparent">
              Make them count.
            </span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
            Stake with Definity and put your yield to work in the regions building Solana's next
            chapter.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="#stake" className="btn-primary w-full sm:w-auto">
              Stake SOL <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/faq" className="btn-ghost w-full sm:w-auto">
              Read the FAQ
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
