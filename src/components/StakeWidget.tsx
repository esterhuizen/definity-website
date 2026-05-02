import { ArrowDown, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { LINKS, POOL } from '@/config/pool';

// Sanctum and Jupiter both block iframe embedding (frame-ancestors / X-Frame-Options),
// so we render a native "stake" panel and route the user out to their canonical UIs.
// Wallet signing happens entirely on Sanctum or Jupiter — this site never touches keys.
export function StakeWidget() {
  return (
    <section id="stake" className="scroll-mt-24 py-24 md:py-32">
      <div className="container-narrow">
        <div className="grid gap-12 md:grid-cols-12 md:items-start">
          <div className="md:col-span-5">
            <span className="eyebrow">Stake now</span>
            <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              Convert SOL to{' '}
              <span className="bg-sunrise-gradient bg-clip-text text-transparent">{POOL.lstSymbol}</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
              Definity routes the actual swap through Jupiter — the network's biggest aggregator —
              or Sanctum, the audited stake-pool router used across Solana. Either way, your wallet
              connects directly to them. Definity's site never touches your keys or your SOL.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-start gap-3 text-ink-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>Non-custodial. You sign every transaction.</span>
              </li>
              <li className="flex items-start gap-3 text-ink-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>Built on the audited Solana SPL Stake Pool program.</span>
              </li>
              <li className="flex items-start gap-3 text-ink-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>Unstake instantly via Sanctum or swap on Jupiter anytime.</span>
              </li>
            </ul>
          </div>

          <div className="md:col-span-7">
            <div className="surface relative overflow-hidden p-6 shadow-glow-sm md:p-8">
              <div className="absolute inset-0 bg-dawn-gradient opacity-50" aria-hidden />

              <div className="relative space-y-3">
                <div className="rounded-xl border border-ring/80 bg-bg-muted/60 p-5">
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
                  <div className="-my-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ring bg-bg-raised">
                    <ArrowDown className="h-4 w-4 text-sunrise-400" />
                  </div>
                </div>

                <div className="rounded-xl border border-sunrise-500/30 bg-bg-muted/60 p-5">
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

              <p className="relative mt-4 text-center text-[11px] text-ink-dim">
                Both routes settle to the same {POOL.lstSymbol} mint —{' '}
                <span className="font-mono">{POOL.lstMint.slice(0, 4)}…{POOL.lstMint.slice(-4)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TokenChip({ label, tone }: { label: string; tone: 'solana' | 'sunrise' }) {
  const ring =
    tone === 'sunrise' ? 'ring-sunrise-500/40 bg-sunrise-500/10' : 'ring-solana-500/40 bg-solana-500/10';
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-ink ring-1 ${ring}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          tone === 'sunrise' ? 'bg-sunrise-400' : 'bg-solana-500'
        }`}
        aria-hidden
      />
      {label}
    </span>
  );
}
