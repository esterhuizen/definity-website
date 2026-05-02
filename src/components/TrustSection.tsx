import { Lock, FileCheck2, Eye, Unplug } from 'lucide-react';

const PROPS = [
  {
    icon: Lock,
    title: 'You hold the keys, always',
    body:
      'Definity is non-custodial. Every stake or unstake is signed by your own wallet. The pool program itself can\'t move user funds — that\'s enforced on-chain by Solana.',
  },
  {
    icon: FileCheck2,
    title: 'Built on audited code',
    body:
      'The pool runs on Solana\'s native SPL Stake Pool program, which has been audited multiple times by independent firms. We don\'t roll our own staking logic.',
  },
  {
    icon: Eye,
    title: 'Open and verifiable',
    body:
      'Pool address, validator list, fees and reserve are all public on-chain. Inspect them in Solscan, or read the addresses straight from this site.',
  },
  {
    icon: Unplug,
    title: 'No lockups',
    body:
      'Liquid staking means you exit when you choose to. Swap definSOL back to SOL on Sanctum or Jupiter — usually instantly, without waiting epochs.',
  },
];

export function TrustSection() {
  return (
    <section className="border-y border-ring/60 bg-bg-raised/30">
      <div className="container-narrow py-24">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">Built to be trusted</span>
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Security isn't a feature. It's the floor.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-ink-muted text-pretty md:text-lg">
            Definity inherits the security model of Solana's native staking program — and adds
            zero attack surface of its own.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {PROPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="surface p-6 md:p-7">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-bg-muted ring-1 ring-ring">
                  <Icon className="h-4 w-4 text-sunrise-400" aria-hidden="true" />
                </div>
                <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted text-pretty">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
