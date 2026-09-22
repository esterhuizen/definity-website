import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LINKS } from '@/config/pool';
import { RevShareCalculator } from '@/components/RevShareCalculator';

// Public revenue-share page. The audience is a staker who already direct-stakes and has
// filled their validator's 20,000 SOL directed cap: the next SOL they allocate cannot be
// directed anywhere useful, so this page prices the alternative in their own numbers.
//
// Every figure on the page comes from /api/revenue-share (shared economics with
// /ops/fee-projection). Static copy deliberately quotes NO live number — yields, prices and
// epoch length all move, and a hardcoded "+0.14pp" in prose would be wrong within a month.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Revenue share',
  description:
    'Directed stake is capped at 20,000 SOL per validator. Past the cap, Definity pays you half of the fee it earns on your stake — settled in definSOL, accruing every epoch. Price it for your own size.',
};

const STEPS = [
  {
    t: 'Your validator fills up',
    d: 'Directed stake on any single validator is capped at 20,000 SOL, matching included. Once that is full, more stake aimed at the same validator has nowhere to go — the cap is what keeps the directed sleeve from swallowing the pool.',
  },
  {
    t: 'The overflow stakes normally',
    d: 'Stake it with Definity as ordinary definSOL. It earns the pool’s yield across the vetted validator set and counts toward the decentralisation mandate the pool is managed against, rather than sitting on a single node.',
  },
  {
    t: 'We split our fee with you',
    d: 'Definity earns a fee on the rewards that stake generates. Half of our share comes back to you, settled in definSOL and accruing every epoch for as long as you hold the position.',
  },
];

const TERMS = [
  {
    k: 'Your share',
    v: 'Half our fee',
    d: 'Definity keeps 5% of the gross staking rewards your stake generates; half of that is yours. It is a share of rewards, not a headline rate — the panel above shows exactly what it adds to your yield at today’s numbers, and exactly what fraction of the pool fee that hands back.',
  },
  {
    k: 'Paid in',
    v: 'definSOL',
    d: 'Settled in definSOL, accruing every epoch alongside the staking yield already compounding into the definSOL rate. Nothing to claim, no second token to hold, no new account to open.',
  },
  {
    k: 'Your position',
    v: 'Unchanged',
    d: 'Non-custodial throughout. definSOL is a standard SPL token in your own custody or multisig — the stake-pool program cannot move it and neither can we. Redeem whenever you want; the share simply stops accruing.',
  },
  {
    k: 'Checkable',
    v: 'On-chain',
    d: 'The pool’s yield, its fee, and the full definSOL rate history are public Solana state, and every payment is an on-chain transfer. You can recompute what you are owed from primary sources instead of taking our word for the arithmetic.',
  },
];

const FIT: { t: string; d: ReactNode }[] = [
  {
    t: 'Under the cap — direct it',
    d: (
      <>
        Stake aimed at a validator with room left is the better deal: your stake is directed onto it and Definity adds
        up to 3.5× matching on top, up to 4.5× in total. Fill the cap first, always.{' '}
        <a href="/direct-staking">See directed staking and matching →</a>
      </>
    ),
  },
  {
    t: 'Over the cap — share the revenue',
    d: (
      <>
        Past 20,000 SOL there is no matching left to earn on that validator, so the question becomes what the stake
        earns you rather than where it points. Revenue share is the answer to that question, and the two arrangements
        run side by side on the same position.
      </>
    ),
  },
];

const FAQ = [
  {
    q: 'Is this 2.5% APY on top of the pool rate?',
    a: 'No, and the difference is large. It is 2.5% of the staking rewards your stake earns, not 2.5% added to the yield. Rewards are a few percent of the stake, so a share of them is a fraction of a percentage point on your yield. The panel at the top of this page shows the exact uplift at today’s numbers, before and after, so there is nothing to work out from the wording.',
  },
  {
    q: 'Do I have to give up direct staking to get it?',
    a: 'No. Fill your validator’s directed cap first — matching at up to 4.5× beats a revenue share on the same SOL, every time. Revenue share is for the stake that has nowhere left to be directed. Most counterparties end up running both on the same position.',
  },
  {
    q: 'What happens if the pool yield or the SOL price changes?',
    a: 'The share is a fraction of whatever rewards your stake actually earns, so it moves with the yield rather than being fixed in advance. Every number on this page is live: the pool’s yield and definSOL rate come from the pool itself, the epoch length is measured from current slot times, and the SOL price is a market quote. Reload it and it reprices.',
  },
  {
    q: 'Is the stake locked up?',
    a: 'definSOL never locks. The liquid route out settles in seconds through a swap; a direct pool withdrawal settles at the next epoch boundary at the exact pool rate. Specific terms for a revenue-share arrangement — size, horizon, reporting — are what the conversation is about.',
  },
  {
    q: 'How do I start?',
    a: 'Talk to us. Revenue share is an agreement between two parties rather than a button in a widget, so we need to know what you are allocating and over what horizon. Bring the number you priced above and we will confirm it against the live pool before anything is signed.',
  },
];

export default function RevenueSharePage() {
  return (
    <>
      {/* hero + live calculator */}
      <section className="sec">
        <div className="wrap">
          <RevShareCalculator />
        </div>
      </section>

      {/* how it works */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter">
            <span className="n">01</span>&nbsp; How it works
          </div>
          <div className="sec-head">
            <h1 className="sec-h">
              Three steps, <em>no new plumbing.</em>
            </h1>
            <p className="sec-lede">
              Nothing about your position changes. You stake with Definity the way anyone else does, and the revenue
              share is applied to the stake that sits above your directed cap.
            </p>
          </div>
          <div className="steps">
            {STEPS.map((s, idx) => (
              <div className="step" key={s.t}>
                <div className="si">{String(idx + 1).padStart(2, '0')}</div>
                <div className="st">{s.t}</div>
                <div className="sd">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* the terms */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter">
            <span className="n">02</span>&nbsp; The terms
          </div>
          <div className="sec-head">
            <h1 className="sec-h">
              Plainly, <em>what you get.</em>
            </h1>
            <p className="sec-lede">
              The share, how it reaches you, and what it does not change about your custody or your exit.
            </p>
          </div>
          <div className="creds">
            {TERMS.map((t) => (
              <div className="cred" key={t.k}>
                <div className="ck">{t.k}</div>
                <div className="cv">{t.v}</div>
                <div className="cd">{t.d}</div>
              </div>
            ))}
          </div>
          <div className="note-box">
            <h3>Why we are giving up half the fee</h3>
            <p>
              Because size is worth more to us than the margin on it. A larger pool costs less to run per SOL, lifts the
              decentralisation score the pool is managed against, and deepens the exit liquidity every holder relies on.
              We would rather hold a smaller share of a much larger pool — and we would rather say so than have you work
              out the motive yourself.
            </p>
          </div>
        </div>
      </section>

      {/* how it fits with directed staking */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter">
            <span className="n">03</span>&nbsp; With directed staking
          </div>
          <div className="sec-head">
            <h1 className="sec-h">
              Matching first. <em>Then this.</em>
            </h1>
            <p className="sec-lede">
              Revenue share is not a replacement for directed staking and we will tell you so. Up to the cap, matching
              is worth more on the same SOL. This is for what comes after.
            </p>
          </div>
          <div className="steps two">
            {FIT.map((c, idx) => (
              <div className={`step${idx === 1 ? ' accent' : ''}`} key={c.t}>
                <div className="si">{idx === 0 ? '1×' : '2×'}</div>
                <div className="st">{c.t}</div>
                <div className="sd">{c.d}</div>
              </div>
            ))}
          </div>
          <a className="morelink" href="/institutions">
            Allocating at institutional size? See the treasury view →
          </a>
        </div>
      </section>

      {/* FAQ */}
      <section className="sec" id="faq">
        <div className="wrap">
          <div className="chapter">
            <span className="n">04</span>&nbsp; FAQ
          </div>
          <div className="sec-head">
            <h1 className="sec-h">
              The questions <em>we get asked.</em>
            </h1>
          </div>
          {/* The dark `.faq` markup from /faq, not <FAQAccordion/>: that component is
              styled with Tailwind light tokens which only get remapped to the dark
              palette inside a .stakeui wrapper, so it renders as a white panel here. */}
          <div className="faq" style={{ maxWidth: '760px', margin: '42px auto 0' }}>
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <span className="pm" aria-hidden>
                    +
                  </span>
                </summary>
                <div className="ans">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="ctablock">
        <div className="wrap">
          <div className="chapter" style={{ justifyContent: 'center' }}>
            Revenue share
          </div>
          <h2 style={{ marginTop: '18px' }}>
            Bring us <em>the number.</em>
          </h2>
          <p>
            Tell us what you are allocating and over what horizon. We will confirm the figure against the live pool,
            walk you through the delegation ledger, and put the terms in writing before anything moves.
          </p>
          <div className="cta" style={{ justifyContent: 'center' }}>
            <a className="btn btn-solid" href={LINKS.telegram} target="_blank" rel="noreferrer">
              Talk to our team →
            </a>
            <a className="btn btn-ghost" href="/direct-staking">
              Fill your cap first →
            </a>
            <a className="btn btn-ghost" href="/addresses">
              Verify on-chain
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
