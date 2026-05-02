import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { LINKS, POOL } from '@/config/pool';

// We embed the Sanctum LST page in an iframe — Sanctum is the audited stake-pool
// aggregator already integrated with definSOL. The iframe is sandboxed to forms,
// scripts, popups, and same-origin (needed for wallet connect inside Sanctum).
// All wallet signing happens inside the iframe, never on this site's origin.
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
              The widget below is powered by Sanctum, the audited stake-pool router used across
              Solana. Your wallet connects directly inside it — Definity's site never touches your
              keys or your SOL.
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

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={LINKS.sanctumLst}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Open Sanctum <ArrowUpRight className="h-4 w-4" />
              </a>
              <a
                href={LINKS.jupiterSwap}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost"
              >
                Swap on Jupiter <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            <p className="mt-6 text-xs text-ink-dim">
              Trouble loading the widget? Open it directly on{' '}
              <Link
                href={LINKS.sanctumLst}
                className="underline decoration-ring underline-offset-2 hover:text-ink"
              >
                app.sanctum.so
              </Link>
              .
            </p>
          </div>

          <div className="md:col-span-7">
            <div className="surface relative overflow-hidden p-2 shadow-glow-sm">
              <div className="aspect-[5/6] w-full overflow-hidden rounded-xl bg-bg sm:aspect-[4/5]">
                <iframe
                  src={LINKS.sanctumLst}
                  title="Stake SOL for definSOL via Sanctum"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-popups allow-forms allow-same-origin allow-popups-to-escape-sandbox"
                  className="h-full w-full border-0"
                />
              </div>
            </div>
            <p className="mt-3 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              Powered by Sanctum · Pool {POOL.stakePoolAddress.slice(0, 6)}…{POOL.stakePoolAddress.slice(-4)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
