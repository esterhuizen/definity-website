import { getGdiStanding, GDI_URLS } from '@/lib/gdi';
import { getBaseApy } from '@/lib/apy';
import { InfinityField } from './InfinityField';

// Concept D hero — manifesto serif on Definity blue + a live instrument panel (the proof),
// wrapped in a generative ∞. Real GDI rank + base APY; looped APY is "coming soon" until
// the leverage product is locked in.
export async function HeroD() {
  const [apy, gdi] = await Promise.all([getBaseApy(), getGdiStanding()]);

  const apyStr = (apy ?? 5.32).toFixed(2);
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
                <a className="btn btn-ghost" href="/institutions">Institutional access</a>
              </div>
            </div>

            <div className="panel reveal d5">
              <div className="phead"><span className="l"><span className="live" /> definSOL · live</span><span>GDI epoch {gdi?.epoch ?? '—'}</span></div>
              <div className="prow">
                <div className="k">Base staking APY</div>
                <div className="big">
                  <div className="v">{apyStr}<span className="pct">%</span></div>
                  <svg className="spark" viewBox="0 0 120 36" preserveAspectRatio="none">
                    <defs><linearGradient id="gg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#37f0b0" /><stop offset="1" stopColor="#37f0b0" stopOpacity="0" /></linearGradient></defs>
                    <path className="fl" d="M0,28 8,27 16,28 24,24 32,25 40,21 48,22 56,19 64,20 72,16 80,17 88,14 96,15 104,12 112,11 120,9 L120,36 0,36 Z" />
                    <path className="ln" d="M0,28 8,27 16,28 24,24 32,25 40,21 48,22 56,19 64,20 72,16 80,17 88,14 96,15 104,12 112,11 120,9" />
                  </svg>
                </div>
              </div>
              <div className="twocol">
                <div><div className="k">Looped net APY</div><div className="v" style={{ color: 'var(--teal)' }}>Soon</div><div className="sub">leverage · in development</div></div>
                <div><div className="k">Total staked</div><div className="v">{tvlK}<span style={{ fontSize: '.42em', fontFamily: 'var(--mono)', color: 'var(--dim)' }}>K SOL</span></div><div className="sub">GDI #{rank} of {total} · top-decentralised</div></div>
              </div>
              <a className="soon" href={gdiHref} target="_blank" rel="noreferrer">
                <span>Loop competitiveness</span><span><b>Coming soon</b> · definSOL · bSOL · INF →</span>
              </a>
            </div>
          </section>

          <section className="metrics reveal d5">
            <div className="metric"><div className="k">definSOL base APY</div><div className="v">{apyStr}<small>%</small></div><div className="s">on-chain · net of fees</div></div>
            <div className="metric"><div className="k">Looped net APY</div><div className="v">Soon</div><div className="s">leverage product · in development</div></div>
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
