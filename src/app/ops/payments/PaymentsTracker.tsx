'use client';

import { useCallback, useEffect, useState } from 'react';

type HistoryRow = { epoch: number; received: number; spends: number; end_balance: number | null;
  paid: boolean; partial: boolean; closed_at: number | null; source: string };
type Payment = { ts: number | null; epoch: number; amount: number; balance_after: number; sig: string | null };
type State = { ata: string; last_balance: number; epoch: number; received: number; spends: number;
  epoch_partial: boolean; alerted_overdue: boolean; last_payment_at: number | null; updated_at: number };
type Data = { state: State | null; history: HistoryRow[]; payments: Payment[]; now: number };

const ACCOUNT = '38qTv5u9qqFXgYwDUtMQzG1yVYpX1Ddx1kscuDwaXp7c';
const REFRESH_MS = 60_000;
const def = (n: number | null | undefined, d = 4) =>
  n == null ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: d })}`;
const when = (ts: number | null | undefined) =>
  ts == null ? '—' : new Date(ts * 1000).toISOString().slice(5, 16).replace('T', ' ') + 'Z';
const ago = (ts: number | null | undefined) => {
  if (ts == null) return '—';
  const s = Math.max(0, Math.round(Date.now() / 1000 - ts));
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

const CARD: React.CSSProperties = { background: 'rgba(8,16,90,.34)', border: '1px solid var(--hair)', padding: '24px 28px' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--serif)' };
const LABEL: React.CSSProperties = { fontSize: 10.5, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--faint)' };
const td: React.CSSProperties = { padding: '10px 14px 10px 0', borderBottom: '1px solid var(--hair)', fontFamily: 'var(--mono)', fontSize: 13, textAlign: 'right' };

export function PaymentsTracker() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const j = (await (await fetch('/api/payments', { cache: 'no-store' })).json()) as Data;
      setData(j); setErr(null);
    } catch { setErr('Could not load payment data.'); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const s = data?.state ?? null;
  const paidNow = (s?.received ?? 0) > 1e-9;
  const watchStale = s != null && Date.now() / 1000 - s.updated_at > 3600;
  const missedRecent = (data?.history ?? []).filter((h) => !h.paid && !h.partial).slice(0, 6);

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 80, maxWidth: 920 }}>
      <div style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 26, height: 1, background: 'var(--faint)' }} />
        Definity · Internal — unlisted
      </div>
      <h1 style={{ ...SERIF, fontWeight: 600, fontSize: 'clamp(38px,5.6vw,64px)', lineHeight: 0.95, margin: '18px 0 10px', textTransform: 'uppercase' }}>
        Payment <em style={{ fontStyle: 'italic', fontWeight: 500 }}>watch</em>
      </h1>
      <p style={{ color: 'var(--dim)', fontSize: 13.5, lineHeight: 1.7, maxWidth: 640 }}>
        definSOL payments to <span style={{ fontFamily: 'var(--mono)', color: '#fff' }}>{ACCOUNT.slice(0, 4)}…{ACCOUNT.slice(-4)}</span>,
        expected every epoch. A missed epoch fires a Telegram alert (definity alerts); the watcher checks every 15 minutes.
      </p>

      {err ? <div style={{ ...CARD, marginTop: 24, color: '#ff8d8d' }}>{err}</div> : null}
      {watchStale ? (
        <div style={{ ...CARD, marginTop: 18, borderLeft: '3px solid #f2b366', fontSize: 12.5, color: 'var(--dim)' }}>
          <b style={{ color: '#f2b366' }}>Watcher data is {ago(s?.updated_at)} old</b> — the timer may be down; this page can&apos;t alert if the watcher isn&apos;t running.
        </div>
      ) : null}

      {/* current epoch */}
      <div style={{ display: 'flex', gap: 16, marginTop: 28, flexWrap: 'wrap' }}>
        <div style={{ ...CARD, flex: '1 1 260px', borderLeft: `3px solid ${paidNow ? 'var(--teal)' : s?.alerted_overdue ? '#ff8d8d' : '#f2b366'}` }}>
          <div style={LABEL}>Epoch {s?.epoch ?? '—'} · current</div>
          <div style={{ ...SERIF, fontSize: 38, fontWeight: 600, marginTop: 8, whiteSpace: 'nowrap', color: paidNow ? 'var(--teal)' : '#f2b366' }}>
            {paidNow ? <>PAID · {def(s?.received)}<span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--dim)' }}> definSOL</span></> : s?.alerted_overdue ? 'OVERDUE' : 'AWAITING'}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)', marginTop: 6 }}>
            last payment {ago(s?.last_payment_at)} · checked {ago(s?.updated_at)}
          </div>
        </div>
        <div style={{ ...CARD, flex: '1 1 200px' }}>
          <div style={LABEL}>Balance</div>
          <div style={{ ...SERIF, fontSize: 42, fontWeight: 600, marginTop: 8 }}>{def(s?.last_balance)} <span style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--dim)' }}>definSOL</span></div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--dim)', marginTop: 6 }}>
            {missedRecent.length ? `${missedRecent.length} missed in recent history: ${missedRecent.map((h) => h.epoch).join(', ')}` : 'no missed epochs in recent history'}
          </div>
        </div>
      </div>

      {/* per-epoch table */}
      <div style={{ marginTop: 32 }}>
        <div style={{ ...LABEL, marginBottom: 6 }}>Per-epoch history</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
            <thead><tr>
              <th style={{ ...td, ...LABEL, textAlign: 'left', borderBottom: '1px solid var(--hair)' }}>Epoch</th>
              <th style={{ ...td, ...LABEL, borderBottom: '1px solid var(--hair)' }}>Received</th>
              <th style={{ ...td, ...LABEL, borderBottom: '1px solid var(--hair)' }}>Spent</th>
              <th style={{ ...td, ...LABEL, borderBottom: '1px solid var(--hair)' }}>End balance</th>
              <th style={{ ...td, ...LABEL, borderBottom: '1px solid var(--hair)' }}>Status</th>
            </tr></thead>
            <tbody>
              {s ? (
                <tr>
                  <td style={{ ...td, textAlign: 'left', color: '#fff' }}>{s.epoch} · now</td>
                  <td style={{ ...td, color: paidNow ? 'var(--teal)' : 'var(--dim)' }}>{def(s.received)}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{def(s.spends)}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{def(s.last_balance)}</td>
                  <td style={{ ...td, color: paidNow ? 'var(--teal)' : '#f2b366' }}>{paidNow ? '✓ paid' : 'awaiting'}</td>
                </tr>
              ) : null}
              {(data?.history ?? []).map((h) => (
                <tr key={h.epoch}>
                  <td style={{ ...td, textAlign: 'left', color: '#fff' }}>{h.epoch}</td>
                  <td style={{ ...td, color: h.paid ? 'var(--teal)' : 'var(--faint)' }}>{def(h.received)}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{def(h.spends)}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{def(h.end_balance)}</td>
                  <td style={{ ...td, color: h.partial ? 'var(--faint)' : h.paid ? 'var(--teal)' : '#ff8d8d' }}>
                    {h.partial ? 'partial data' : h.paid ? '✓ paid' : '✗ MISSED'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* payment log */}
      <div style={{ marginTop: 32 }}>
        <div style={{ ...LABEL, marginBottom: 6 }}>Payments</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
            <tbody>
              {(data?.payments ?? []).map((p, i) => (
                <tr key={i}>
                  <td style={{ ...td, textAlign: 'left', color: 'var(--dim)' }}>{when(p.ts)}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>epoch {p.epoch}</td>
                  <td style={{ ...td, color: 'var(--teal)' }}>+{def(p.amount)} ◎def</td>
                  <td style={{ ...td, color: 'var(--faint)' }}>bal {def(p.balance_after)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 26, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--faint)', lineHeight: 1.7, maxWidth: 720 }}>
        Source: definity-payment-watch (systemd timer, 15 min; balance-delta accounting, history backfilled from chain).
        Alerts: ⚠ at 50% of an epoch with no payment · ❌ when an epoch closes unpaid · ✅ on recovery. Page refreshes every 60s.
      </p>
    </div>
  );
}
