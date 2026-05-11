import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { LINKS } from '@/config/pool';
import { WhitelistForm } from '@/components/WhitelistForm';

export const metadata: Metadata = {
  title: 'Apply for whitelisting',
  description:
    'Validators: apply to be whitelisted in the Definity stake pool. Performance criteria, regional alignment, and how to submit.',
};

const HARD_THRESHOLDS = [
  'Validator commission ≤ 5%. Exactly 5% is allowed; 5.01% rejects.',
  'MEV commission ≤ 10% (1000 bps). Jito MEV commission cannot exceed this.',
  'Actively voting on Solana mainnet — vote account live, not persistently delinquent (no more than 4 hours offline in any 7-day window).',
  'Strong voting performance — Stakewiz `skip_rate` below 10% across recent epochs. Stricter than SFDP\'s `network_average + 5pp` rule. A persistent pattern of missed leader slots is degraded operational health, even if the validator never goes fully offline.',
  'SFDP standing intact — not removed from the Solana Foundation Delegation Program for cause.',
];

const MISSION = [
  'Team based in APAC. East Asia (Japan, Korea, Taiwan, Hong Kong), Southeast Asia (Singapore, Indonesia, Philippines, Thailand, Vietnam, Malaysia, …), South Asia (India, Bangladesh, Pakistan, Sri Lanka, Nepal), or Oceania (Australia, New Zealand). This is operator location — not corporate domicile, not hosting location.',
];

const PREFERRED = [
  'Verifiable, measurable contributions to the Solana ecosystem in your region. Shipped products, dev tooling, hackathons run, education or community work, audited contributions. Real outputs with public evidence, not stated intentions.',
];

export default function WhitelistApplyPage() {
  return (
    <div className="container-narrow py-20 md:py-28">
      <Link
        href="/validators"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to validators
      </Link>

      <div className="mt-8 max-w-2xl">
        <span className="eyebrow">Validators</span>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          Apply for whitelisting
        </h1>
        <p className="mt-5 text-lg text-ink-muted text-pretty">
          If you run a validator and you believe you meet the criteria below, submit your
          details and we&apos;ll get back to you. Admission is gated by the hard thresholds +
          team-location requirement. After admission, the size of your delegation is
          determined each epoch by your composite rarity rank under the{' '}
          <a
            href="https://gdindex.app/validator"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-ring underline-offset-2 hover:text-ink"
          >
            GDI methodology
          </a>
          : operators in underrepresented countries, cities, and ASNs receive larger
          delegations than those in already-saturated buckets, but everyone admitted gets
          some stake.
        </p>
      </div>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Hard thresholds</h2>
          <p className="mt-2 text-sm text-ink-muted text-pretty">
            Operational gates with concrete numbers. Each is verified against on-chain or
            public-API data; every rejection cites the specific rule.
          </p>
          <ol className="mt-5 space-y-3">
            {HARD_THRESHOLDS.map((c, i) => (
              <li key={i} className="surface flex items-start gap-3 p-5">
                <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-muted font-mono text-xs text-ink-muted ring-1 ring-ring">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink-muted text-pretty">{c}</p>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Mission alignment</h2>
          <p className="mt-2 text-sm text-ink-muted text-pretty">
            Two distinct location signals — both required. Team location is about where the
            people doing the work are based; validator location is about where the box runs.
          </p>
          <ol className="mt-5 space-y-3" start={HARD_THRESHOLDS.length + 1}>
            {MISSION.map((c, i) => (
              <li key={i} className="surface flex items-start gap-3 p-5">
                <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg-muted font-mono text-xs text-ink-muted ring-1 ring-ring">
                  {HARD_THRESHOLDS.length + i + 1}
                </span>
                <p className="text-sm leading-relaxed text-ink-muted text-pretty">{c}</p>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink">What earns preference</h2>
          <p className="mt-2 text-sm text-ink-muted text-pretty">
            Beyond the eligibility bar, this is what moves an application up the queue.
          </p>
          <ol className="mt-5 space-y-3" start={HARD_THRESHOLDS.length + MISSION.length + 1}>
            {PREFERRED.map((c, i) => (
              <li
                key={i}
                className="surface relative flex items-start gap-3 overflow-hidden p-5"
              >
                <div
                  className="absolute inset-0 bg-dawn-gradient opacity-50"
                  aria-hidden="true"
                />
                <span className="relative mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sunrise-gradient font-mono text-xs font-semibold text-white">
                  {HARD_THRESHOLDS.length + MISSION.length + i + 1}
                </span>
                <p className="relative text-sm leading-relaxed text-ink text-pretty">{c}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="font-display text-xl font-semibold text-ink md:text-2xl">
          Submit your application
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted text-pretty">
          Have your validator&apos;s vote id, country, and an email / Telegram / X contact
          ready before you start.
        </p>

        <div className="mt-6">
          <WhitelistForm />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-ink-dim">
            <ShieldCheck className="h-3 w-3 text-success" aria-hidden="true" />
            Your information is kept private and confidential.
          </p>
          <a
            href={LINKS.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-ink-muted underline decoration-ring underline-offset-2 hover:text-ink"
          >
            Questions? DM {LINKS.telegramHandle} on Telegram <ArrowUpRight className="inline h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
