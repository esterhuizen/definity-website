import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FAQAccordion } from '@/components/FAQAccordion';
import { POOL } from '@/config/pool';

export const metadata: Metadata = {
  title: 'FAQ',
  description: `Detailed answers about Definity, ${POOL.lstSymbol}, staking on Solana, security, fees, and how Definity supports the ecosystem in emerging regions.`,
};

const FULL_FAQ = [
  {
    q: 'What is staking, in plain terms?',
    a: 'Solana is secured by validators that process transactions. To run a validator, you need stake. SOL holders can delegate their tokens to validators, and in exchange they earn a share of the rewards those validators produce — paid every epoch, about every two days. Staking is how the network pays the people who keep it honest.',
  },
  {
    q: 'What is a stake pool?',
    a: 'A stake pool is an on-chain program that aggregates SOL from many delegators and spreads it across a set of validators using a defined strategy. You receive a token (definSOL, in our case) representing your share of the pool. The advantage: instant diversification across validators, no manual rebalancing, and a liquid receipt you can use elsewhere in DeFi.',
  },
  {
    q: `What exactly is ${POOL.lstSymbol}?`,
    a: `${POOL.lstSymbol} is the liquid staking token issued by Definity's stake pool. One ${POOL.lstSymbol} represents a share of the total SOL in the pool. As the pool earns staking rewards, the redemption rate grows — so 1 ${POOL.lstSymbol} is worth more SOL over time. The price isn't pegged 1:1 to SOL; it appreciates with rewards.`,
  },
  {
    q: 'How safe is it?',
    a: `Definity uses Solana's native SPL Stake Pool program, which has been audited multiple times by independent firms. The audits and source code are public. The pool program enforces on-chain that user funds can only ever be moved by their owner — Definity does not have custody. Beyond that, the only "trust" assumption is that we delegate to good validators (we monitor uptime and rebalance accordingly).`,
  },
  {
    q: 'What are the fees?',
    a: `Stake-pool fees are set on-chain and are visible on the pool account itself. They typically come in three forms: a small fee on staking rewards (the standard model — taken from yield, not principal), a small management fee, and an SOL-deposit fee for instant deposits. The exact current values are encoded on-chain at the pool address — check Solscan for the live numbers.`,
  },
  {
    q: 'How do I unstake?',
    a: `Two paths. (1) Instant: swap ${POOL.lstSymbol} → SOL on Sanctum or Jupiter. There's a small market fee but you receive SOL within seconds. (2) Direct withdrawal: request a withdrawal from the pool. Settles at the next epoch boundary at the exact pool exchange rate, no market slippage.`,
  },
  {
    q: 'How are validators selected?',
    a: (
      <>
        Admission gates: commission ≤ 5%, MEV commission ≤ 10%, actively voting on
        mainnet (&lt; 4hr offline / 7d), skip rate below 10% across recent epochs
        (stricter than SFDP), SFDP standing intact, and team based in APAC. After
        admission, the size of each validator&apos;s delegation is determined each
        epoch by their composite rarity rank under the{' '}
        <a
          href="https://gdindex.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-ring underline-offset-2 hover:text-ink"
        >
          GDI methodology
        </a>
        : operators whose country / city / ASN are underrepresented in Solana
        network stake receive larger delegations than those in already-saturated
        buckets. Validator hosting location is NOT an admission gate — every
        admitted operator gets some stake; rarity determines how much. Approved
        validators are continuously monitored for operational compliance (commission
        drift, delinquency, etc.); substance is not re-evaluated after admission.
        Full criteria are on the Validators page.
      </>
    ),
  },
  {
    q: 'Where does the "supporting the ecosystem in emerging regions" part actually come from?',
    a: 'A portion of pool fees — the share that would otherwise be Definity\'s revenue — is reinvested into developer programs, hackathons, and early-stage support for builders in emerging markets, with an initial focus on APAC. This is operational, not speculative: every reinvested dollar comes from real, on-chain pool fees that have already accrued.',
  },
  {
    q: 'Is there any minimum stake?',
    a: 'No protocol-level minimum to hold definSOL. The Solana network does enforce a tiny rent-exempt minimum on token accounts (around 0.002 SOL) — that\'s a network thing, not a Definity thing.',
  },
  {
    q: 'What happens if Definity goes away?',
    a: 'definSOL keeps working. The pool is on-chain and self-custodial. Even with no one running the website, you can still redeem definSOL for SOL via the SPL Stake Pool program directly, or trade it on Sanctum/Jupiter as long as liquidity exists. That\'s the point of building on top of an audited, native primitive instead of a bespoke contract.',
  },
];

export default function FAQPage() {
  return (
    <div className="container-narrow py-20 md:py-28">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>

      <div className="mt-8 max-w-2xl">
        <span className="eyebrow">FAQ</span>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Everything you might want to know about staking with Definity.
        </h1>
        <p className="mt-5 text-lg text-ink-muted text-pretty">
          Plain-English answers. If something&apos;s missing, ping us on Telegram or X.
        </p>
      </div>

      <div className="mt-12">
        <FAQAccordion items={FULL_FAQ} />
      </div>
    </div>
  );
}
