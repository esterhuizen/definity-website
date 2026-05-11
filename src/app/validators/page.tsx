import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { LINKS } from '@/config/pool';
import { TrackedLink } from '@/components/TrackedLink';

export const metadata: Metadata = {
  title: 'Validators',
  description:
    'How Definity selects, monitors and rebalances the validators that secure your stake.',
};

// Hard thresholds — concrete, published, automatically verified. Every
// rejection cites the specific rule violated so applicants can self-check.
const HARD_THRESHOLDS = [
  {
    title: 'Validator commission ≤ 5%',
    body: 'On-chain commission (from Solana RPC) cannot exceed 5%. Exactly 5% is allowed; 5.01% rejects.',
  },
  {
    title: 'MEV commission ≤ 10%',
    body: 'Jito MEV commission cannot exceed 1000 basis points. Exactly 10% is allowed; 10.01% rejects.',
  },
  {
    title: 'Actively voting on mainnet',
    body: 'Vote account must be live on Solana mainnet and not persistently delinquent — no more than 4 hours offline in any 7-day window.',
  },
  {
    title: 'Strong voting performance',
    body: 'Skip rate must remain below 10% across recent epochs (Stakewiz `skip_rate`). This is stricter than SFDP\'s `network_average + 5pp` rule — Definity is a curated pool, not a delegation program. A persistent pattern of missed leader slots is degraded operational health even if the validator never goes fully offline.',
  },
  {
    title: 'SFDP standing intact',
    body: 'Must not have been removed from the Solana Foundation Delegation Program for cause.',
  },
];

// Mission alignment — about *who* operates the validator, not *where* the
// box runs. Validator hosting location is NOT an admission requirement; it
// only determines how much stake an admitted validator receives (see
// "How we allocate stake" below).
const MISSION = [
  {
    title: 'Team based in APAC',
    body: 'Where the people doing the work are physically located — Japan, Korea, Singapore, Taiwan, Hong Kong, Indonesia, India, the Philippines, Thailand, Vietnam, Malaysia, Australia, New Zealand, and the rest of East/Southeast/South Asia + Oceania. This is operator location, not corporate domicile (FZCO / BVI / Cayman are common for tax — they don\'t affect this filter) and not hosting location. A Japan-based team running their node anywhere on the planet passes; a US-based team running their node in Tokyo does not.',
  },
];

// What earns preference — kept general but concrete in the asks.
const PREFERRED = {
  title: 'Verifiable, measurable contributions',
  body: 'Above the eligibility bar, validator teams with visible, measurable work growing the Solana ecosystem in their region get preference. Shipped products, dev tooling, hackathons run, education or community work, audited contributions. Real outputs with public evidence, not stated intentions.',
};

export default function ValidatorsPage() {
  return (
    <div className="container-narrow py-20 md:py-28">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>

      <div className="mt-8 max-w-2xl">
        <span className="eyebrow">Validators</span>
        <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          How we choose where your stake goes.
        </h1>
        <p className="mt-5 text-lg text-ink-muted text-pretty">
          Definity delegates across a curated set of validators — and the pool rebalances each
          epoch so that allocation stays current. Here&apos;s what we filter for.
        </p>
      </div>

      <div className="mt-14">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink-dim">
          Hard thresholds
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted text-pretty">
          Operational gates with concrete numbers. Each is read from a public on-chain or
          public-API source — every rejection cites the specific rule violated so you can
          verify it yourself.
        </p>
        <ol className="mt-5 grid gap-6 md:grid-cols-2">
          {HARD_THRESHOLDS.map((c, i) => (
            <li key={c.title} className="surface p-6 md:p-7">
              <div className="font-mono text-xs text-ink-dim">0{i + 1}</div>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted text-pretty">{c.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-14">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink-dim">
          Mission alignment
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-ink-muted text-pretty">
          About who runs the validator — not where the box runs. (Validator hosting location
          is not an admission requirement; it determines stake allocation post-admission. See
          &ldquo;How we allocate stake&rdquo; below.)
        </p>
        <ol className="mt-5 grid gap-6 md:grid-cols-2" start={HARD_THRESHOLDS.length + 1}>
          {MISSION.map((c, i) => (
            <li key={c.title} className="surface p-6 md:p-7">
              <div className="font-mono text-xs text-ink-dim">0{HARD_THRESHOLDS.length + i + 1}</div>
              <h3 className="mt-2 font-display text-lg font-semibold text-ink">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted text-pretty">{c.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-14">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink-dim">
          What earns preference
        </h2>
        <div className="mt-5 surface relative overflow-hidden p-6 md:p-7">
          <div className="absolute inset-0 bg-dawn-gradient opacity-50" aria-hidden="true" />
          <div className="relative">
            <div className="font-mono text-xs text-ink-dim">0{HARD_THRESHOLDS.length + MISSION.length + 1}</div>
            <h3 className="mt-2 font-display text-lg font-semibold text-ink">{PREFERRED.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted text-pretty">{PREFERRED.body}</p>
          </div>
        </div>
      </div>

      <div className="mt-14 max-w-3xl">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink-dim">
          How we allocate stake
        </h2>
        <p className="mt-5 text-base text-ink-muted text-pretty">
          Admitted validators all receive some stake — but{' '}
          <strong className="text-ink">how much</strong> depends on where they
          run. Each epoch, pool stake is distributed across the admitted set
          in proportion to each validator&apos;s composite rarity on country,
          city, and ASN (measured live against the GDI methodology). A
          validator whose country and ASN are both underweight in the network
          earns the largest delegation. One whose location duplicates an
          already-saturated bucket receives the minimum but is still admitted.
        </p>
        <p className="mt-4 text-base text-ink-muted text-pretty">
          This replaces a previous flat stake-per-validator approach. Flat
          was easy to reason about but didn&apos;t reward operators in places
          that need stake the most. Under the rarity-weighted strategy, an
          APAC operator running a node in an underweight city / ASN — Manila,
          Jakarta, Hong Kong outside the popular Chai Wan / Equinix clusters,
          a Bangalore datacenter that isn&apos;t shared upstream with a dozen
          other validators — receives meaningfully more stake than a seventh
          validator in Frankfurt on Hetzner or Tokyo on Allnodes.
        </p>
        <p className="mt-4 text-base text-ink-muted text-pretty">
          Rebalancing happens gradually each epoch. No operator loses more
          than a small fraction of their delegation in any single epoch,
          giving teams time to migrate to better-positioned infrastructure
          if they choose to.
        </p>
        <div className="mt-7 rounded-lg border border-ring bg-bg-muted/40 p-6">
          <h3 className="font-display text-base font-semibold text-ink">
            Operators — check where you stand
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted text-pretty">
            Look up your validator on the public GDI index to see your current
            composite rarity, network rank, and which dimensions (country,
            city, ASN) are dragging your score up or down. If you&apos;re in a
            saturated bucket and want a path back into the active delegation
            set, the index shows you which dimensions to change.
          </p>
          <TrackedLink
            href="https://gdindex.app/validator"
            event="outbound_gdindex_validator"
            external
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sunrise-600 hover:text-sunrise-500"
          >
            Open the GDI validator lookup <ExternalLink className="h-4 w-4" />
          </TrackedLink>
        </div>
      </div>

      <div className="mt-14 max-w-3xl">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-ink-dim">
          Continuous monitoring after admission
        </h2>
        <p className="mt-5 text-base text-ink-muted text-pretty">
          Approved validators stay in the active delegation set as long as they remain within
          the hard thresholds above. A separate compliance scan re-checks each validator on a
          regular cadence — commission, MEV commission, SFDP standing, delinquency, and
          Stakewiz curator flags. If a validator drifts out of compliance (e.g., raises
          commission above 5%, gets flagged for sandwiching), it is removed from the active
          delegation set with an alert to the operator.
        </p>
        <p className="mt-4 text-base text-ink-muted text-pretty">
          Substance scoring (contributions, originality) is <strong className="text-ink">not</strong>{' '}
          re-evaluated after admission — only operational compliance. A validator admitted on
          a modest substance score is not at risk of removal as long as it stays within the
          published thresholds. Stake allocation, however, is recomputed every epoch from the
          live GDI index, so a validator that becomes more (or less) decentralised over time
          gets more (or less) stake on autopilot.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        <div className="surface p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold text-ink">
            See the live delegation set
          </h2>
          <p className="mt-3 text-sm text-ink-muted text-pretty">
            The list of currently-delegated validators is recorded on-chain in the pool account
            itself. The most accurate, up-to-the-epoch view is in Solscan.
          </p>
          <TrackedLink
            href={LINKS.solscanPool}
            event="outbound_solscan"
            external
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sunrise-600 hover:text-sunrise-500"
          >
            View pool on Solscan <ExternalLink className="h-4 w-4" />
          </TrackedLink>
        </div>

        <div className="surface p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold text-ink">
            Run a validator? Apply to be whitelisted
          </h2>
          <p className="mt-3 text-sm text-ink-muted text-pretty">
            If you operate a Solana validator and meet the criteria above, you can submit
            your details for review. Approved validators become eligible to receive stake
            from the pool.
          </p>
          <TrackedLink
            href="/whitelist-apply"
            event="cta_whitelist_apply"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sunrise-600 hover:text-sunrise-500"
          >
            Apply for whitelisting <ExternalLink className="h-4 w-4" />
          </TrackedLink>
        </div>
      </div>
    </div>
  );
}
