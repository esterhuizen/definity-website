import { getGdiStanding, GDI_URLS } from '@/lib/gdi';
import { getBaseApy, getNav, getDirectStakeUsedPct } from '@/lib/apy';
import { InfinityField } from './InfinityField';

// Concept D hero — manifesto serif on Definity blue + a live instrument panel (the proof),
// wrapped in a generative ∞. Real GDI rank + base APY; looped APY is "coming soon" until
// the leverage product is locked in.
export async function HeroD() {
  const [apy, gdi, nav, dsUsedPct] = await Promise.all([getBaseApy(), getGdiStanding(), getNav(), getDirectStakeUsedPct()]);
  const dsUsed = dsUsedPct != null ? String(dsUsedPct) : null; // % of matching capacity used (precomputed in stats.json)

  const apyStr = (apy ?? 5.32).toFixed(2);
  const navStr = nav != null ? nav.toFixed(3) : null;
  const rank = gdi ? gdi.rank : 2;
  const total = gdi ? gdi.total : 23;
  const tvlK = gdi?.stakeSol ? Math.round(gdi.stakeSol / 1000) : 265;
  const gdiScore = gdi?.gdi != null ? gdi.gdi.toFixed(2) : '4.42';
  const baseline = gdi?.baseline != null ? gdi.baseline.toFixed(2) : '2.73';
  const gdiHref = gdi ? GDI_URLS.pool : GDI_URLS.index;

  return (
    <div className="hero-zone">
        <InfinityField />
        <div className="wrap">
          <section className="hero">
            <div>
              <div className="eyebrow reveal d2">Institutional liquid staking · Solana</div>
              <h1 className="reveal d3">Stake once.<br />Compound<br /><em>forever.</em></h1>
              <p className="lede reveal d4">
                Definity issues <b>definSOL</b> — a non-custodial liquid staking token that
                compounds every epoch, loops for leverage, and publishes every input behind its yield.
              </p>
              <div className="cta reveal d4">
                <a className="btn btn-solid" href="/stake">Stake SOL →</a>
                <a className="btn btn-ghost" href="/direct-staking">Direct staking →</a>
                <a className="btn btn-ghost" href="/institutions">Institutional access</a>
              </div>
            </div>

            <div className="panel reveal d5">
              <div className="phead"><span className="l"><span className="live" /> definSOL · live</span><span>GDI epoch {gdi?.epoch ?? '—'}</span></div>
              <div className="prow">
                <div className="k">Base staking APY</div>
                <div className="big">
                  <div className="v">{apyStr}<span className="pct">%</span></div>
                  {navStr && (
                    <div className="navrate">
                      <div className="nr-k">1 definSOL</div>
                      <div className="nr-v">{navStr}<small>SOL</small></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="twocol trio">
                <a href="/direct-staking"><div className="k">Direct staking <span className="go">↗</span></div><div className="v" style={{ color: 'var(--teal)' }}>{dsUsed != null ? <>{dsUsed}<i>%</i></> : 'Live'}</div><div className="sub">{dsUsed != null ? 'capacity used · up to 4.5×' : 'up to 4.5× to your validator · looping soon'}</div></a>
                <a href={gdiHref} target="_blank" rel="noreferrer"><div className="k">GDI rank <span className="go">↗</span></div><div className="v">#{rank}<i>/{total}</i></div><div className="sub">open · reproducible</div></a>
                <div><div className="k">Total staked</div><div className="v">{tvlK}<span style={{ fontSize: '.42em', fontFamily: 'var(--mono)', color: 'var(--dim)' }}>K SOL</span></div><div className="sub">vetted, decentralised set</div></div>
              </div>
              <a className="soon" href={gdiHref} target="_blank" rel="noreferrer">
                <span>Loop competitiveness</span><span><b>Coming soon</b> · definSOL · bSOL · INF →</span>
              </a>
            </div>
          </section>

          <section className="metrics reveal d5">
            <div className="metric"><div className="k">definSOL base APY</div><div className="v">{apyStr}<small>%</small></div><div className="s">on-chain · net of fees</div></div>
            <a className="metric metric-link" href="/direct-staking"><div className="k">Direct staking <span className="go">↗</span></div><div className="v">{dsUsed != null ? <>{dsUsed}<small>%</small></> : 'Live'}</div><div className="s">{dsUsed != null ? 'capacity used · up to 4.5× to your validator' : 'up to 4.5× to your validator · looping soon'}</div></a>
            <div className="metric"><div className="k">Total value staked</div><div className="v">{tvlK}<small>K SOL</small></div><div className="s">across the pool</div></div>
            <a className="metric metric-link" href={gdiHref} target="_blank" rel="noreferrer"><div className="k">GDI rank · decentralisation</div><div className="v">#{rank}<small>/{total}</small></div><div className="s">{gdiScore} vs {baseline} baseline <span className="go">↗</span></div></a>
          </section>
          <div className="trust reveal d5">
            <span>Non-custodial</span><span>Audited Sanctum program</span><span>Ranked #{rank} of {total} on <a href={gdiHref} target="_blank" rel="noreferrer">the open GDI</a></span><span>Every input verifiable on-chain</span>
          </div>
        </div>
      </div>
  );
}
