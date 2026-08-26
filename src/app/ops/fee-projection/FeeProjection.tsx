'use client';

import { useCallback, useEffect, useState } from 'react';

type Amt = { sol: number; usd: number | null; nzd: number | null };
type Data = {
  ok: boolean;
  error?: string;
  ts: string;
  inputs: {
    tvlSol: number;
    netApyPct: number;
    grossApyPct: number;
    feePct: number;
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
    overridden: string[];
  };
  observed: { perEpochDefSol: number; perEpochSol: number; monthlyDefSol: number; monthly: Amt; annual: Amt };
  model: { basis: string; grossApyPct: number; netApyPct: number; perEpochDefSol: number | null; monthly: Amt; annual: Amt };
  modelVsObserved: number | null;
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
const td: React.CSSProperties = { padding: '12px 0', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: 13 };

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
  const o = data?.observed;
  const m = data?.model;
  const whatIf = (i?.overridden?.length ?? 0) > 0;
  const priceMissing = data != null && (i?.solUsd == null || i?.solNzd == null);
  const hot = data?.modelVsObserved != null ? (data.modelVsObserved - 1) * 100 : null;

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 80, maxWidth: 1040 }}>
      <div style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 26, height: 1, background: 'var(--faint)' }} />
        Definity · Internal — unlisted
      </div>
      <h1 style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(40px,6vw,72px)', lineHeight: 0.95, margin: '18px 0 14px', textTransform: 'uppercase', letterSpacing: '.01em' }}>
        Pool fee<br /><em style={{ fontStyle: 'italic', fontWeight: 500 }}>projection</em>
      </h1>
      <p style={{ color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.7, maxWidth: 660 }}>
        Monthly pool-fee earnings, priced live in NZD and USD. Headline is the <b style={{ color: '#fff' }}>observed run-rate</b> — your
        actual take of ~{num(o?.perEpochDefSol ?? null, 2)} definSOL/epoch projected across the live epoch cadence. The gross-APY model
        is shown underneath as a cross-check. Projection at the current rate, not booked revenue.
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

      {/* HERO — observed monthly */}
      <div style={{ display: 'flex', gap: 18, marginTop: 30, flexWrap: 'wrap' }}>
        <div style={CARD}>
          <div style={LABEL}>Monthly pool fee · NZD</div>
          <div style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(44px,7vw,76px)', lineHeight: 0.9, marginTop: 12, color: 'var(--teal)' }}>{money(o?.monthly.nzd, 'NZ$')}</div>
          <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>{money(o?.annual.nzd, 'NZ$')} / year</div>
        </div>
        <div style={CARD}>
          <div style={LABEL}>Monthly pool fee · USD</div>
          <div style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(44px,7vw,76px)', lineHeight: 0.9, marginTop: 12 }}>{money(o?.monthly.usd, 'US$')}</div>
          <div style={{ marginTop: 10, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)' }}>{money(o?.annual.usd, 'US$')} / year</div>
        </div>
      </div>

      {priceMissing ? (
        <div style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 11.5, color: '#f2b366' }}>
          Price feed unavailable — SOL/definSOL amounts are exact; fiat shows a dash until it returns.
        </div>
      ) : null}

      {/* SANITY CHECK — gross-APY model vs observed */}
      <div style={{ ...CARD, marginTop: 18, borderLeft: '3px solid #f2b366' }}>
        <div style={LABEL}>Cross-check · gross-APY model</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 30, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <div>
            <div style={{ ...SERIF, fontSize: 34, fontWeight: 600 }}>{money(m?.monthly.nzd, 'NZ$')} <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--dim)' }}>/ mo NZD</span></div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)', marginTop: 4 }}>{money(m?.monthly.usd, 'US$')} / mo USD · {num(m?.perEpochDefSol ?? null, 2)} definSOL/epoch</div>
          </div>
          {hot != null ? (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: '#f2b366', lineHeight: 1.6 }}>
              runs <b>{hot >= 0 ? '+' : ''}{hot.toFixed(0)}%</b> vs your observed {num(o?.perEpochDefSol ?? null, 2)} ◎def/epoch.
            </div>
          ) : null}
        </div>
        <p style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)', lineHeight: 1.7, marginTop: 14, maxWidth: 820 }}>
          TVL × gross APY × {num(i?.feePct ?? null, 1)}% fee (gross = net ÷ {(1 - (i?.feePct ?? 7.5) / 100).toFixed(3)}). It sits above your
          real take because baseApyPct ({num(i?.netApyPct ?? null)}% net → {num(i?.grossApyPct ?? null)}% gross) overstates the pool&apos;s
          realised yield — the observed figure above is the one to trust.
        </p>
      </div>

      {/* WORKING */}
      <div style={{ marginTop: 34 }}>
        <div style={{ ...LABEL, marginBottom: 6 }}>The working</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <Row k="Observed fee / epoch" v={`${num(o?.perEpochDefSol ?? null, 2)} definSOL`} note="your take, last 2 epochs (override ?perEpoch=)" />
            <Row k="Epoch length" v={`${num(i?.epochDays ?? null, 2)} days`} note={`${num(i?.epochsPerMonth ?? null, 2)} epochs / month`} />
            <Row k="definSOL → SOL" v={`× ${num(i?.exchangeRate ?? null, 4)}`} />
            <Row k="Monthly fee" v={`${num(o?.monthlyDefSol ?? null, 1)} definSOL · ${sol(o?.monthly.sol ?? null)}`} note="observed / epoch × epochs / month" />
            <Row k="SOL price" v={i?.solUsd != null ? `US$${num(i.solUsd)} · NZ$${num(i?.solNzd ?? null)}` : '—'} />
            <Row k="—  model: pool stake (TVL)" v={sol(i?.tvlSol ?? null, 0)} />
            <Row k="—  model: APY (gross)" v={`${num(i?.grossApyPct ?? null)}%`} note={`from ${num(i?.netApyPct ?? null)}% net (baseApyPct)`} />
            <Row k="—  model: pool fee" v={`${num(i?.feePct ?? null, 1)}%`} />
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 28, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)', lineHeight: 1.7, maxWidth: 780 }}>
        Refreshes every 60s. Stake/APY/exchange-rate from the site&apos;s hourly stats; SOL price from CoinGecko; epoch length from live
        slot time. What-if: append <span style={{ color: 'var(--dim)' }}>?perEpoch=3.4&amp;epochDays=1.83&amp;apy=&amp;fee=7.5&amp;sol=&amp;nzd=</span> to
        override any input — the header flags overrides.
      </p>
    </div>
  );
}

function Row({ k, v, note }: { k: string; v: string; note?: string }) {
  const muted = k.startsWith('—');
  return (
    <tr>
      <td style={{ ...td, color: muted ? 'var(--faint)' : 'var(--dim)', width: '48%' }}>
        {k}
        {note ? <span style={{ display: 'block', fontSize: 10.5, color: 'var(--faint)', marginTop: 3 }}>{note}</span> : null}
      </td>
      <td style={{ ...td, color: muted ? 'var(--dim)' : '#fff', textAlign: 'right' }}>{v}</td>
    </tr>
  );
}
