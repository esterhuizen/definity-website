import type { Metadata } from 'next';
import { LINKS } from '@/config/pool';
import { getGdiStanding, GDI_URLS } from '@/lib/gdi';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Direct staking',
  description:
    'Direct staking on Definity — route your stake to the validators you choose, amplified, and loop it for leverage, while the pool’s decentralisation mandate stays intact. Coming soon. Different from liquid staking, where you mint definSOL.',
};

const STEPS = [
  {
    t: 'Choose your validators',
    d: 'Pick the validators you want your stake to back — your own nodes, or operators you trust. They clear Definity’s existing eligibility bar first.',
  },
  {
    t: 'Definity directs the stake',
    d: 'Definity routes pool stake onto your chosen validators as a ring-fenced carve-out — amplifying your deposit — with no separate token to manage. One pool, one balance sheet.',
  },
  {
    t: 'Loop for leverage',
    d: 'Once a definSOL leverage market is live, loop the position to amplify further — deposit, borrow SOL, re-stake — routed to the best available rate.',
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
    d: 'Your validators pass the exact commission, MEV, skip-rate and SFDP gates every other validator in the pool clears — re-checked every epoch.',
  },
];

export default async function DirectStakingPage() {
  const g = await getGdiStanding();
  const rank = g ? g.rank : 2;
  const total = g ? g.total : 23;
  const gdiHref = g ? GDI_URLS.pool : GDI_URLS.index;

  return (
    <>
      {/* hero */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter">Coming soon</div>
          <div className="ihero">
            <div>
              <h1>Stake direct to<br />your <em>validators.</em></h1>
              <p className="lede">
                A second way to stake with Definity: route your stake to the validators <b>you</b> choose,
                amplified <b>up to 3.5×</b> by matching, and loop it for leverage — while the pool’s
                decentralisation mandate stays intact. Different from <a href="/stake">liquid staking</a>,
                where you mint definSOL and keep your liquidity.
              </p>
              <div className="cta">
                <a className="btn btn-solid" href={LINKS.telegram} target="_blank" rel="noreferrer">Talk to us about early access →</a>
                <a className="btn btn-ghost" href="/stake">Liquid staking instead</a>
              </div>
            </div>

            <div className="panel">
              <div className="phead"><span className="l"><span className="live" /> Direct staking</span><span>in development</span></div>
              <div className="prow">
                <div className="k">Status</div>
                <div className="big"><div className="v" style={{ color: 'var(--teal)' }}>Soon</div></div>
              </div>
              <div className="twocol">
                <div><div className="k">Your validators</div><div className="v">You choose</div><div className="sub">vetted set</div></div>
                <div><div className="k">Stake matching</div><div className="v" style={{ color: 'var(--teal)' }}>Up to 3.5×</div><div className="sub">match +50% · then SFDP</div></div>
              </div>
              <a className="soon" href={gdiHref} target="_blank" rel="noreferrer">
                <span>Decentralisation-guarded</span><span><b>See the GDI →</b></span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* matching */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; Matching</div>
          <div className="sec-head">
            <h1 className="sec-h">Up to <em>3.5×</em> the stake.</h1>
            <p className="sec-lede">Direct staking amplifies what you delegate. Definity matches your delegation and adds 50% on top; then validators in the Solana Foundation Delegation Program are matched again by the Foundation. Altogether your validators can receive roughly 3.5× your delegation — and more.</p>
          </div>
          <div className="creds">
            <div className="cred"><div className="ck">1 · Your delegation</div><div className="cv">1×</div><div className="cd">Stake direct to the validators you choose — including leveraged delegations, once looping is live.</div></div>
            <div className="cred"><div className="ck">2 · Definity matches + 50%</div><div className="cv">→ 2.5×</div><div className="cd">Definity directs additional pool stake equal to your delegation, plus another 50% on top — subject to pool liquidity and capped at 20,000 SOL per validator.</div></div>
            <div className="cred"><div className="ck">3 · SFDP matches</div><div className="cv">→ 3.5×</div><div className="cd">If your validator is in the Solana Foundation Delegation Program, the Foundation matches more again, on top — taking the total to roughly 3.5×, and beyond.</div></div>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; How it will work</div>
          <div className="sec-head">
            <h1 className="sec-h">Your validators, <em>amplified.</em></h1>
            <p className="sec-lede">Direct staking points pool stake at the validators you pick, as a ring-fenced carve-out — then loops it for leverage. The value to you is stake on your nodes; the value to the network is decentralisation that holds.</p>
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
            <p className="sec-lede">Choosing your own validators usually means concentration. Definity’s direct staking is hard-capped and measured against the open decentralisation index, so it can amplify your stake without gutting the mandate that earns the pool its #{rank} ranking.</p>
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

      {/* CTA */}
      <section className="ctablock">
        <div className="wrap">
          <div className="chapter" style={{ justifyContent: 'center' }}>Direct staking · coming soon</div>
          <h2 style={{ marginTop: '18px' }}>Want in <em>early?</em></h2>
          <p>Operators and partners who want their stake directed to specific validators — talk to us, and we’ll bring you in when it goes live.</p>
          <div className="cta" style={{ justifyContent: 'center' }}>
            <a className="btn btn-solid" href={LINKS.telegram} target="_blank" rel="noreferrer">Talk to us →</a>
            <a className="btn btn-ghost" href="/stake">Stake liquid today</a>
          </div>
        </div>
      </section>
    </>
  );
}
