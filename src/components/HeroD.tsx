import { getGdiStanding, GDI_URLS } from '@/lib/gdi';
import { getBaseApy, getNav, getDirectStakeUsedPct, getTotalStakedSol } from '@/lib/apy';
import { InfinityField } from './InfinityField';

// Concept D hero — manifesto serif on Definity blue + a live instrument panel (the proof),
// wrapped in a generative ∞. Real GDI rank + base APY; looped APY is "coming soon" until
// the leverage product is locked in. Every figure comes from the collector's stats.json
// (kept last-good) and degrades to an em-dash — never a fabricated number — on a >1-day
// source outage.
export async function HeroD() {
  const [apy, gdi, nav, dsUsedPct, totalSol] = await Promise.all([
    getBaseApy(), getGdiStanding(), getNav(), getDirectStakeUsedPct(), getTotalStakedSol(),
  ]);

  const em = '—';
  const navStr = nav != null ? nav.toFixed(3) : null;
  const tvlK = totalSol != null ? Math.round(totalSol / 1000) : null;
  const gdiScore = gdi?.gdi != null ? gdi.gdi.toFixed(2) : null;
  const baseline = gdi?.baseline != null ? gdi.baseline.toFixed(2) : null;
  const gdiHref = gdi ? GDI_URLS.pool : GDI_URLS.index;

  // Pre-rendered value fragments — em-dash when the underlying value is absent, so no
  // tile ever shows a fabricated or stale-as-live number.
  const dsBig     = dsUsedPct != null ? <>{dsUsedPct}<i>%</i></> : em;
  const dsSmall   = dsUsedPct != null ? <>{dsUsedPct}<small>%</small></> : em;
  const dsSub     = dsUsedPct != null ? 'capacity used · up to 4.5×' : 'up to 4.5× to your validator · looping soon';
  const dsSubLong = dsUsedPct != null ? 'capacity used · up to 4.5× to your validator' : 'up to 4.5× to your validator · looping soon';
  const apyBig    = apy != null ? <>{apy.toFixed(2)}<span className="pct">%</span></> : em;
  const apySmall  = apy != null ? <>{apy.toFixed(2)}<small>%</small></> : em;
  const rankBig   = gdi ? <>#{gdi.rank}<i>/{gdi.total}</i></> : em;
  const rankSmall = gdi ? <>#{gdi.rank}<small>/{gdi.total}</small></> : em;
  const tvlBig    = tvlK != null ? <>{tvlK}<span style={{ fontSize: '.42em', fontFamily: 'var(--mono)', color: 'var(--dim)' }}>K SOL</span></> : em;
  const tvlSmall  = tvlK != null ? <>{tvlK}<small>K SOL</small></> : em;
  const gdiSub    = gdiScore != null && baseline != null ? `${gdiScore} vs ${baseline} baseline` : 'open · reproducible';

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
                  <div className="v">{apyBig}</div>
                  {navStr && (
                    <div className="navrate">
                      <div className="nr-k">1 definSOL</div>
                      <div className="nr-v">{navStr}<small>SOL</small></div>
                    </div>
                  )}
                </div>
              </div>
              <div className="twocol trio">
                <a href="/direct-staking"><div className="k">Direct staking <span className="go">↗</span></div><div className="v" style={{ color: 'var(--teal)' }}>{dsBig}</div><div className="sub">{dsSub}</div></a>
                <a href={gdiHref} target="_blank" rel="noreferrer"><div className="k">GDI rank <span className="go">↗</span></div><div className="v">{rankBig}</div><div className="sub">open · reproducible</div></a>
                <div><div className="k">TVL</div><div className="v">{tvlBig}</div><div className="sub">vetted, decentralised set</div></div>
              </div>
              <a className="soon" href={gdiHref} target="_blank" rel="noreferrer">
                <span>Loop competitiveness</span><span><b>Coming soon</b> · definSOL · bSOL · INF →</span>
              </a>
            </div>
          </section>

          <section className="metrics reveal d5">
            <div className="metric"><div className="k">definSOL base APY</div><div className="v">{apySmall}</div><div className="s">on-chain · net of fees</div></div>
            <a className="metric metric-link" href="/direct-staking"><div className="k">Direct staking <span className="go">↗</span></div><div className="v">{dsSmall}</div><div className="s">{dsSubLong}</div></a>
            <div className="metric"><div className="k">TVL</div><div className="v">{tvlSmall}</div><div className="s">total value locked in the pool</div></div>
            <a className="metric metric-link" href={gdiHref} target="_blank" rel="noreferrer"><div className="k">GDI rank · decentralisation</div><div className="v">{rankSmall}</div><div className="s">{gdiSub} <span className="go">↗</span></div></a>
          </section>
          <div className="trust reveal d5">
            <span>Non-custodial</span><span>Audited Sanctum program</span><span>{gdi ? <>Ranked #{gdi.rank} of {gdi.total} on <a href={gdiHref} target="_blank" rel="noreferrer">the open GDI</a></> : <>Verifiable on <a href={gdiHref} target="_blank" rel="noreferrer">the open GDI</a></>}</span><span>Every input verifiable on-chain</span>
          </div>
        </div>
      </div>
  );
}
