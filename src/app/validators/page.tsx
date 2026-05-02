import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { LINKS } from '@/config/pool';

export const metadata: Metadata = {
  title: 'Validators',
  description:
    'How Definity selects, monitors and rebalances the validators that secure your stake.',
};

const CRITERIA = [
  {
    title: 'Reliability first',
    body: 'Validators must hit a sustained uptime threshold across recent epochs. Anything that consistently misses leader slots is dropped from the active set.',
  },
  {
    title: 'Independent infrastructure',
    body: 'We prefer operators running on independent hardware, in distinct geographies, with no shared upstream provider — fewer correlated failure modes for you.',
  },
  {
    title: 'Reasonable commission',
    body: 'A validator that pays its bills and invests in its node is healthy; one that runs at zero often isn\'t. We weigh commission against demonstrated performance, not just price.',
  },
  {
    title: 'Skin in the game',
    body: 'We favour validators with their own self-stake and a track record across multiple epochs — operators who treat running a node as a long-term commitment.',
  },
  {
    title: 'Aligned with the mission',
    body: 'Where we can, we tilt allocation toward validators based in the regions Definity exists to support, or who actively contribute to ecosystem development there.',
  },
];

export default function ValidatorsPage() {
  return (
    <div className="container-narrow py-20 md:py-28">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>

      <div className="mt-8 max-w-2xl">
        <span className="eyebrow">Validators</span>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          How we choose where your stake goes.
        </h1>
        <p className="mt-5 text-lg text-ink-muted text-pretty">
          Definity delegates across a curated set of validators — and the pool rebalances each
          epoch so that allocation stays current. Here&apos;s what we filter for.
        </p>
      </div>

      <ol className="mt-14 grid gap-6 md:grid-cols-2">
        {CRITERIA.map((c, i) => (
          <li key={c.title} className="surface p-6 md:p-7">
            <div className="font-mono text-xs text-ink-dim">0{i + 1}</div>
            <h3 className="mt-2 font-display text-lg font-semibold text-ink">{c.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted text-pretty">{c.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        <div className="surface p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold text-ink">
            See the live delegation set
          </h2>
          <p className="mt-3 text-sm text-ink-muted text-pretty">
            The list of currently-delegated validators is recorded on-chain in the pool account
            itself. The most accurate, up-to-the-epoch view is in Solscan.
          </p>
          <a
            href={LINKS.solscanPool}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sunrise-600 hover:text-sunrise-500"
          >
            View pool on Solscan <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="surface p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold text-ink">
            Run a validator? Apply to be whitelisted
          </h2>
          <p className="mt-3 text-sm text-ink-muted text-pretty">
            If you operate a Solana validator and meet the criteria above, you can submit
            your details for review. Approved validators become eligible to receive stake
            from the pool.
          </p>
          <Link
            href="/whitelist-apply"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sunrise-600 hover:text-sunrise-500"
          >
            Apply for whitelisting <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
