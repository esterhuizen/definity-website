import type { ReactNode } from 'react';
import { POOL } from '@/config/pool';

type QA = { q: string; a: ReactNode };

export const HOMEPAGE_FAQ: QA[] = [
  {
    q: 'How safe is staking with Definity?',
    a: `Definity is built on Sanctum's audited stake-pool program, a battle-tested fork of Solana's SPL Stake Pool. The pool itself can't move your SOL; only you can, by signing transactions in your own wallet. You can unstake whenever you want.`,
  },
  {
    q: `What is ${POOL.lstSymbol}?`,
    a: `${POOL.lstSymbol} is the liquid staking token you receive when you stake SOL with Definity. It represents your share of the pool. As the pool earns rewards each epoch, the redemption value of ${POOL.lstSymbol} for SOL grows, so the rewards accrue to the token itself.`,
  },
  {
    q: 'How do I unstake?',
    a: `Right in the stake panel: switch it to Unstake and we route ${POOL.lstSymbol} → SOL through Jupiter (usually instant, for a small market fee). If you'd rather avoid the market fee, a direct pool withdrawal on Sanctum settles at the next epoch boundary at the exact pool rate.`,
  },
  {
    q: 'Where do staking rewards come from?',
    a: `Solana validators earn block rewards and inflation rewards every epoch (~2 days). The pool delegates your stake across high-uptime validators we curate, collects those rewards, and compounds them into the value of ${POOL.lstSymbol}.`,
  },
  {
    q: 'How does Definity support the regions narrative?',
    a: `A portion of pool fees is reinvested into developer programs, hackathons and early-stage support for builders in emerging markets, focused on APAC, the Middle East, Africa, and South America. The rest of the rewards go straight back to ${POOL.lstSymbol} holders.`,
  },
];

export const DIRECT_STAKING_FAQ: QA[] = [
  {
    q: 'What is direct staking?',
    a: `A second way to stake with Definity. Instead of letting the pool spread your stake across its curated set, you pick the validator you want to back. You deposit SOL, receive ${POOL.lstSymbol} (your liquid stake), and Definity directs additional pool stake onto your chosen validator — amplifying your delegation, with no separate token to manage.`,
  },
  {
    q: 'How much does Definity match?',
    a: `For every 1 SOL you direct-stake, Definity directs up to 3.5× that amount of pool stake onto your validator — subject to pool liquidity and capped at 20,000 SOL per validator. If your validator is also in the Solana Foundation Delegation Program (SFDP), the Foundation matches again on top, taking the total beyond 3.5×.`,
  },
  {
    q: 'When does the matching go live?',
    a: `It follows the epoch cadence. Your stake first has to sit in place for a full epoch (~2 days) — an anti-gaming window. Once it clears that window it becomes eligible, and the next optimiser cycle directs the matching stake onto your validator; that directed stake then warms up over one more epoch before it is active and earning. So roughly: deposit in one epoch, eligible and directed the next, active the epoch after. Your balance page shows when each deposit becomes eligible.`,
  },
  {
    q: 'Do I keep my liquidity?',
    a: `Yes. You hold ${POOL.lstSymbol} — the same liquid staking token as regular Definity staking — in your own wallet. It keeps earning the pool's yield and you can move or redeem it any time. Directing it to a validator is an attribution that drives the matching; it never locks your tokens.`,
  },
  {
    q: 'How do I unstake?',
    a: `There is no lock-up. Redeem ${POOL.lstSymbol} → SOL on Sanctum or Jupiter (usually instant, for a small market fee), or do a direct pool withdrawal at the next epoch boundary at the exact pool rate. If you reduce your ${POOL.lstSymbol} holding, the matching to your validator simply scales down with it.`,
  },
  {
    q: 'What happens to my matching if I reduce my direct stake?',
    a: `It follows your balance down. The match is based on the MINIMUM ${POOL.lstSymbol} you have held over the trailing epoch, so reducing your direct-staked balance immediately lowers your matching basis, and the next optimiser cycle scales the directed stake down to match. There is no grace period on the old, higher balance — you are matched on what you keep continuously in place, not a past peak. (One consequence of the same rule: even a brief dip lowers your basis until the trailing window passes it, about an epoch — and it is what stops anyone gaming the match by depositing then pulling out.)`,
  },
  {
    q: 'Which validators can I direct-stake to?',
    a: `Any validator in Definity's pool that clears the eligibility gates — the same commission, MEV, skip-rate, uptime and SFDP checks every pool validator passes, re-checked every epoch. Search the vetted set in the widget. If a validator stops being eligible, its directed stake is pulled back.`,
  },
  {
    q: 'Is there a cap on how much can be directed?',
    a: `Yes. Matching is capped at 20,000 SOL per validator, and the whole directed sleeve is bounded and ring-fenced. It is the only stake in the pool allowed to deviate from the decentralisation formula — everything else stays decentralisation-allocated.`,
  },
  {
    q: 'Can someone game the matching by depositing then withdrawing?',
    a: `No. The matching basis is the minimum stake you held continuously across a full epoch window, reconstructed from on-chain history rather than a one-off snapshot. A deposit that lands just before an allocation and leaves right after has a minimum of zero and earns nothing — you are only matched on what you genuinely keep in place. That is the reason for the ~1-epoch wait.`,
  },
  {
    q: 'Does direct staking hurt the pool’s decentralisation?',
    a: `No. Directed stake is hard-capped and measured against the open Geographic Decentralisation Index (GDI) every cycle. The program is fully disclosed and can never quietly degrade the pool's mandate — it amplifies your stake inside a bounded, ring-fenced carve-out.`,
  },
  {
    q: 'Can I loop or leverage a direct-staked position?',
    a: `Soon. A ${POOL.lstSymbol} leverage market is on the way — once it is live you will be able to loop a direct-staked position (deposit, borrow SOL, re-stake) to amplify your delegation further, routed to the best available rate.`,
  },
  {
    q: 'Who should consider direct staking?',
    a: `Validator operators who want stake directed onto their own nodes, and delegators who want to back specific validators they trust — while keeping a single liquid token and the pool's yield. If you just want simple liquid staking, regular Definity staking spreads your stake across the curated set instead.`,
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
