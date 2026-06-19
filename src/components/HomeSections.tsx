import { getGdiStanding, GDI_URLS } from '@/lib/gdi';
import { POOL, LINKS } from '@/config/pool';
import { LogoMark } from './LogoMark';

// Phase 2 — the homepage below the hero, in Concept D's system: the loop (institutional
// hook, "coming soon"), proof/trust (live GDI + verifiable links), the decentralised
// validator set (mission reframed as counterparty quality), an institutional CTA, footer.
export async function HomeSections() {
  const gdi = await getGdiStanding();
  const rank = gdi?.rank ?? 2;
  const total = gdi?.total ?? 23;
  const score = gdi?.gdi != null ? gdi.gdi.toFixed(2) : '4.42';
  const baseline = gdi?.baseline != null ? gdi.baseline.toFixed(2) : '2.73';
  const gdiHref = gdi ? GDI_URLS.pool : GDI_URLS.index;

  return (
    <div className="dfy">
      {/* 01 · The loop */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">01</span>&nbsp; The loop</div>
          <div className="sec-head">
            <h1 className="sec-h">Compound the <em>compounding.</em></h1>
            <p className="sec-lede">definSOL compounds your staking yield every epoch. Loop it — deposit, borrow SOL, re-stake — to compound it again, at leverage.</p>
          </div>
          <div className="steps">
            <div className="step"><div className="si">01</div><div className="st">Stake</div><div className="sd">Deposit SOL, receive definSOL — a liquid token whose value compounds each epoch.</div></div>
            <div className="step"><div className="si">02</div><div className="st">Borrow</div><div className="sd">Post definSOL as collateral and borrow SOL against it in a lending market.</div></div>
            <div className="step"><div className="si">03</div><div className="st">Re-stake</div><div className="sd">Stake the borrowed SOL back into definSOL and repeat — looping the yield.</div></div>
          </div>
          <div className="loopnote"><span>Looped net APY</span><b>Coming soon →</b><span>modelled live across definSOL · bSOL · INF</span></div>
        </div>
      </section>

      {/* 02 · Proof */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">02</span>&nbsp; Proof, not promises</div>
          <div className="sec-head">
            <h1 className="sec-h">Every claim is <em>verifiable.</em></h1>
            <p className="sec-lede">Audited, non-custodial infrastructure — and the data behind every number is published and independently reproducible.</p>
          </div>
          <div className="creds">
            <a className="cred" href={gdiHref} target="_blank" rel="noreferrer">
              <div className="ck">Decentralisation · open GDI</div>
              <div className="cv">#{rank} <small>of {total}</small></div>
              <div className="cd">Ranked on the open Geographic Decentralisation Index — {score} vs a {baseline} network baseline.</div>
              <div className="clink">Reproduce our score →</div>
            </a>
            <a className="cred" href={LINKS.solscanPool} target="_blank" rel="noreferrer">
              <div className="ck">Custody · Sanctum program</div>
              <div className="cv">Non-custodial</div>
              <div className="cd">Built on Sanctum&apos;s audited stake-pool program. Your stake stays yours; unstake any time.</div>
              <div className="clink">View the pool on-chain →</div>
            </a>
            <a className="cred" href={LINKS.solscanMint} target="_blank" rel="noreferrer">
              <div className="ck">Token · {POOL.lstSymbol}</div>
              <div className="cv">DEF1N…oyA</div>
              <div className="cd">A standard SPL liquid staking token whose NAV compounds every epoch.</div>
              <div className="clink">View the mint →</div>
            </a>
            <a className="cred" href="https://incentive.definity.finance/last24h.json" target="_blank" rel="noreferrer">
              <div className="ck">Data · published feed</div>
              <div className="cv">Open API</div>
              <div className="cd">APY, reserves and looping inputs are published hourly as a public, verifiable feed.</div>
              <div className="clink">Open the feed →</div>
            </a>
          </div>
        </div>
      </section>

      {/* 03 · Where it runs */}
      <section className="sec">
        <div className="wrap">
          <div className="chapter"><span className="n">03</span>&nbsp; Where it runs</div>
          <div className="sec-head">
            <h1 className="sec-h">A vetted, <em>decentralised</em> set.</h1>
            <p className="sec-lede">Stake is routed to a quality-screened, geographically-decentralised validator set — not concentrated for yield. That discipline is exactly what the GDI measures.</p>
          </div>
          <div className="mapwrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/world-map.svg" alt="" aria-hidden="true" />
            <div className="ov">
              <div className="ovk">#{rank} of {total}<span style={{ fontSize: '.4em', color: 'var(--teal)', fontFamily: 'var(--mono)' }}> · GDI</span></div>
              <div className="ovs">Geographic decentralisation, scored from public on-chain data — and independently reproducible.</div>
            </div>
          </div>
        </div>
      </section>

      {/* institutional CTA */}
      <section className="ctablock">
        <div className="wrap">
          <div className="chapter" style={{ justifyContent: 'center' }}>For funds &amp; treasuries</div>
          <h2 style={{ marginTop: '20px' }}>Stake at <em>scale.</em></h2>
          <p>Dedicated onboarding, reporting, and looping for institutions allocating to definSOL.</p>
          <div className="cta">
            <a className="btn btn-solid" href="/institutions">Institutional access →</a>
            <a className="btn btn-ghost" href={LINKS.telegram} target="_blank" rel="noreferrer">Talk to us</a>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="foot">
        <div className="wrap">
          <div className="fgrid">
            <div className="fcol">
              <div className="fbrand"><LogoMark /> Definity</div>
              <p className="ftag">Non-custodial liquid staking on Solana. Stake SOL → definSOL.</p>
            </div>
            <div className="fcol"><h4>Product</h4>
              <a href={LINKS.sanctumLst} target="_blank" rel="noreferrer">Stake on Sanctum</a>
              <a href={LINKS.jupiterSwap} target="_blank" rel="noreferrer">Swap on Jupiter</a>
              <a href="/institutions">Institutions</a>
              <a href="/stake">Stake widget</a>
            </div>
            <div className="fcol"><h4>Verify</h4>
              <a href={gdiHref} target="_blank" rel="noreferrer">GDI rank #{rank}/{total}</a>
              <a href={LINKS.solscanPool} target="_blank" rel="noreferrer">Pool on Solscan</a>
              <a href={LINKS.solscanMint} target="_blank" rel="noreferrer">Mint on Solscan</a>
              <a href="/addresses">Addresses</a>
            </div>
            <div className="fcol"><h4>Connect</h4>
              <a href={LINKS.twitter} target="_blank" rel="noreferrer">X / Twitter</a>
              <a href={LINKS.telegram} target="_blank" rel="noreferrer">Telegram</a>
              <a href="/faq">FAQ</a>
            </div>
          </div>
          <div className="fbot">
            <span>© Definity · {POOL.lstName}</span>
            <span>Non-custodial · Audited Sanctum program · Ranked #{rank} of {total} on the GDI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
