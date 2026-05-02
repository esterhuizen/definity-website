import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { LINKS } from '@/config/pool';

export const metadata: Metadata = {
  title: 'Apply for whitelisting',
  description:
    'Validators: apply to be whitelisted in the Definity stake pool. Performance criteria, regional alignment, and how to submit.',
};

const REQUIRED = [
  'Sustained high uptime across recent epochs. We drop validators that consistently miss leader slots.',
  'Independent infrastructure — own hardware in distinct geographies, not a shared upstream provider.',
  'Reasonable commission. Healthy validators invest in their nodes; we weigh commission against demonstrated performance.',
  'Self-stake and a track record across multiple epochs.',
  'Operating in, or actively serving, APAC or EMEA emerging markets. This is a base requirement, not a tiebreaker — pool delegations are reserved for validator teams aligned with the mission.',
];

const PREFERRED = [
  'Validator teams who are themselves founders, builders, or shippers — and who can point to visible, measurable work growing the Solana ecosystem in their region. Shipped products, dev tooling, hackathons run, education or community work, audited contributions. Real outputs, not stated intentions.',
];

export default function WhitelistApplyPage() {
  const formConfigured = !!LINKS.applyForm;

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
          If you run a validator and you believe you meet the criteria below, submit your details
          and we&apos;ll get back to you. Whitelisted validators are eligible to receive stake
          based on their relative performance, in line with the rest of our validator selection
          rules.
        </p>
      </div>

      <div className="mt-12 space-y-10">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Required to be eligible</h2>
          <p className="mt-2 text-sm text-ink-muted text-pretty">
            All five must be true before we&apos;ll review an application.
          </p>
          <ol className="mt-5 space-y-3">
            {REQUIRED.map((c, i) => (
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
          <h2 className="font-display text-xl font-semibold text-ink">What earns preference</h2>
          <p className="mt-2 text-sm text-ink-muted text-pretty">
            Beyond the eligibility bar, this is what moves an application up the queue.
          </p>
          <ol className="mt-5 space-y-3" start={REQUIRED.length + 1}>
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
                  {REQUIRED.length + i + 1}
                </span>
                <p className="relative text-sm leading-relaxed text-ink text-pretty">{c}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-12 surface relative overflow-hidden p-7 md:p-9">
        <div className="absolute inset-0 bg-dawn-gradient opacity-60" aria-hidden="true" />
        <div className="relative">
          <h2 className="font-display text-xl font-semibold text-ink md:text-2xl">
            Open the application form
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-muted text-pretty">
            The form opens on an external page. Have your vote-account pubkey, identity pubkey,
            commission, self-stake amount, data-centre region, and a Telegram or email contact
            ready before you start.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {formConfigured ? (
              <a
                href={LINKS.applyForm}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Open application form <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Set LINKS.applyForm in src/config/pool.ts"
                className="btn-primary cursor-not-allowed opacity-60"
              >
                Application form — coming back online
              </button>
            )}
            <a
              href={LINKS.telegram}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              Or reach us on Telegram <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          <p className="relative mt-5 flex items-center gap-1.5 text-xs text-ink-dim">
            <ShieldCheck className="h-3 w-3 text-success" aria-hidden="true" />
            We never ask for your validator&apos;s private keys. Application data stays on the
            form provider&apos;s servers and is reviewed manually.
          </p>
        </div>
      </div>
    </div>
  );
}
