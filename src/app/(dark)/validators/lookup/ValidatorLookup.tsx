'use client';

import { useEffect, useMemo, useState } from 'react';

type Row = {
  vote: string;
  name: string | null;
  country: string | null;
  city: string | null;
  asn: string | null;
  asnName: string | null;
  g: number;
  rCountry: number | null;
  rCity: number | null;
  rAsn: number | null;
  wizScore: number | null;
  totalSol: number;
  directedSol: number;
  curveSol: number;
  targetCurveSol: number;
};
type Data = {
  epoch: number | null;
  ts: string | null;
  params: { minStakeSol: number; maxStakeSol: number; curveK: number } | null;
  pool: { gdi: number | null; rank: number | null; totalRanked: number | null } | null;
  validators: Row[];
  unavailable?: boolean;
};

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const geo = (v: Row) => [v.city, v.country, v.asn].filter(Boolean).join(' · ') || '—';
function ago(ts: string | null): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// The optimiser protects the directed commitment and steers the TOTAL toward the
// GDI sigmoid target (targetCurveSol == targetStake(g), which is a TOTAL target).
// So the total it steers toward is the higher of the two.
function targetTotal(v: Row) { return Math.max(v.directedSol, v.targetCurveSol); }
function delta(v: Row) { return v.totalSol - targetTotal(v); }
// Discretionary curve the target actually implies, given the protected directed floor.
// directed + curveTarget == targetTotal, so (curveSol - curveTarget) == delta — the
// breakdown reconciles exactly with the headline. When directed already meets/exceeds
// the rarity target this is 0 (all curve is being trimmed).
function curveTarget(v: Row) { return Math.max(0, targetTotal(v) - v.directedSol); }
function steer(v: Row) {
  const d = delta(v);
  const tol = Math.max(150, 0.03 * v.totalSol);
  if (Math.abs(d) <= tol) return { dir: 0, arrow: '—', label: 'At target' };
  if (d > 0) return { dir: 1, arrow: '▼', label: 'Trimming' };
  return { dir: -1, arrow: '▲', label: 'Building' };
}
function steerText(v: Row) {
  const d = delta(v); // == curve delta: directed is protected, so this is all the curve moving
  const ct = curveTarget(v);
  const tol = Math.max(150, 0.03 * v.totalSol);
  const dir = `Your directed commitment of ${fmt(v.directedSol)} ◎ is protected and never moves`;
  if (Math.abs(d) <= tol) return `${dir} — and your curve stake is already at its GDI target of ${fmt(ct)} ◎, so the optimiser holds it steady.`;
  if (d > 0) {
    return v.directedSol >= v.targetCurveSol
      ? `${dir}. The optimiser steers only your curve stake — trimming it by ${fmt(d)} ◎ toward ${fmt(ct)} ◎, because ${v.city ?? 'your location'} / ${v.asn ?? '—'} is a common GDI bucket (G ${v.g.toFixed(3)}) and little discretionary stake is held there.`
      : `${dir}. The optimiser steers only your curve stake — trimming it by ${fmt(d)} ◎ toward ${fmt(ct)} ◎, as your directed floor already covers most of your GDI target.`;
  }
  return `${dir}. As a rarer validator (G ${v.g.toFixed(3)}) your curve target is ${fmt(ct)} ◎ — the optimiser builds your curve stake toward it by ${fmt(-d)} ◎, gradually, as pool reserve allows.`;
}

// ── editorial (.dfy) primitives ─────────────────────────────────────────────
const HAIR = '1px solid var(--hair)';
const PANEL: React.CSSProperties = { background: 'rgba(8,16,90,.32)', border: HAIR, backdropFilter: 'blur(10px) saturate(1.1)' };
const LABEL: React.CSSProperties = { fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--faint)' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--serif)' };

function Detail({ v, data, onBack }: { v: Row; data: Data; onBack: () => void }) {
  const s = steer(v);
  const total = v.totalSol;
  const curve = v.curveSol;
  const ctgt = curveTarget(v);
  const dFrac = total > 0 ? v.directedSol / total : 0;
  const cScale = Math.max(curve, ctgt, 1);
  const toneAbove = 'var(--faint)'; // trimming — muted
  const toneBelow = 'var(--teal)';  // building — good
  const deltaTone = s.dir === -1 ? toneBelow : s.dir === 1 ? toneAbove : 'var(--dim)';
  return (
    <div style={{ marginTop: 30 }}>
      <button type="button" onClick={onBack} className="morelink" style={{ marginTop: 0, background: 'none', cursor: 'pointer' }}>← All validators</button>

      <div style={{ ...PANEL, marginTop: 16 }}>
        {/* header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 26px', borderBottom: HAIR }}>
          <div>
            <div style={{ ...SERIF, fontWeight: 600, fontSize: 30, lineHeight: 1 }}>{v.name || short(v.vote)}</div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--dim)' }}>{geo(v)}{v.asnName ? ` · ${v.asnName}` : ''}</div>
            <a href={`https://solscan.io/account/${v.vote}`} target="_blank" rel="noreferrer" style={{ marginTop: 8, display: 'inline-block', fontSize: 11, color: 'var(--faint)', textDecoration: 'none', letterSpacing: '.04em' }}>{short(v.vote)} ↗</a>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={LABEL}>G score</div>
            <div style={{ ...SERIF, fontWeight: 600, fontSize: 46, lineHeight: 1, marginTop: 4 }}>{v.g.toFixed(3)}</div>
            <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{v.g >= 1 ? 'above average — rarer' : 'below average — common'}</div>
          </div>
        </div>

        {/* CURRENT STAKE — total, split into directed (fixed) + curve (discretionary) */}
        <div style={{ padding: '24px 26px', borderBottom: HAIR }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
            <div style={LABEL}>Current pool stake</div>
            <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(total)} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
          </div>
          <div style={{ marginTop: 14, display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,.10)' }} title={`Directed ${fmt(v.directedSol)} ◎ · Curve ${fmt(curve)} ◎`}>
            <div style={{ width: `${dFrac * 100}%`, background: '#fff' }} />
            <div style={{ width: `${(1 - dFrac) * 100}%`, background: 'var(--teal)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, marginTop: 16, background: 'var(--hair)', border: HAIR }}>
            <div style={{ background: '#0e1f93', padding: '16px 18px' }}>
              <div style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#fff' }} /> Directed</div>
              <div style={{ ...SERIF, fontSize: 24, fontWeight: 600, marginTop: 8, lineHeight: 1 }}>{fmt(v.directedSol)} ◎</div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 7 }}>committed matching — protected, fixed</div>
            </div>
            <div style={{ background: '#0e1f93', padding: '16px 18px' }}>
              <div style={{ ...LABEL, display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--teal)' }} /> Curve</div>
              <div style={{ ...SERIF, fontSize: 24, fontWeight: 600, marginTop: 8, lineHeight: 1 }}>{fmt(curve)} ◎</div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 7 }}>discretionary — GDI-driven</div>
            </div>
          </div>
        </div>

        {/* CURVE — current vs target (the part that actually moves) */}
        <div style={{ padding: '24px 26px' }}>
          <div style={LABEL}>Curve stake — current vs target</div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 18 }}>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>Current curve</div>
              <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(curve)} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
            </div>
            <div style={{ ...SERIF, fontSize: 28, color: 'var(--faint)', lineHeight: 1.4 }}>→</div>
            <div>
              <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>Target curve</div>
              <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(ctgt)} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 18, color: deltaTone, letterSpacing: '.02em' }}>{s.arrow} {fmt(Math.abs(delta(v)))} ◎</div>
              <div style={{ fontSize: 10.5, color: deltaTone, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
          {/* current vs target curve bars */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--dim)', marginBottom: 5 }}><span>Current curve</span><span style={{ fontFamily: 'var(--mono)', color: '#fff' }}>{fmt(curve)} ◎</span></div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.10)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(curve / cScale) * 100}%`, background: 'var(--teal)', borderRadius: 999 }} /></div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--dim)', marginBottom: 5 }}><span>Target curve</span><span style={{ fontFamily: 'var(--mono)', color: '#fff' }}>{fmt(ctgt)} ◎</span></div>
              <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.10)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(ctgt / cScale) * 100}%`, background: 'rgba(255,255,255,.55)', borderRadius: 999 }} /></div>
            </div>
          </div>
          <p style={{ marginTop: 15, fontSize: 13, color: 'var(--dim)', lineHeight: 1.7 }}>{steerText(v)}</p>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.7, maxWidth: 820 }}>
        <span style={{ color: 'var(--dim)' }}>Directed</span> (your directed principal + matching) is a protected commitment — it never moves.
        The optimiser steers only your <span style={{ color: 'var(--dim)' }}>curve</span> stake: your <span style={{ color: 'var(--dim)' }}>GDI target</span> is the sigmoid of your G score (higher for rarer country/city/ASN), capped at the {data.params ? `${fmt(data.params.maxStakeSol)} ◎ ` : ''}per-validator total — and your <span style={{ color: 'var(--dim)' }}>curve target</span> is whatever that target leaves above your protected directed floor.
        Rebalancing is gradual and operator-approved each epoch. As of epoch {data.epoch ?? '—'}{data.ts ? ` · ${ago(data.ts)}` : ''}.
      </p>
    </div>
  );
}

function Browse({ rows, onPick }: { rows: Row[]; onPick: (vote: string) => void }) {
  const th: React.CSSProperties = { ...LABEL, padding: '14px 18px', fontWeight: 400, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '13px 18px', textAlign: 'right', fontFamily: 'var(--mono)' };
  return (
    <div style={{ ...PANEL, marginTop: 22 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Validator</th>
              <th style={th}>Total</th>
              <th style={th}>Directed</th>
              <th style={th}>Curve</th>
              <th style={th}>Δ curve</th>
              <th style={th}>G</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const s = steer(v);
              const dTone = s.dir === -1 ? 'var(--teal)' : s.dir === 1 ? 'var(--faint)' : 'var(--dim)';
              return (
                <tr
                  key={v.vote}
                  onClick={() => onPick(v.vote)}
                  style={{ borderTop: HAIR, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '13px 18px' }}>
                    <div style={{ color: '#fff' }}>{v.name || short(v.vote)}</div>
                    <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>{geo(v)}</div>
                  </td>
                  <td style={{ ...td, color: '#fff' }}>{fmt(v.totalSol)}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{fmt(v.directedSol)}</td>
                  <td style={{ ...td, color: 'var(--dim)' }}>{fmt(v.curveSol)}</td>
                  <td style={{ ...td, color: dTone }}>{s.dir === 0 ? '—' : `${s.arrow} ${fmt(Math.abs(delta(v)))}`}</td>
                  <td style={{ ...td, color: '#fff' }}>{v.g.toFixed(3)}</td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--faint)' }}>No validators match your search.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ValidatorLookup() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/validator-metrics', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: Data) => setData(d))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    const v = new URLSearchParams(window.location.search).get('v');
    if (v) setSel(v);
  }, []);

  const pick = (vote: string | null) => {
    setSel(vote);
    setQ('');
    const url = new URL(window.location.href);
    if (vote) url.searchParams.set('v', vote); else url.searchParams.delete('v');
    window.history.replaceState(null, '', url);
  };

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = data?.validators ?? [];
    if (!s) return all;
    return all.filter((v) => `${v.name ?? ''} ${v.vote} ${v.city ?? ''} ${v.country ?? ''} ${v.asn ?? ''}`.toLowerCase().includes(s));
  }, [q, data]);

  const selected = useMemo(() => data?.validators.find((v) => v.vote === sel) ?? null, [sel, data]);
  const pool = data?.pool;

  return (
    <section className="sec" style={{ borderTop: 0 }}>
      <div className="wrap">
        <div className="chapter"><span className="n">Validators</span> &nbsp;·&nbsp; Pool position</div>
        <div className="sec-head">
          <h1 className="sec-h">Where do you <em>stand</em> in the pool?</h1>
          <p className="sec-lede">
            Look up any validator in the definSOL set to see its live pool stake — <b style={{ color: 'var(--teal)', borderBottom: '1px solid var(--teal)' }}>directed and curve</b> —
            and the curve the optimiser is steering toward from its G score. The exact numbers the optimiser uses.
          </p>
        </div>

        {pool?.gdi != null ? (
          <div className="loopnote" style={{ marginTop: 30 }}>
            definSOL pool · GDI <b>{pool.gdi.toFixed(2)}</b>{pool.rank != null ? <> · rank <b>#{pool.rank}</b> of {pool.totalRanked}</> : null}
            {data?.epoch != null ? <> · epoch {data.epoch}</> : null} · {data?.validators.length ?? 0} validators
          </div>
        ) : null}

        {!selected ? (
          <input
            className="wl-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search validator name, vote pubkey, city or ASN…"
            style={{ marginTop: 22, maxWidth: 620 }}
          />
        ) : null}

        {err ? <p style={{ marginTop: 24, color: '#ff8d8d', fontSize: 13 }}>Could not load metrics: {err}</p> : null}
        {data?.unavailable ? (
          <p style={{ marginTop: 24, color: 'var(--dim)', fontSize: 13, ...PANEL, padding: '16px 20px' }}>
            Validator metrics publish on the next optimiser run — check back shortly.
          </p>
        ) : null}

        {selected ? (
          <Detail v={selected} data={data!} onBack={() => pick(null)} />
        ) : data && !data.unavailable ? (
          <Browse rows={rows} onPick={pick} />
        ) : !err ? (
          <p style={{ marginTop: 24, color: 'var(--faint)', fontSize: 13 }}>Loading…</p>
        ) : null}
      </div>
    </section>
  );
}
