import type { Metadata } from 'next';
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
  'Actively voting on Solana mainnet: vote account live, not persistently delinquent (no more than 4 hours offline in any 7-day window).',
  'Strong voting performance: Stakewiz skip_rate below 10% across recent epochs. Stricter than SFDP’s network-average + 5pp rule. A persistent pattern of missed leader slots is degraded operational health, even if the validator never goes fully offline.',
  'SFDP standing intact: not removed from the Solana Foundation Delegation Program for cause.',
];

const MISSION = [
  'Team based in one of Definity’s focus regions: APAC, the Middle East, Africa, or South America. APAC covers East Asia (Japan, Korea, Taiwan, Hong Kong), Southeast Asia (Singapore, Indonesia, Philippines, Thailand, Vietnam, Malaysia, …), South Asia (India, Bangladesh, Pakistan, Sri Lanka, Nepal) and Oceania (Australia, New Zealand). The Middle East includes the GCC + Turkey + Israel. Africa covers the continent. South America covers Brazil, Argentina, Chile, Colombia, Peru, and the rest. This is operator location — not corporate domicile and not hosting location.',
];

const PREFERRED = [
  'Verifiable, measurable contributions to the Solana ecosystem in your region. Shipped products, dev tooling, hackathons run, education or community work, audited contributions. Real outputs with public evidence, not stated intentions.',
];

export default function WhitelistApplyPage() {
  return (
    <>
      {/* hero */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter">Validators · whitelisting</div>
          <div className="sec-head">
            <h1 className="sec-h">Apply for <em>whitelisting.</em></h1>
            <p className="sec-lede">
              Run a validator and meet the criteria below? Submit your details and we’ll get back
              to you. Admission is gated by the hard thresholds + team-location requirement; after
              admission, your delegation size is set each epoch by your composite rarity under the{' '}
              <a href="https://gdindex.app/validator" target="_blank" rel="noopener noreferrer">GDI methodology</a> —
              operators in underrepresented countries, cities and ASNs receive larger delegations,
              but everyone admitted gets some stake.
            </p>
          </div>
        </div>
      </section>

      {/* eligibility */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; Eligibility</div>

          <div className="sublabel">Hard thresholds</div>
          <p className="muted-note">Operational gates with concrete numbers — each verified against on-chain or public-API data; every rejection cites the specific rule.</p>
          <ol className="crit">
            {HARD_THRESHOLDS.map((c, i) => (
              <li key={i}><span className="num">{i + 1}</span><p>{c}</p></li>
            ))}
          </ol>

          <div className="sublabel">Mission alignment</div>
          <p className="muted-note">About where the people doing the work are based — operator location, not where the box runs.</p>
          <ol className="crit">
            {MISSION.map((c, i) => (
              <li key={i}><span className="num">{HARD_THRESHOLDS.length + i + 1}</span><p>{c}</p></li>
            ))}
          </ol>

          <div className="sublabel">What earns preference</div>
          <p className="muted-note">Beyond the eligibility bar, this is what moves an application up the queue.</p>
          <ol className="crit">
            {PREFERRED.map((c, i) => (
              <li className="accent" key={i}><span className="num">{HARD_THRESHOLDS.length + MISSION.length + i + 1}</span><p>{c}</p></li>
            ))}
          </ol>
        </div>
      </section>

      {/* submit */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; Submit your application</div>
          <div className="sec-head">
            <h1 className="sec-h">Tell us about <em>your validator.</em></h1>
            <p className="sec-lede">Have your validator’s vote id, country, and an email / Telegram / X contact ready before you start.</p>
          </div>

          <div style={{ marginTop: '32px' }}>
            <WhitelistForm />
          </div>

          <div className="wl-foot">
            <span>Your information is kept private and confidential.</span>
            <a href={LINKS.telegram} target="_blank" rel="noopener noreferrer">
              Questions? DM {LINKS.telegramHandle} on Telegram →
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
