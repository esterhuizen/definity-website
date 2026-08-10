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
  targetCurveSol: number;               // legacy total sigmoid (compat / fallback)
  gradientCurve?: number | null;        // model B: curve-book gradient
  curveTargetSol?: number | null;       // model B: curve target (independent of directed)
  totalTargetSol?: number | null;       // model B: directed + curve target
};
type Data = {
  epoch: number | null;
  ts: string | null;
  params: { minStakeSol: number; maxStakeSol: number; curveK: number; incGradMin?: number; minMove?: number } | null;
  pool: { gdi: number | null; rank: number | null; totalRanked: number | null } | null;
  validators: Row[];
  unavailable?: boolean;
};

const fmt = (n: number, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d });
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const geo = (v: Row) => [v.city, v.country, v.asn].filter(Boolean).join(' · ') || '—';
// Open GDI (gdindex.app) — the pool's page (where each validator lands) and a validator's own profile.
const GDI_POOL_URL = 'https://gdindex.app/pools/Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL';
const gdiValidatorUrl = (vote: string) => `https://gdindex.app/validator/${vote}`;
function ago(ts: string | null): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Four-state classifier — mirrors the optimiser's Phase 3, model B (two-book) ──
// Directed is a SEPARATE protected layer that never moves and no longer affects curve.
// The optimiser ranks + steers the CURVE on the curve book ALONE (gradientCurve),
// toward its own curve target (curveTargetSol ∈ [floor, ceil]) — independent of directed.
// Total = directed + curve (≤ directed_cap + ceil). By the curve-book gradient:
//   Building  gc ≥ incGradMin, curve < ceil → builds curve toward the CEILING.
//   Untouched gc ≥ incGradMin, curve ≥ ceil → at the ceiling, held.
//   Trimming  gc < incGradMin, curve > curveTarget + minMove → trims toward curveTarget.
//   Parked/Held gc < incGradMin, curve ≤ curveTarget → held (below → earns no reserve).
// Fallback (telemetry predating model B): legacy total-sigmoid target max(0, σ − directed).
const DUST = 100;                             // SOL — mirrors scenario.ts DUST
const INC_GRAD_MIN = 1.05, MIN_MOVE = 750;    // fallbacks if telemetry lacks the params

type State = 'building' | 'untouched' | 'trimming' | 'parked' | 'held';
type Steer = { state: State; label: string; arrow: string; dir: -1 | 0 | 1; target: number | null; mag: number };

// Curve target + the gradient that ranks the curve, under model B — falling back to
// the legacy total-sigmoid model when the optimiser telemetry predates model B.
function curveModel(v: Row): { gc: number; curveTgt: number; isB: boolean } {
  const isB = v.curveTargetSol != null && v.gradientCurve != null;
  return isB
    ? { gc: v.gradientCurve as number, curveTgt: v.curveTargetSol as number, isB: true }
    : { gc: v.g, curveTgt: Math.max(0, v.targetCurveSol - v.directedSol), isB: false };
}

function classify(v: Row, p: Data['params']): Steer {
  const ceil = p?.maxStakeSol ?? 20000;
  const incGradMin = p?.incGradMin ?? INC_GRAD_MIN;
  const minMove = p?.minMove ?? MIN_MOVE;
  const curve = v.curveSol;
  const { gc, curveTgt } = curveModel(v);
  if (gc >= incGradMin) {
    if (ceil - curve > DUST) {
      return { state: 'building', label: 'Building', arrow: '▲', dir: -1, target: ceil, mag: ceil - curve };
    }
    return { state: 'untouched', label: 'At ceiling', arrow: '—', dir: 0, target: null, mag: 0 };
  }
  const over = curve - curveTgt;
  if (over > minMove) {
    return { state: 'trimming', label: 'Trimming', arrow: '▼', dir: 1, target: curveTgt, mag: over };
  }
  if (over < -DUST) return { state: 'parked', label: 'Held', arrow: '—', dir: 0, target: null, mag: 0 };
  return { state: 'held', label: 'At target', arrow: '—', dir: 0, target: null, mag: 0 };
}

function steerText(v: Row, s: Steer, p: Data['params']): string {
  const ceil = p?.maxStakeSol ?? 20000;
  const { curveTgt, isB } = curveModel(v);
  const dir = `Your directed commitment of ${fmt(v.directedSol)} ◎ is protected and never moves`;
  const indep = isB ? ' — computed on the curve book alone, independent of your directed' : '';
  // Fallback drain-to-zero narrative (legacy telemetry only; under B curveTgt ≥ floor).
  if (!isB && s.state === 'trimming' && curveTgt <= DUST) {
    return `${dir}. GDI target ${fmt(v.targetCurveSol)} ◎ · your directed ${fmt(v.directedSol)} ◎ already exceeds it, so curve → 0.`;
  }
  switch (s.state) {
    case 'building':
      return `${dir}. Your curve-book rarity clears the growth threshold, so the optimiser builds your curve toward the ${fmt(ceil)} ◎ ceiling${indep}, gradually as reserve allows.`;
    case 'untouched':
      return `${dir}. Your curve is at the ${fmt(ceil)} ◎ per-validator ceiling — the optimiser holds it.`;
    case 'trimming':
      return `${dir}. The optimiser trims your curve by ${fmt(s.mag)} ◎ toward its GDI target of ${fmt(curveTgt)} ◎ — your own curve-book share${indep}.`;
    case 'parked':
      return `${dir}. Your curve (${fmt(v.curveSol)} ◎) is below its GDI target of ${fmt(curveTgt)} ◎, but under the growth threshold it earns no new reserve — held in place.`;
    default: // held — at its curve target
      return `${dir}. Your curve is at its GDI target of ${fmt(curveTgt)} ◎${indep}, so the optimiser holds it steady.`;
  }
}

// ── editorial (.dfy) primitives ─────────────────────────────────────────────
const HAIR = '1px solid var(--hair)';
const PANEL: React.CSSProperties = { background: 'rgba(8,16,90,.32)', border: HAIR, backdropFilter: 'blur(10px) saturate(1.1)' };
const LABEL: React.CSSProperties = { fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--faint)' };
const SERIF: React.CSSProperties = { fontFamily: 'var(--serif)' };

function Detail({ v, data, onBack }: { v: Row; data: Data; onBack: () => void }) {
  const s = classify(v, data.params);
  const total = v.totalSol;
  const curve = v.curveSol;
  const ct = s.target;                       // curve target — null for untouched/parked/held
  const drainToZero = ct != null && ct < DUST; // directed ≥ GDI target → curve is all excess
  const dFrac = total > 0 ? v.directedSol / total : 0;
  const cScale = Math.max(curve, ct ?? 0, 1);
  // teal = building (good), muted = trimming, dim = held
  const deltaTone = s.dir === -1 ? 'var(--teal)' : s.dir === 1 ? 'var(--faint)' : 'var(--dim)';
  return (
    <div style={{ marginTop: 30 }}>
      <button type="button" onClick={onBack} className="morelink" style={{ marginTop: 0, background: 'none', cursor: 'pointer' }}>← All validators</button>

      <div style={{ ...PANEL, marginTop: 16 }}>
        {/* header */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 26px', borderBottom: HAIR }}>
          <div>
            <div style={{ ...SERIF, fontWeight: 600, fontSize: 30, lineHeight: 1 }}>{v.name || short(v.vote)}</div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--dim)' }}>{geo(v)}{v.asnName ? ` · ${v.asnName}` : ''}</div>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline' }}>
              <a href={`https://solscan.io/account/${v.vote}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--faint)', textDecoration: 'none', letterSpacing: '.04em' }}>{short(v.vote)} ↗</a>
              <a href={gdiValidatorUrl(v.vote)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--teal)', textDecoration: 'none', letterSpacing: '.04em' }}>GDI profile — your rank &amp; rarity ↗</a>
            </div>
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

        {/* CURVE — state-aware: builds toward ceiling, trims toward sigmoid, or held */}
        <div style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div style={LABEL}>Curve stake{ct != null ? ' — current vs target' : ''}</div>
            {ct == null ? <div style={{ fontSize: 10.5, color: deltaTone, letterSpacing: '.1em', textTransform: 'uppercase' }}>{s.label}</div> : null}
          </div>

          {ct != null ? (
            <>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>Current curve</div>
                  <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(curve)} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
                </div>
                {!drainToZero ? <div style={{ ...SERIF, fontSize: 28, color: 'var(--faint)', lineHeight: 1.4 }}>→</div> : null}
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{drainToZero ? 'GDI target' : 'Target curve'}</div>
                  <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(drainToZero ? v.targetCurveSol : (ct ?? 0))} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 18, color: deltaTone, letterSpacing: '.02em' }}>{s.arrow} {fmt(s.mag)} ◎</div>
                  <div style={{ fontSize: 10.5, color: deltaTone, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 3 }}>{drainToZero ? 'Trimming to 0' : s.label}</div>
                </div>
              </div>
              {drainToZero ? (
                <p style={{ marginTop: 10, fontSize: 12, color: 'var(--faint)', lineHeight: 1.6 }}>Your protected directed ({fmt(v.directedSol)} ◎) already exceeds your GDI target, so all curve is discretionary excess — the optimiser drains it to 0.</p>
              ) : null}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--dim)', marginBottom: 5 }}><span>Current curve</span><span style={{ fontFamily: 'var(--mono)', color: '#fff' }}>{fmt(curve)} ◎</span></div>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.10)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(curve / cScale) * 100}%`, background: 'var(--teal)', borderRadius: 999 }} /></div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--dim)', marginBottom: 5 }}><span>Target curve</span><span style={{ fontFamily: 'var(--mono)', color: '#fff' }}>{fmt(ct)} ◎</span></div>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,.10)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(ct / cScale) * 100}%`, background: 'rgba(255,255,255,.55)', borderRadius: 999 }} /></div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>Current curve</div>
                <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(curve)} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 11.5, color: 'var(--faint)', maxWidth: 280, lineHeight: 1.5 }}>
                {s.state === 'untouched' ? 'At the per-validator ceiling — the optimiser holds it; not trimmed.' : s.state === 'parked' ? 'Below its GDI target — held in place; earns no new stake.' : v.directedSol >= v.targetCurveSol ? 'Directed already meets your GDI target — no discretionary curve held.' : 'At its GDI target — held steady.'}
              </div>
            </div>
          )}
          <p style={{ marginTop: 15, fontSize: 13, color: 'var(--dim)', lineHeight: 1.7 }}>{steerText(v, s, data.params)}</p>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.7, maxWidth: 860 }}>
        <span style={{ color: 'var(--dim)' }}>Directed</span> (your directed principal + matching) is a protected commitment — it never moves, and it no longer affects your curve. The optimiser ranks and steers your <span style={{ color: 'var(--dim)' }}>curve</span> on the <span style={{ color: 'var(--dim)' }}>curve book alone</span> — independent of directed — toward your own <span style={{ color: 'var(--dim)' }}>GDI target</span> (the sigmoid of your curve-book rarity{data.params ? `, ${fmt(data.params.minStakeSol)}–${fmt(data.params.maxStakeSol)} ◎` : ''}): above it your curve is <span style={{ color: 'var(--dim)' }}>trimmed</span> toward the target, a rare curve-book seat <span style={{ color: 'var(--dim)' }}>builds</span> toward the ceiling, otherwise it's <span style={{ color: 'var(--dim)' }}>held</span>. Your total is directed + curve.
        Rebalancing is gradual and operator-approved each epoch. As of epoch {data.epoch ?? '—'}{data.ts ? ` · ${ago(data.ts)}` : ''}.
      </p>
    </div>
  );
}

function Browse({ rows, onPick, params }: { rows: Row[]; onPick: (vote: string) => void; params: Data['params'] }) {
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
              const s = classify(v, params);
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
                  <td style={{ ...td, color: dTone }}>{s.dir === 0 ? '—' : `${s.arrow} ${fmt(s.mag)}`}</td>
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
          <>
            <div className="loopnote" style={{ marginTop: 30 }}>
              definSOL pool · GDI <b>{pool.gdi.toFixed(2)}</b>{pool.rank != null ? <> · rank <b>#{pool.rank}</b> of {pool.totalRanked} pools</> : null}
              {data?.epoch != null ? <> · epoch {data.epoch}</> : null} · {data?.validators.length ?? 0} validators
            </div>
            <a className="morelink" href={GDI_POOL_URL} target="_blank" rel="noreferrer" style={{ marginTop: 12 }}>
              See the definSOL pool on gdindex — the open leaderboard, where each validator lands →
            </a>
          </>
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
          <Browse rows={rows} onPick={pick} params={data.params} />
        ) : !err ? (
          <p style={{ marginTop: 24, color: 'var(--faint)', fontSize: 13 }}>Loading…</p>
        ) : null}
      </div>
    </section>
  );
}
