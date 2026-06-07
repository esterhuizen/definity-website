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
    <div className="mx-auto max-w-3xl px-4 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Stake SOL → definSOL</h1>
        <p className="mx-auto mt-3 max-w-xl text-neutral-400">
          Convert SOL into <span className="font-semibold">definSOL</span>, Definity’s liquid staking
          token backed by a curated, geographically-decentralised validator set. Liquid, tradeable,
          and earning from the moment you stake.
        </p>
      </header>

      <StakeProviders>
        <StakeWidget />
      </StakeProviders>

      <p className="mx-auto mt-6 max-w-md text-center text-xs text-neutral-500">
        Deposits route through Jupiter, which mints definSOL via Sanctum at the live exchange rate.
        Your wallet signs and submits the transaction — Definity never holds your funds.
      </p>

      <p className="mx-auto mt-8 max-w-md text-center text-sm text-neutral-400">
        Coming next: choose the token your staking yield is paid in.
      </p>
    </div>
  );
}
