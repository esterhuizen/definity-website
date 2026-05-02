import { Wallet, Coins, Workflow, Repeat } from 'lucide-react';

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
    <section id="how" className="scroll-mt-24 border-y border-ring/60 bg-bg-raised/30">
      <div className="container-narrow py-24 md:py-32">
        <div className="grid gap-12 md:grid-cols-12 md:items-end">
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
                      <Icon className="h-4 w-4 text-sunrise-400" aria-hidden="true" />
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
      </div>
    </section>
  );
}
