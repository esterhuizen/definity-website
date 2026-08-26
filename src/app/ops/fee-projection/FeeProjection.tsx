'use client';

import { useCallback, useEffect, useState } from 'react';

type Money = { annual: number | null; monthly: number | null; daily: number | null };
type Data = {
  ok: boolean;
  error?: string;
  ts: string;
  inputs: {
    tvlSol: number;
    apyPct: number;
    feePct: number;
    solUsd: number | null;
    solNzd: number | null;
    priceSource: string | null;
    epoch: number | null;
    statsUpdatedAt: string | null;
    overridden: string[];
  };
  sol: Money;
  usd: Money;
  nzd: Money;
};

const REFRESH_MS = 60_000;

const money = (n: number | null, symbol: string) =>
  n == null ? '—' : `${symbol}${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const sol = (n: number | null, d = 1) =>
  n == null ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: d })} ◎`;
const pct = (n: number | null, d = 2) => (n == null ? '—' : `${n.toFixed(d)}%`);

function ago(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const CARD: React.CSSProperties = {
  background: 'rgba(8,16,90,.34)',
  border: '1px solid var(--hair)',
  padding: '26px 30px',
  flex: '1 1 300px',
};
const SERIF: React.CSSProperties = { fontFamily: 'var(--serif)' };
const LABEL: React.CSSProperties = { fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' };
const td: React.CSSProperties = { padding: '13px 0', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: 13.5 };

export function FeeProjection() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const qs = typeof window !== 'undefined' ? window.location.search : '';
      const r = await fetch(`/api/fee-projection${qs}`, { cache: 'no-store' });
      const j = (await r.json()) as Data;
      if (!j.ok) {
        setErr(j.error || 'Projection unavailable.');
        return;
      }
      setData(j);
      setErr(null);
      setFetchedAt(new Date().toISOString());
    } catch {
      setErr('Could not reach the projection service.');
    }
  }, []);

  useEffect(() => {
    load();
    const r = setInterval(load, REFRESH_MS);
    const t = setInterval(() => tick((x) => x + 1), 1000); // "refreshed Ns ago" ticker
    return () => {
      clearInterval(r);
      clearInterval(t);
    };
  }, [load]);

  const i = data?.inputs;
  const whatIf = (i?.overridden?.length ?? 0) > 0;
  const priceMissing = data != null && (i?.solUsd == null || i?.solNzd == null);

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 80, maxWidth: 1040 }}>
      {/* header */}
      <div style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 26, height: 1, background: 'var(--faint)' }} />
        Definity · Internal — unlisted
      </div>
      <h1 style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(40px,6vw,72px)', lineHeight: 0.95, margin: '18px 0 14px', textTransform: 'uppercase', letterSpacing: '.01em' }}>
        Pool fee<br /><em style={{ fontStyle: 'italic', fontWeight: 500 }}>projection</em>
      </h1>
      <p style={{ color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.7, maxWidth: 640 }}>
        Live run-rate of pool-fee earnings: current pool stake × last-epoch APY × the 7.5% pool fee, projected to a
        monthly figure. Priced live in NZD and USD. This is a projection at the current rate, not booked revenue.
      </p>

      {/* status */}
      <div style={{ marginTop: 18, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--faint)', letterSpacing: '.04em', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 10px var(--teal)' }} />
          {err ? 'error' : data ? `refreshed ${ago(fetchedAt)}` : 'loading…'}
        </span>
        {i?.epoch != null ? <span>epoch {i.epoch}</span> : null}
        {i?.statsUpdatedAt ? <span>stake/APY {ago(i.statsUpdatedAt)}</span> : null}
        {i?.priceSource ? <span>price · {i.priceSource}</span> : null}
        {whatIf ? <span style={{ color: '#f2b366' }}>what-if: {i?.overridden.join(', ')} overridden</span> : null}
      </div>

      {err && !data ? (
        <div style={{ ...CARD, marginTop: 26, color: '#ff8d8d' }}>{err}</div>
      ) : null}

      {/* HERO — monthly NZD + USD */}
      <div style={{ display: 'flex', gap: 18, marginTop: 30, flexWrap: 'wrap' }}>
        <div style={CARD}>
          <div style={LABEL}>Monthly pool fee · NZD</div>
          <div style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(44px,7vw,76px)', lineHeight: 0.9, marginTop: 12, color: 'var(--teal)' }}>
            {money(data?.nzd.monthly ?? null, 'NZ$')}
          </div>
          <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>
            {money(data?.nzd.annual ?? null, 'NZ$')} / year · {money(data?.nzd.daily ?? null, 'NZ$')} / day
          </div>
        </div>
        <div style={CARD}>
          <div style={LABEL}>Monthly pool fee · USD</div>
          <div style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(44px,7vw,76px)', lineHeight: 0.9, marginTop: 12 }}>
            {money(data?.usd.monthly ?? null, 'US$')}
          </div>
          <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>
            {money(data?.usd.annual ?? null, 'US$')} / year · {money(data?.usd.daily ?? null, 'US$')} / day
          </div>
        </div>
      </div>

      {priceMissing ? (
        <div style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 11.5, color: '#f2b366' }}>
          Price feed unavailable right now — SOL amounts below are exact; fiat shows a dash until the feed returns.
        </div>
      ) : null}

      {/* BREAKDOWN */}
      <div style={{ marginTop: 34 }}>
        <div style={{ ...LABEL, marginBottom: 6 }}>The working</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <Row k="Pool stake (TVL)" v={sol(i?.tvlSol ?? null, 0)} />
            <Row k="APY — last epoch" v={pct(i?.apyPct ?? null)} note="baseApyPct, the pool's published staking APY" />
            <Row k="Pool fee" v={pct(i?.feePct ?? null, 1)} />
            <Row k="Annual fee" v={sol(data?.sol.annual ?? null)} note="TVL × APY × fee" />
            <Row k="Monthly fee" v={sol(data?.sol.monthly ?? null)} note="annual ÷ 12" />
            <Row k="SOL price" v={i?.solUsd != null ? `US$${i.solUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} · NZ$${i?.solNzd?.toLocaleString('en-US', { maximumFractionDigits: 2 }) ?? '—'}` : '—'} />
          </tbody>
        </table>
      </div>

      {/* footnote */}
      <p style={{ marginTop: 28, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)', lineHeight: 1.7, maxWidth: 760 }}>
        Refreshes every 60s. Stake and APY come from the site&apos;s hourly stats; SOL price from CoinGecko live.
        What-if: append <span style={{ color: 'var(--dim)' }}>?apy=7&amp;fee=7.5&amp;tvl=300000</span> (or <span style={{ color: 'var(--dim)' }}>sol=</span>/<span style={{ color: 'var(--dim)' }}>nzd=</span> to fix a price) to override any input — the header flags when a value is overridden.
      </p>
    </div>
  );
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <tr>
      <td style={{ ...td, color: 'var(--dim)', width: '46%' }}>
        {k}
        {note ? <span style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>{note}</span> : null}
      </td>
      <td style={{ ...td, color: '#fff', textAlign: 'right' }}>{v}</td>
    </tr>
  );
}
