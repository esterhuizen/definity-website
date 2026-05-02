import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { LINKS, POOL } from '@/config/pool';

export const metadata: Metadata = {
  title: 'Pool & token IDs',
  description:
    'Public on-chain addresses for the Definity stake pool and the definSOL liquid staking token.',
};

const ROWS = [
  {
    label: 'Definity Stake Pool',
    value: POOL.stakePoolAddress,
    href: LINKS.solscanPool,
    note: 'The on-chain pool account. Holds the validator list, fee config, and reserve.',
  },
  {
    label: `${POOL.lstSymbol} mint`,
    value: POOL.lstMint,
    href: LINKS.solscanMint,
    note: 'The SPL token mint for definSOL. Used by wallets, explorers and DeFi integrations.',
  },
];

export default function AddressesPage() {
  return (
    <div className="container-narrow py-20 md:py-28">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>

      <div className="mt-8 max-w-2xl">
        <span className="eyebrow">Pool & token IDs</span>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          The public addresses you can verify yourself.
        </h1>
        <p className="mt-5 text-lg text-ink-muted text-pretty">
          Everything that matters about Definity lives on-chain. These are the canonical
          addresses — bookmark them.
        </p>
      </div>

      <div className="mt-12 space-y-4">
        {ROWS.map((r) => (
          <div
            key={r.label}
            className="surface flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">{r.label}</div>
              <div className="mt-2 break-all font-mono text-sm text-ink">{r.value}</div>
              <p className="mt-2 max-w-md text-sm text-ink-muted text-pretty">{r.note}</p>
            </div>
            <a
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost shrink-0"
            >
              Solscan <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
