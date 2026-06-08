import type { ReactNode } from 'react';
import { POOL } from '@/config/pool';

type QA = { q: string; a: ReactNode };

export const HOMEPAGE_FAQ: QA[] = [
  {
    q: 'How safe is staking with Definity?',
    a: `Definity is built on Sanctum's audited stake-pool program — a battle-tested fork of Solana's SPL Stake Pool. The pool itself can't move your SOL — only you can, by signing transactions in your own wallet. You can unstake whenever you want.`,
  },
  {
    q: `What is ${POOL.lstSymbol}?`,
    a: `${POOL.lstSymbol} is the liquid staking token you receive when you stake SOL with Definity. It represents your share of the pool. As the pool earns rewards each epoch, the redemption value of ${POOL.lstSymbol} for SOL grows — so the rewards accrue to the token itself.`,
  },
  {
    q: 'How do I unstake?',
    a: `Right in the stake panel: switch it to Unstake and we route ${POOL.lstSymbol} → SOL through Jupiter — usually instant, for a small market fee. If you'd rather avoid the market fee, a direct pool withdrawal on Sanctum settles at the next epoch boundary at the exact pool rate.`,
  },
  {
    q: 'Where do staking rewards come from?',
    a: `Solana validators earn block rewards and inflation rewards every epoch (~2 days). The pool delegates your stake across high-uptime validators we curate, collects those rewards, and compounds them into the value of ${POOL.lstSymbol}.`,
  },
  {
    q: 'How does Definity support the regions narrative?',
    a: `A portion of pool fees is reinvested into developer programs, hackathons and early-stage support for builders in emerging markets — focused on APAC, the Middle East, Africa, and South America. The rest of the rewards go straight back to ${POOL.lstSymbol} holders.`,
  },
];

export function FAQAccordion({ items = HOMEPAGE_FAQ }: { items?: QA[] }) {
  return (
    <div className="divide-y divide-ring overflow-hidden rounded-2xl border border-ring bg-bg shadow-card">
      {items.map((item) => (
        <details key={item.q} className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 px-6 py-5 transition hover:bg-bg-muted/60 [&::-webkit-details-marker]:hidden">
            <span className="font-display text-base font-medium text-ink">{item.q}</span>
            <span
              aria-hidden
              className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ring text-ink-muted transition group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="px-6 pb-6 text-sm leading-relaxed text-ink-muted text-pretty">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
