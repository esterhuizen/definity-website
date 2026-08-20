import type { Metadata } from 'next';
import { LINKS } from '@/config/pool';
import { TrackedLink } from '@/components/TrackedLink';

export const metadata: Metadata = {
  title: 'Validators',
  description:
    'How Definity selects, monitors and rebalances the validators that secure your stake.',
};

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
    body: 'Vote account must be live on Solana mainnet and not persistently delinquent: no more than 4 hours offline in any 7-day window.',
  },
  {
    title: 'Strong voting performance',
    body: 'Skip rate must remain below 10% across recent epochs (Stakewiz skip_rate) — stricter than SFDP’s network-average + 5pp rule, because Definity is a curated pool, not a delegation program. A persistent pattern of missed leader slots is degraded operational health even if the validator never goes fully offline.',
  },
  {
    title: 'SFDP standing intact',
    body: 'Must not have been removed from the Solana Foundation Delegation Program for cause.',
  },
  {
    title: 'Jito MEV enabled',
    body: 'The validator must run the Jito-Solana client and participate in the Jito MEV auction, so MEV rewards accrue to the pool and its stakers instead of being left on the table.',
  },
];

const MISSION = [
  {
    title: 'Team based in one of the focus regions',
    body: 'Where the people doing the work are physically located. Definity’s focus regions are APAC (East/Southeast/South Asia and Oceania), the Middle East (GCC + Turkey + Israel), Africa, and South America. This is operator location, not corporate domicile (FZCO / BVI / Cayman are common for tax; they don’t affect this filter) and not hosting location. A Lagos-based team running their node anywhere on the planet passes; a US-based team running their node in Tokyo does not.',
  },
];

const PREFERRED = {
  title: 'Verifiable, measurable contributions',
  body: 'Above the eligibility bar, validator teams with visible, measurable work growing the Solana ecosystem in their region get preference. Shipped products, dev tooling, hackathons run, education or community work, audited contributions. Real outputs with public evidence, not stated intentions.',
};

export default function ValidatorsPage() {
  return (
    <>
      {/* hero */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter">Validators</div>
          <div className="sec-head">
            <h1 className="sec-h">How we choose where your <em>stake goes.</em></h1>
            <p className="sec-lede">Definity delegates across a curated set of validators, rebalanced each epoch so the allocation stays current. Here’s exactly what we filter for.</p>
          </div>
        </div>
      </section>

      {/* selection criteria */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; Selection criteria</div>
          <p className="sec-lede" style={{ marginTop: '16px' }}>Operational gates with concrete numbers — each read from a public on-chain or public-API source. Every rejection cites the specific rule violated, so you can verify it yourself.</p>

          <div className="sublabel">Hard thresholds</div>
          <div className="steps two">
            {HARD_THRESHOLDS.map((c, i) => (
              <div className="step" key={c.title}>
                <div className="si">0{i + 1}</div>
                <div className="st">{c.title}</div>
                <div className="sd">{c.body}</div>
              </div>
            ))}
          </div>

          <div className="sublabel">Mission alignment</div>
          <p className="muted-note">About <em>who</em> runs the validator, not where the box runs — hosting location is not an admission gate; it only sets how much stake an admitted validator receives (see allocation, below).</p>
          <div className="steps one">
            {MISSION.map((c, i) => (
              <div className="step" key={c.title}>
                <div className="si">0{HARD_THRESHOLDS.length + i + 1}</div>
                <div className="st">{c.title}</div>
                <div className="sd">{c.body}</div>
              </div>
            ))}
          </div>

          <div className="sublabel">What earns preference</div>
          <div className="steps one">
            <div className="step accent">
              <div className="si">0{HARD_THRESHOLDS.length + MISSION.length + 1}</div>
              <div className="st">{PREFERRED.title}</div>
              <div className="sd">{PREFERRED.body}</div>
            </div>
          </div>
        </div>
      </section>

      {/* allocation */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; How we allocate stake</div>
          <div className="sec-head">
            <h1 className="sec-h">Rarity-weighted, <em>every epoch.</em></h1>
          </div>
          <div className="prose">
            <p>
              Admitted validators all receive some stake, but <strong>how much</strong> depends on
              where they run. Each epoch, pool stake is distributed across the admitted set in
              proportion to each validator’s composite rarity on country, city, and ASN — measured
              live against the{' '}
              <TrackedLink href="https://gdindex.app/" event="outbound_gdindex" external>GDI methodology</TrackedLink>.
              A validator whose country and ASN are both underweight in the network earns the
              largest delegation. One whose location duplicates an already-saturated bucket receives
              the minimum but is still admitted.
            </p>
            <p>
              This replaces a previous flat stake-per-validator approach. Under the rarity-weighted
              strategy, an operator running a node in an underweight city / ASN (Manila, Jakarta,
              Lagos, São Paulo, a Bangalore datacenter not shared upstream with a dozen other
              validators) receives meaningfully more stake than a seventh validator in Frankfurt on
              Hetzner or Tokyo on Allnodes.
            </p>
            <p>
              Rebalancing happens gradually each epoch. No operator loses more than a small fraction
              of their delegation in any single epoch, giving teams time to migrate to
              better-positioned infrastructure if they choose to.
            </p>
          </div>
          <div className="note-box">
            <h3>Operators: check where you stand</h3>
            <p>
              Look up your validator in the Definity pool — how much stake you currently hold
              (directed and curve), your G score, and the curve target the optimiser is steering
              toward. The exact numbers the optimiser uses, recomputed live every 15 minutes.
            </p>
            <TrackedLink className="morelink" href="/validators/lookup" event="cta_validator_lookup">
              Look up your pool position →
            </TrackedLink>
            <p style={{ marginTop: '14px' }}>
              For your network-wide composite rarity, rank, and which dimensions (country, city, ASN)
              to change, the public{' '}
              <TrackedLink href="https://gdindex.app/" event="outbound_gdindex" external>GDI index</TrackedLink>{' '}
              has the full breakdown:
            </p>
            <TrackedLink className="morelink" href="https://gdindex.app/validator" event="outbound_gdindex_validator" external>
              Open the GDI validator lookup →
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* monitoring */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">03</span>&nbsp; After admission</div>
          <div className="sec-head">
            <h1 className="sec-h">Monitored <em>continuously.</em></h1>
          </div>
          <div className="prose">
            <p>
              Approved validators stay in the active delegation set as long as they remain within the
              hard thresholds above. A separate compliance scan re-checks each validator on a regular
              cadence: commission, MEV commission, SFDP standing, delinquency, and Stakewiz curator
              flags. If a validator drifts out of compliance (raises commission above 5%, gets
              flagged for sandwiching), it is removed from the active set with an alert to the operator.
            </p>
            <p>
              Substance scoring (contributions, originality) is <strong>not</strong> re-evaluated
              after admission — only operational compliance. A validator admitted on a modest substance
              score is not at risk of removal as long as it stays within the published thresholds.
              Stake allocation, however, is recomputed every epoch from the live{' '}
              <TrackedLink href="https://gdindex.app/" event="outbound_gdindex" external>GDI index</TrackedLink>,
              so a validator that becomes more (or less) decentralised over time gets more (or less)
              stake on autopilot.
            </p>
          </div>
        </div>
      </section>

      {/* CTA cards */}
      <section className="sec">
        <div className="wrap">
          <div className="cols2">
            <div className="note-box">
              <h3>See the live delegation set</h3>
              <p>The currently-delegated validators are recorded on-chain in the pool account itself. The most accurate, up-to-the-epoch view is on Solscan.</p>
              <TrackedLink className="morelink" href={LINKS.solscanPool} event="outbound_solscan" external>
                View pool on Solscan →
              </TrackedLink>
            </div>
            <div className="note-box">
              <h3>Run a validator? Apply to be whitelisted</h3>
              <p>If you operate a Solana validator and meet the criteria above, submit your details for review. Approved validators become eligible to receive stake from the pool.</p>
              <TrackedLink className="morelink" href="/whitelist-apply" event="cta_whitelist_apply">
                Apply for whitelisting →
              </TrackedLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
