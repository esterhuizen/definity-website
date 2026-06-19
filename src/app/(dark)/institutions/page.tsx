import type { Metadata } from 'next';
import { POOL, LINKS } from '@/config/pool';
import { getGdiStanding, GDI_URLS } from '@/lib/gdi';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Institutions',
  description:
    'definSOL for institutions: non-custodial liquid staked SOL with independently-verifiable decentralisation. Self-custody, audited Sanctum program, transparent on-chain, GDI-ranked. Talk to our team.',
};

const THRESHOLDS = [
  { k: 'Validator commission', v: '≤ 5%', d: 'On-chain commission from Solana RPC cannot exceed 5%. Above it, the validator is rejected from the set.' },
  { k: 'MEV commission', v: '≤ 10%', d: 'Jito MEV commission capped at 1000 bps, so MEV rewards flow to stakers, not operators.' },
  { k: 'Skip rate', v: '< 10%', d: 'Actively voting on mainnet, never persistently delinquent, skip rate held below 10% — stricter than the Foundation Delegation Program baseline.' },
  { k: 'SFDP standing', v: 'Intact', d: 'Must not have been removed from the Solana Foundation Delegation Program for cause.' },
];

const CUSTODY = [
  { t: 'You hold the keys', d: 'definSOL is self-custodied — you mint and redeem permissionlessly via Jupiter or Sanctum. Definity’s program cannot move user funds; Solana enforces that on-chain. It sits in your own custody stack like any SPL token.' },
  { t: 'Liquid, exit anytime', d: 'Swap definSOL back to SOL in seconds through Sanctum’s router and instant-unstake reserve, or withdraw from the pool directly. No lockups, no epoch wait on the liquid path.' },
  { t: 'Verify, don’t trust', d: 'Pool account, validator list, fees and reserve are all public on-chain, and the decentralisation score is reproducible from public data. The audited program is Sanctum’s, a battle-tested fork of the SPL Stake Pool.' },
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
              <h1>Decentralisation<br />you can <em>verify.</em></h1>
              <p className="lede">
                <b>definSOL</b> is non-custodial liquid staked SOL on Sanctum’s audited stake-pool
                program. Every claim we make — decentralisation, validator quality, reserves — is
                verifiable on-chain or recomputable from public data. No custody of your funds. No black box.
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
            <div className="metric"><div className="k">Custody</div><div className="v">Non-custodial</div><div className="s">you hold the token</div></div>
            <div className="metric"><div className="k">Program</div><div className="v">Audited</div><div className="s">Sanctum stake-pool</div></div>
            <div className="metric"><div className="k">Decentralisation</div><div className="v">#{rank}<small>/{total}</small></div><div className="s">independently verified</div></div>
            <div className="metric"><div className="k">Transparency</div><div className="v">Open</div><div className="s">100% public on-chain data</div></div>
          </div>
        </div>
      </section>

      {/* validator selection */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; Validator selection</div>
          <div className="sec-head">
            <h1 className="sec-h">Hard thresholds, <em>every epoch.</em></h1>
            <p className="sec-lede">Stake is delegated only to validators that clear an explicit eligibility bar — re-checked after every epoch. Breach a threshold and a validator drops from the active set.</p>
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

      {/* custody & transparency */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; Custody &amp; transparency</div>
          <div className="sec-head">
            <h1 className="sec-h">You hold the keys. <em>Verify the rest.</em></h1>
            <p className="sec-lede">Self-custodied, liquid, and fully on-chain. Nothing about definSOL asks you to trust us over the data.</p>
          </div>
          <div className="steps">
            {CUSTODY.map((c, i) => (
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
          <p>Reporting, validator policy, MEV handling, reserves, custody-platform support — we’re happy to walk your team through any of it.</p>
          <div className="cta" style={{ justifyContent: 'center' }}>
            <a className="btn btn-solid" href={LINKS.telegram} target="_blank" rel="noreferrer">Talk to our team →</a>
            <a className="btn btn-ghost" href={LINKS.twitter} target="_blank" rel="noreferrer">Follow on X</a>
          </div>
        </div>
      </section>
    </>
  );
}
