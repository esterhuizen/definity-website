import type { Metadata } from 'next';
import { POOL, LINKS } from '@/config/pool';
import { getGdiStanding, GDI_URLS } from '@/lib/gdi';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Institutions',
  description:
    'definSOL for DAOs, digital-asset treasuries and funds: non-custodial staked SOL that fits your custody stack, simplifies rewards accounting, and comes with an auditable delegation ledger and independently-verifiable decentralisation.',
};

const CRITERIA = [
  {
    k: 'Counterparty risk',
    v: 'None added',
    d: 'definSOL is non-custodial by construction — the audited Sanctum stake-pool program cannot move your funds, and Solana enforces that on-chain. Staking with Definity adds zero custodial counterparties to your risk register.',
  },
  {
    k: 'Custody fit',
    v: 'Your stack',
    d: 'definSOL is a standard SPL token. It sits in the custody setup you already run — BitGo, Fireblocks, Anchorage-class platforms or a Squads multisig — with your existing policies, approvals and signers. No new accounts, no new agreements.',
  },
  {
    k: 'Rewards accounting',
    v: 'One line',
    d: 'Rewards accrue in the redemption rate, not as thousands of per-epoch payment events. Your books carry one position — quantity × on-chain rate — with the full rate history publicly reconstructable for NAV marks and audit.',
  },
  {
    k: 'Slashing & lockups',
    v: 'No / No',
    d: 'Solana does not currently implement slashing, so there is no slashing loss to insure against. definSOL itself never locks: the liquid path exits in seconds, the pool path at the next epoch boundary.',
  },
];

const PERSONAS = [
  {
    t: 'Digital-asset treasuries',
    d: 'Staking yield is your product. definSOL compounds validator rewards and Jito MEV into the token rate net of a transparent fee, marks cleanly for quarterly reporting, and exits at size through Sanctum’s router or direct pool withdrawal.',
  },
  {
    t: 'DAOs & protocol treasuries',
    d: 'Every claim on this page is checkable from public data — written for a governance forum, not a sales deck. Mint and redeem are permissionless, the token lives in your Squads vault, and your stake demonstrably improves Solana’s decentralisation.',
  },
  {
    t: 'Funds & validator partners',
    d: 'Composable collateral across Solana DeFi, no lockups, and a directed-stake program for institutions with validator relationships — direct your stake and earn matching on top. Fee terms and negotiated validator revenue-sharing at size are a conversation, not a rate card.',
  },
];

const YIELD_AT_SIZE = [
  {
    t: 'No validator relationship required',
    d: 'We negotiate revenue-share agreements with specific validators on your behalf: your stake is directed to them through the direct-stake program, and a share of the commission and MEV revenue it generates flows back to you as yield above the base rate. You bring the allocation — the relationships are ours.',
  },
  {
    t: 'We handle the complexity',
    d: 'Sourcing eligible validators, negotiating terms, directing the stake, verifying every placement landed — end to end, by us. Your side of the arrangement is holding definSOL in your own custody. Nothing else changes about your position.',
  },
  {
    t: 'Same bar, same ledger',
    d: 'Negotiated placements run inside the ring-fenced directed sleeve — only validators that clear the epoch-checked eligibility thresholds, capped per validator, never permitted to degrade the pool’s decentralisation mandate. Every placement is recorded in the delegation ledger like any other move.',
  },
];

const THRESHOLDS = [
  { k: 'Validator commission', v: '≤ 5%', d: 'On-chain commission from Solana RPC cannot exceed 5%. Above it, the validator is rejected from the set.' },
  { k: 'MEV commission', v: '≤ 10%', d: 'Jito MEV commission capped at 1000 bps, so MEV rewards flow to stakers, not operators.' },
  { k: 'Skip rate', v: '< 10%', d: 'Actively voting on mainnet, never persistently delinquent, skip rate held below 10% — stricter than the Foundation Delegation Program baseline.' },
  { k: 'SFDP standing', v: 'Intact', d: 'Must not have been removed from the Solana Foundation Delegation Program for cause.' },
];

const AUDIT = [
  {
    t: 'A delegation ledger, not assurances',
    d: 'Every stake movement the pool makes is recorded in an append-only ledger — epoch, amount, the reason (rebalancing, validator removal, directed stake), and the transaction signature. Ask why any validator’s allocation changed and the answer is a lookup, not a meeting.',
  },
  {
    t: 'Reproducible decentralisation',
    d: 'The pool is managed against the open Geographic Decentralisation Index — country, city, and network-operator spread scored from public data. The score, the rank, and the methodology are independently recomputable at gdindex.app.',
  },
  {
    t: 'Everything material is on-chain',
    d: 'Pool account, validator list, reserve, fees, and the definSOL rate history are public Solana state. The program is Sanctum’s audited fork of the SPL Stake Pool, securing billions across the ecosystem.',
  },
];

export default async function InstitutionsPage() {
  const g = await getGdiStanding();
  const rank = g ? g.rank : 2;
  const total = g ? g.total : 23;
  const score = g?.gdi != null ? g.gdi.toFixed(2) : '4.42';
  const baseline = g?.baseline != null ? g.baseline.toFixed(2) : '2.73';
  const aboveBaseline = g && g.baseline ? Math.round(((g.gdi - g.baseline) / g.baseline) * 100) : null;
  const gdiHref = g ? GDI_URLS.pool : GDI_URLS.index;
  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;

  return (
    <>
      {/* hero */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter">For institutions</div>
          <div className="ihero">
            <div>
              <h1>Bring the stake.<br />We bring <em>the yield.</em></h1>
              <p className="lede">
                <b>definSOL</b> is non-custodial staked SOL — it fits the custody stack you already run,
                books like a single appreciating position, and adds no counterparty to your risk register.
                At size, we do what a treasury can’t do alone: our revenue-share relationships with
                validators earn you yield above the base rate, handled end-to-end.
                No validator relationship required.
              </p>
              <div className="cta">
                <a className="btn btn-solid" href={LINKS.telegram} target="_blank" rel="noreferrer">Talk to our team →</a>
                <a className="btn btn-ghost" href="/addresses">Verify on-chain</a>
              </div>
            </div>

            <div className="panel gpanel">
              <div className="phead"><span className="l"><span className="live" /> definSOL · GDI</span><span>live · gdindex.app</span></div>
              <div className="prow">
                <div className="k">Decentralisation rank</div>
                <div className="big"><div className="v">#{rank}<span className="pct"> / {total}</span></div></div>
              </div>
              <div className="twocol">
                <div><div className="k">GDI score</div><div className="v">{score}</div><div className="sub">geo · operator · ASN</div></div>
                <div><div className="k">Network baseline</div><div className="v">{baseline}</div><div className="sub">all-pools average</div></div>
              </div>
              <a className="soon" href={gdiHref} target="_blank" rel="noreferrer">
                <span>{aboveBaseline != null ? `${aboveBaseline}% above baseline` : 'Above network baseline'}</span>
                <span><b>Reproduce →</b></span>
              </a>
            </div>
          </div>

          <div className="metrics" style={{ marginTop: '50px' }}>
            <div className="metric"><div className="k">Custody</div><div className="v">Yours</div><div className="s">SPL token in your own stack</div></div>
            <div className="metric"><div className="k">Yield at size</div><div className="v">Base +</div><div className="s">negotiated rev-share on top</div></div>
            <div className="metric"><div className="k">Decentralisation</div><div className="v">#{rank}<small>/{total}</small></div><div className="s">independently verified</div></div>
            <div className="metric"><div className="k">Audit trail</div><div className="v">Ledger</div><div className="s">every move, with its reason</div></div>
          </div>
        </div>
      </section>

      {/* yield at size */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; Yield at size</div>
          <div className="sec-head">
            <h1 className="sec-h">Extra yield, <em>done for you.</em></h1>
            <p className="sec-lede">Base staking yield is table stakes — every pool compounds validator rewards and MEV. What sets an allocation apart at size is what your provider negotiates for you. We maintain the validator relationships so you don’t have to — and we’re open about exactly where the extra yield comes from.</p>
          </div>
          <div className="steps">
            {YIELD_AT_SIZE.map((c, i) => (
              <div className="step" key={c.t}>
                <div className="si">{String(i + 1).padStart(2, '0')}</div>
                <div className="st">{c.t}</div>
                <div className="sd">{c.d}</div>
              </div>
            ))}
          </div>
          <div className="cta">
            <a className="btn btn-solid" href={LINKS.telegram} target="_blank" rel="noreferrer">Enquire about size →</a>
          </div>
        </div>
      </section>

      {/* the checklist */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; The checklist</div>
          <div className="sec-head">
            <h1 className="sec-h">Your due-diligence list, <em>answered.</em></h1>
            <p className="sec-lede">Treasuries evaluate staking on counterparty risk, custody fit, accounting treatment, and exit terms. Here is where definSOL lands on each — and why most of the standard checklist simply doesn’t apply to a non-custodial position.</p>
          </div>
          <div className="creds">
            {CRITERIA.map((t) => (
              <div className="cred" key={t.k}>
                <div className="ck">{t.k}</div>
                <div className="cv">{t.v}</div>
                <div className="cd">{t.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* who it's for */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">03</span>&nbsp; Built for</div>
          <div className="sec-head">
            <h1 className="sec-h">Three kinds of treasury, <em>one position.</em></h1>
          </div>
          <div className="steps">
            {PERSONAS.map((c, i) => (
              <div className="step" key={c.t}>
                <div className="si">{String(i + 1).padStart(2, '0')}</div>
                <div className="st">{c.t}</div>
                <div className="sd">{c.d}</div>
              </div>
            ))}
          </div>
          <a className="morelink" href="/direct-staking">Validator relationship? See directed staking &amp; matching →</a>
        </div>
      </section>

      {/* validator selection */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">04</span>&nbsp; Validator selection</div>
          <div className="sec-head">
            <h1 className="sec-h">Hard thresholds, <em>every epoch.</em></h1>
            <p className="sec-lede">Stake is delegated only to validators that clear an explicit eligibility bar — re-checked after every epoch. Breach a threshold and the validator’s stake is withdrawn, and the withdrawal is recorded in the ledger with its reason.</p>
          </div>
          <div className="creds">
            {THRESHOLDS.map((t) => (
              <div className="cred" key={t.k}>
                <div className="ck">{t.k}</div>
                <div className="cv">{t.v}</div>
                <div className="cd">{t.d}</div>
              </div>
            ))}
          </div>
          <a className="morelink" href="/validators">See the full selection policy &amp; live delegation set →</a>
        </div>
      </section>

      {/* audit & transparency */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">05</span>&nbsp; Audit &amp; transparency</div>
          <div className="sec-head">
            <h1 className="sec-h">Verify, <em>don’t trust.</em></h1>
            <p className="sec-lede">Built for the diligence memo and the governance forum: primary sources for every claim.</p>
          </div>
          <div className="steps">
            {AUDIT.map((c, i) => (
              <div className="step" key={c.t}>
                <div className="si">{String(i + 1).padStart(2, '0')}</div>
                <div className="st">{c.t}</div>
                <div className="sd">{c.d}</div>
              </div>
            ))}
          </div>
          <div className="addrs">
            {[
              { label: 'Definity stake pool', addr: POOL.stakePoolAddress, href: LINKS.solscanPool },
              { label: 'definSOL mint', addr: POOL.lstMint, href: LINKS.solscanMint },
            ].map((r) => (
              <div className="addr" key={r.addr}>
                <div>
                  <div className="al">{r.label}</div>
                  <div className="av">{short(r.addr)}</div>
                </div>
                <a href={r.href} target="_blank" rel="noreferrer">View on Solscan →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="ctablock">
        <div className="wrap">
          <div className="chapter" style={{ justifyContent: 'center' }}>Allocating size?</div>
          <h2 style={{ marginTop: '18px' }}>Let’s talk <em>specifics.</em></h2>
          <p>Delegation-ledger walkthroughs, validator policy, MEV handling, exit-liquidity depth at your size, fee terms, custody-platform questions — bring your diligence list and we’ll answer it line by line.</p>
          <div className="cta" style={{ justifyContent: 'center' }}>
            <a className="btn btn-solid" href={LINKS.telegram} target="_blank" rel="noreferrer">Talk to our team →</a>
            <a className="btn btn-ghost" href={LINKS.twitter} target="_blank" rel="noreferrer">Follow on X</a>
          </div>
        </div>
      </section>
    </>
  );
}
