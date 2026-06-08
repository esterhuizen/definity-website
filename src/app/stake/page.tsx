import type { Metadata } from 'next';
import { StakeProviders } from '@/components/stake/StakeProviders';
import { StakeWidget } from '@/components/stake/StakeWidget';

export const metadata: Metadata = {
  title: 'Stake',
  description:
    'Stake SOL into definSOL — Definity’s geographically-decentralised liquid staking token. Connect a wallet and convert SOL to definSOL in one click.',
};

export default function StakePage() {
  return (
    <section className="container-narrow py-24 md:py-32">
      <header className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">Stake</span>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
          Stake SOL for{' '}
          <span className="bg-sunrise-gradient bg-clip-text text-transparent">definSOL</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
          Convert SOL into definSOL, Definity’s liquid staking token backed by a curated,
          geographically-decentralised validator set. Liquid, tradeable, and earning from the
          moment you stake.
        </p>
      </header>

      <div className="mt-10">
        <StakeProviders>
          <StakeWidget />
        </StakeProviders>
      </div>

      <p className="mx-auto mt-8 max-w-md text-center text-sm text-ink-dim">
        Coming next: choose the token your staking yield is paid in.
      </p>
    </section>
  );
}
