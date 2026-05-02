import { Wallet, Coins, Workflow, Repeat, ArrowDown, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { LINKS, POOL } from '@/config/pool';

const STEPS = [
  {
    icon: Wallet,
    title: 'Connect your wallet',
    body:
      'Open the stake panel and connect Phantom, Solflare, or Backpack. Definity never takes custody of your SOL — every action is signed by you.',
  },
  {
    icon: Coins,
    title: 'Swap SOL for definSOL',
    body:
      'Choose how much SOL to stake. You receive definSOL, a liquid staking token that represents your share of the pool. Its value grows as the pool earns rewards.',
  },
  {
    icon: Workflow,
    title: 'We delegate to top validators',
    body:
      'Definity routes your stake to a curated set of high-uptime validators and rebalances each epoch. You earn the network reward without managing anything.',
  },
  {
    icon: Repeat,
    title: 'Use it in DeFi — or unstake',
    body:
      'Hold definSOL, lend it, LP it, or swap it back to SOL the moment you want to. Your yield keeps compounding into the token even while it\'s working elsewhere.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-y border-ring bg-bg-muted/50">
      <div className="container-narrow py-24 md:py-32">
        {/* Intro + step grid */}
        <div className="grid gap-12 md:grid-cols-12 md:items-center">
          <div className="md:col-span-5">
            <span className="eyebrow">How it works</span>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              Four steps. About a minute.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
              Liquid staking on Solana is mechanically simple. The hard part — picking validators,
              rebalancing, monitoring health — is what we handle on your behalf.
            </p>
          </div>

          <div className="md:col-span-7">
            <ol className="grid gap-4 sm:grid-cols-2">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="surface p-6">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-bg-muted ring-1 ring-ring">
                      <Icon className="h-4 w-4 text-sunrise-500" aria-hidden="true" />
                    </div>
                    <span className="font-mono text-xs text-ink-dim">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-base font-semibold text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted text-pretty">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Bridge — explanation → action */}
        <div
          id="stake"
          className="scroll-mt-24 mt-20 flex items-center justify-center gap-4 md:mt-24"
        >
          <span className="hidden h-px flex-1 bg-ring sm:block" aria-hidden="true" />
          <h3 className="font-display text-2xl font-semibold tracking-tight text-balance md:text-3xl">
            Stake with Definity{' '}
            <span className="bg-sunrise-gradient bg-clip-text text-transparent">now</span>.
          </h3>
          <span className="hidden h-px flex-1 bg-ring sm:block" aria-hidden="true" />
        </div>

        {/* Action panel */}
        <div className="mx-auto mt-10 max-w-2xl">
          <div className="surface relative overflow-hidden p-6 shadow-glow-sm md:p-8">
            <div className="absolute inset-0 bg-dawn-gradient opacity-50" aria-hidden="true" />

            <div className="relative space-y-3">
              <div className="rounded-xl border border-ring bg-bg-muted/60 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">You stake</div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
                    SOL
                  </span>
                  <TokenChip label="SOL" tone="solana" />
                </div>
                <p className="mt-2 text-xs text-ink-dim">Native Solana</p>
              </div>

              <div className="flex items-center justify-center" aria-hidden="true">
                <div className="-my-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ring bg-bg">
                  <ArrowDown className="h-4 w-4 text-sunrise-500" />
                </div>
              </div>

              <div className="rounded-xl border border-sunrise-300 bg-bg-muted/60 p-5">
                <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">You receive</div>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <span className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
                    {POOL.lstSymbol}
                  </span>
                  <TokenChip label={POOL.lstSymbol} tone="sunrise" />
                </div>
                <p className="mt-2 text-xs text-ink-dim">
                  Liquid receipt · accrues staking rewards
                </p>
              </div>
            </div>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
              <a
                href={LINKS.jupiterSwap}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Stake on Jupiter <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href={LINKS.sanctumLst}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Stake on Sanctum <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            <p className="relative mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-dim">
              <ShieldCheck className="h-3 w-3 text-success" aria-hidden="true" />
              Both routes settle to the same {POOL.lstSymbol} mint —{' '}
              <span className="font-mono">
                {POOL.lstMint.slice(0, 4)}…{POOL.lstMint.slice(-4)}
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TokenChip({ label, tone }: { label: string; tone: 'solana' | 'sunrise' }) {
  const ring =
    tone === 'sunrise'
      ? 'ring-sunrise-500/40 bg-sunrise-500/10'
      : 'ring-solana-500/40 bg-solana-500/10';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-ink ring-1 ${ring}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          tone === 'sunrise' ? 'bg-sunrise-500' : 'bg-solana-500'
        }`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
