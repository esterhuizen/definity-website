'use client';

import { useCallback, useEffect, useState } from 'react';

type Amt = { sol: number; usd: number | null; nzd: number | null; defSol?: number };
type Data = {
  ok: boolean;
  error?: string;
  ts: string;
  inputs: {
    tvlSol: number;
    netApyPct: number;
    grossApyPct: number;
    poolFeePct: number;
    definityFeePct: number;
    sanctumFeePct: number;
    exchangeRate: number;
    solUsd: number | null;
    solNzd: number | null;
    priceSource: string | null;
    epochDays: number;
    epochDaysSource: 'live' | 'default' | 'override';
    epochsPerMonth: number;
    epochsPerYear: number;
    epoch: number | null;
    statsUpdatedAt: string | null;
    observedPerEpochDefSol: number;
    overridden: string[];
  };
  perEpoch: { defSol: number | null; sol: number };
  monthly: Amt;
  annual: Amt;
  check: { observedPerEpochDefSol: number; ratioModelToObserved: number | null };
};

const REFRESH_MS = 60_000;
const money = (n: number | null | undefined, symbol: string, d = 0) =>
  n == null ? '—' : `${symbol}${n.toLocaleString('en-US', { maximumFractionDigits: d })}`;
const sol = (n: number | null | undefined, d = 1) =>
  n == null ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: d })} ◎`;
const num = (n: number | null | undefined, d = 2) => (n == null ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d }));

function ago(iso: string | null): string {
  if (!iso) return '—';
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const CARD: React.CSSProperties = { background: 'rgba(8,16,90,.34)', border: '1px solid var(--hair)', padding: '26px 30px', flex: '1 1 300px' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--serif)' };
const LABEL: React.CSSProperties = { fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' };
const td: React.CSSProperties = { padding: '13px 0', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: 13 };

export function FeeProjection() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const qs = typeof window !== 'undefined' ? window.location.search : '';
      const j = (await (await fetch(`/api/fee-projection${qs}`, { cache: 'no-store' })).json()) as Data;
      if (!j.ok) { setErr(j.error || 'Projection unavailable.'); return; }
      setData(j); setErr(null); setFetchedAt(new Date().toISOString());
    } catch { setErr('Could not reach the projection service.'); }
  }, []);

  useEffect(() => {
    load();
    const r = setInterval(load, REFRESH_MS);
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => { clearInterval(r); clearInterval(t); };
  }, [load]);

  const i = data?.inputs;
  const whatIf = (i?.overridden?.length ?? 0) > 0;
  const priceMissing = data != null && (i?.solUsd == null || i?.solNzd == null);
  const ratio = data?.check.ratioModelToObserved ?? null;
  const inLine = ratio != null && Math.abs(ratio - 1) <= 0.15;

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 80, maxWidth: 940 }}>
      <div style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 26, height: 1, background: 'var(--faint)' }} />
        Definity · Internal — unlisted
      </div>
      <h1 style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(38px,5.6vw,68px)', lineHeight: 0.95, margin: '18px 0 14px', textTransform: 'uppercase', letterSpacing: '.01em' }}>
        Pool fee<br /><em style={{ fontStyle: 'italic', fontWeight: 500 }}>income</em>
      </h1>
      <p style={{ color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.7, maxWidth: 640 }}>
        Definity&apos;s share of the pool fee, projected to a month and priced live in NZD and USD. The pool charges
        {' '}{num(i?.poolFeePct ?? null, 1)}% on staking rewards; Definity keeps {num(i?.definityFeePct ?? null, 1)}%,
        Sanctum takes {num(i?.sanctumFeePct ?? null, 1)}%. Projection at the current rate — not booked revenue.
      </p>

      <div style={{ marginTop: 18, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--faint)', letterSpacing: '.04em', display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--teal)', boxShadow: '0 0 10px var(--teal)' }} />
          {err ? 'error' : data ? `refreshed ${ago(fetchedAt)}` : 'loading…'}
        </span>
        {i?.epoch != null ? <span>epoch {i.epoch}</span> : null}
        {i ? <span>epoch length {num(i.epochDays, 2)}d {i.epochDaysSource === 'live' ? '(live)' : i.epochDaysSource === 'override' ? '(set)' : '(est)'}</span> : null}
        {i?.statsUpdatedAt ? <span>stake/APY {ago(i.statsUpdatedAt)}</span> : null}
        {i?.priceSource ? <span>price · {i.priceSource}</span> : null}
        {whatIf ? <span style={{ color: '#f2b366' }}>what-if: {i?.overridden.join(', ')}</span> : null}
      </div>

      {err && !data ? <div style={{ ...CARD, marginTop: 26, color: '#ff8d8d' }}>{err}</div> : null}

      {/* HERO — Definity monthly income */}
      <div style={{ display: 'flex', gap: 18, marginTop: 30, flexWrap: 'wrap' }}>
        <div style={CARD}>
          <div style={LABEL}>Definity fee / month · NZD</div>
          <div style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(44px,7vw,76px)', lineHeight: 0.9, marginTop: 12, color: 'var(--teal)' }}>{money(data?.monthly.nzd, 'NZ$')}</div>
          <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>{money(data?.annual.nzd, 'NZ$')} / year</div>
        </div>
        <div style={CARD}>
          <div style={LABEL}>Definity fee / month · USD</div>
          <div style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(44px,7vw,76px)', lineHeight: 0.9, marginTop: 12 }}>{money(data?.monthly.usd, 'US$')}</div>
          <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>{money(data?.annual.usd, 'US$')} / year</div>
        </div>
      </div>

      {/* subtle reconciliation tick */}
      {data && ratio != null ? (
        <div style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 12, color: inLine ? 'var(--teal)' : '#f2b366', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{inLine ? '✓' : '⚠'}</span>
          <span style={{ color: 'var(--dim)' }}>
            {sol(data.perEpoch.defSol, 2).replace('◎', 'definSOL')}/epoch — {inLine ? 'in line with' : 'vs'} your observed {num(data.check.observedPerEpochDefSol, 1)} definSOL/epoch{inLine ? '' : ` (${(ratio * 100).toFixed(0)}%)`}.
          </span>
        </div>
      ) : null}

      {priceMissing ? (
        <div style={{ marginTop: 12, fontFamily: 'var(--mono)', fontSize: 11.5, color: '#f2b366' }}>
          Price feed unavailable — SOL/definSOL amounts are exact; fiat shows a dash until it returns.
        </div>
      ) : null}

      {/* WORKING */}
      <div style={{ marginTop: 34 }}>
        <div style={{ ...LABEL, marginBottom: 6 }}>The working</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <Row k="Pool stake (TVL)" v={sol(i?.tvlSol ?? null, 0)} />
            <Row k="Gross staking APY" v={`${num(i?.grossApyPct ?? null)}%`} note={`from ${num(i?.netApyPct ?? null)}% net definSOL yield`} />
            <Row k="Pool fee" v={`${num(i?.poolFeePct ?? null, 1)}%`} note={`Definity ${num(i?.definityFeePct ?? null, 1)}% · Sanctum ${num(i?.sanctumFeePct ?? null, 1)}%`} />
            <Row k="Definity fee / epoch" v={`${num(data?.perEpoch.defSol ?? null, 2)} definSOL · ${sol(data?.perEpoch.sol ?? null)}`} />
            <Row k="Epoch length" v={`${num(i?.epochDays ?? null, 2)} days`} note={`${num(i?.epochsPerMonth ?? null, 2)} epochs / month`} />
            <Row k="Definity fee / month" v={`${num(data?.monthly.defSol ?? null, 1)} definSOL · ${sol(data?.monthly.sol ?? null)}`} />
            <Row k="SOL price" v={i?.solUsd != null ? `US$${num(i.solUsd)} · NZ$${num(i?.solNzd ?? null)}` : '—'} />
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 28, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)', lineHeight: 1.7, maxWidth: 780 }}>
        Refreshes every 60s. Stake/APY/exchange-rate from the site&apos;s hourly stats; SOL price from CoinGecko; epoch length from
        live slot time; observed take {num(i?.observedPerEpochDefSol ?? null, 1)} definSOL/epoch is your figure. What-if: append
        {' '}<span style={{ color: 'var(--dim)' }}>?definityFee=5&amp;poolFee=7.5&amp;apy=&amp;perEpoch=3.4&amp;epochDays=1.83&amp;sol=&amp;nzd=</span> to override any
        input — the header flags overrides.
      </p>
    </div>
  );
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <tr>
      <td style={{ ...td, color: 'var(--dim)', width: '48%' }}>
        {k}
        {note ? <span style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>{note}</span> : null}
      </td>
      <td style={{ ...td, color: '#fff', textAlign: 'right' }}>{v}</td>
    </tr>
  );
}
