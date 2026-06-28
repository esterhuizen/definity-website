import type { Metadata } from 'next';
import { LINKS } from '@/config/pool';
import { getGdiStanding, GDI_URLS } from '@/lib/gdi';
import { StakeProviders } from '@/components/stake/StakeProviders';
import { DirectStakeWidget } from '@/components/direct/DirectStakeWidget';
import { MyDirectStakeBalance } from '@/components/direct/MyDirectStakeBalance';
import { FAQAccordion, DIRECT_STAKING_FAQ } from '@/components/FAQAccordion';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Direct staking',
  description:
    'Direct staking on Definity — route your stake to the validators you choose, amplified by matching, while the pool’s decentralisation mandate stays intact. Different from liquid staking, where you mint definSOL.',
};

const STEPS = [
  {
    t: 'Choose your validator',
    d: 'Pick the validator you want your stake to back — your own node, or an operator you trust. It clears Definity’s eligibility bar first, re-checked every epoch.',
  },
  {
    t: 'Definity directs the stake',
    d: 'Your deposit mints definSOL, tagged for that validator; Definity then routes pool stake onto it as a ring-fenced carve-out — amplifying your deposit — with no separate token to manage. One pool, one balance sheet.',
  },
  {
    t: 'Loop for leverage — soon',
    d: 'A definSOL leverage market is on the way: loop the position to amplify further — deposit, borrow SOL, re-stake — routed to the best available rate.',
  },
];

const GUARDS = [
  {
    k: 'Hard-capped',
    v: 'Ring-fenced',
    d: 'Directed stake is a bounded carve-out of the pool — capped and ring-fenced, the only stake allowed to deviate from the rarity formula. Everything else stays decentralisation-allocated.',
  },
  {
    k: 'GDI-guarded',
    v: 'Mandate intact',
    d: 'Every directed allocation is measured against the open Geographic Decentralisation Index. The program can never quietly degrade the pool’s decentralisation.',
  },
  {
    k: 'Same eligibility',
    v: 'No shortcuts',
    d: 'Your validator passes the exact commission, MEV, skip-rate and SFDP gates every other validator in the pool clears — re-checked every epoch.',
  },
];

export default async function DirectStakingPage() {
  const g = await getGdiStanding();
  const rank = g ? g.rank : 2;
  const total = g ? g.total : 23;
  const gdiHref = g ? GDI_URLS.pool : GDI_URLS.index;

  return (
    <>
      {/* direct-stake widget — the landing */}
      <section className="sec" id="direct-stake">
        <div className="wrap">
          <div className="chapter" style={{ justifyContent: 'center' }}>Direct stake</div>
          <header style={{ textAlign: 'center', maxWidth: '620px', margin: '18px auto 0' }}>
            <h1 className="sec-h" style={{ margin: '0 auto', maxWidth: 'none' }}>Pick a validator. <em>Stake.</em></h1>
            <p className="sec-lede" style={{ margin: '18px auto 0' }}>
              Search the pool’s vetted set and choose an amount; your wallet deposits SOL and receives definSOL
              in one transaction, tagged for that validator. Definity then directs up to 3.5× your deposit as pool
              stake onto it on the next optimiser cycle.
            </p>
            <p style={{ margin: '14px auto 0' }}>
              <a className="morelink" href="#faq">New to direct staking? Read the FAQ →</a>
            </p>
          </header>
          <div className="stakeui" style={{ marginTop: '40px' }}>
            <StakeProviders>
              <DirectStakeWidget />
              <MyDirectStakeBalance />
            </StakeProviders>
          </div>
        </div>
      </section>

      {/* matching */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; Matching</div>
          <div className="sec-head">
            <h1 className="sec-h">Up to <em>3.5×</em> the stake.</h1>
            <p className="sec-lede">Direct staking amplifies what you delegate. Definity directs pool stake worth up to 3.5× your deposit onto your validator. If your validator is in the Solana Foundation Delegation Program, the Foundation matches again on top — taking it beyond 3.5×.</p>
          </div>
          <div className="creds">
            <div className="cred"><div className="ck">1 · Your direct stake</div><div className="cv">1×</div><div className="cd">Deposit SOL and receive definSOL, tagged for the validator you choose — including leveraged delegations, once looping is live.</div></div>
            <div className="cred"><div className="ck">2 · Definity matches</div><div className="cv">→ up to 3.5×</div><div className="cd">Definity directs pool stake worth up to 3.5× your deposit onto your validator — subject to pool liquidity and capped at 20,000 SOL per validator.</div></div>
            <div className="cred"><div className="ck">3 · SFDP matches</div><div className="cv">+ more</div><div className="cd">If your validator is in the Solana Foundation Delegation Program, the Foundation matches again on top — taking your validator beyond 3.5×.</div></div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; How it works</div>
          <div className="sec-head">
            <h1 className="sec-h">Your validators, <em>amplified.</em></h1>
            <p className="sec-lede">Direct staking points pool stake at the validators you pick, as a ring-fenced carve-out. The value to you is stake on your nodes; the value to the network is decentralisation that holds.</p>
          </div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div className="step" key={s.t}>
                <div className="si">{String(i + 1).padStart(2, '0')}</div>
                <div className="st">{s.t}</div>
                <div className="sd">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* guardrail */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">03</span>&nbsp; Guarded by the GDI</div>
          <div className="sec-head">
            <h1 className="sec-h">Directed, <em>never concentrated.</em></h1>
            <p className="sec-lede">Choosing your own validators usually means concentration. Definity’s direct staking is hard-capped and measured against the open decentralisation index, so it amplifies your stake without gutting the mandate that earns the pool its #{rank} ranking.</p>
          </div>
          <div className="creds">
            {GUARDS.map((c) => (
              <div className="cred" key={c.k}>
                <div className="ck">{c.k}</div>
                <div className="cv">{c.v}</div>
                <div className="cd">{c.d}</div>
              </div>
            ))}
          </div>
          <a className="morelink" href={gdiHref} target="_blank" rel="noreferrer">See Definity’s live decentralisation score — #{rank} of {total} →</a>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec" id="faq">
        <div className="wrap">
          <div className="chapter"><span className="n">04</span>&nbsp; FAQ</div>
          <div className="sec-head">
            <h1 className="sec-h">Direct staking, <em>explained.</em></h1>
          </div>
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <FAQAccordion items={DIRECT_STAKING_FAQ} />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="ctablock">
        <div className="wrap">
          <div className="chapter" style={{ justifyContent: 'center' }}>Direct staking</div>
          <h2 style={{ marginTop: '18px' }}>Direct your <em>stake.</em></h2>
          <p>Stake to the validators you choose, amplified by matching. Operators and partners who want a dedicated allocation — talk to us about partner matching.</p>
          <div className="cta" style={{ justifyContent: 'center' }}>
            <a className="btn btn-solid" href="#direct-stake">Direct-stake now →</a>
            <a className="btn btn-ghost" href={LINKS.telegram} target="_blank" rel="noreferrer">Talk to us about partners</a>
          </div>
        </div>
      </section>
    </>
  );
}
