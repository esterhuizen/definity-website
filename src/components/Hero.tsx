import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-line opacity-40" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-[480px] bg-dawn-gradient" aria-hidden="true" />

      <div className="container-narrow relative pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="eyebrow animate-fade-up">
            <Sparkles className="h-3.5 w-3.5 text-sunrise-400" />
            A Solana stake pool with a mission
          </span>

          <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-balance md:text-7xl animate-fade-up [animation-delay:80ms]">
            Stake SOL{' '}
            <span className="bg-sunrise-gradient bg-clip-text text-transparent">
              responsibly
            </span>
            . Grow Solana where it&apos;s needed.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-muted text-pretty animate-fade-up [animation-delay:160ms] md:text-xl">
            Definity is a non-custodial stake pool that turns your staking yield into real growth
            for the regions shaping Solana's next chapter.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up [animation-delay:240ms]">
            <Link href="#stake" className="btn-primary w-full sm:w-auto">
              Stake SOL <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="#how" className="btn-ghost w-full sm:w-auto">
              See how it works
            </Link>
          </div>

          <p className="mt-6 text-xs text-ink-dim animate-fade-up [animation-delay:320ms]">
            Non-custodial · Built on the Solana SPL Stake Pool program · Unstake anytime
          </p>
        </div>
      </div>
    </section>
  );
}
