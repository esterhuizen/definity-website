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
  stale?: boolean;                      // this validator moved since the plan → its target is held back
  targetCurveSol: number | null;        // legacy total sigmoid (compat / fallback); null when stale
  gradientCurve?: number | null;        // model B: curve-book gradient
  curveTargetSol?: number | null;       // model B: curve target (independent of directed)
  totalTargetSol?: number | null;       // model B: directed + curve target
};
type Data = {
  source?: 'live' | 'plan';   // 'live' = 15-min live book drives the numbers; 'plan' = last-plan fallback
  epoch: number | null;
  liveEpoch: number | null;   // current network/scoring epoch; if > epoch, the plan (targets) is behind
  planEpoch?: number | null;  // the last plan's epoch (shown in the fallback note)
  liveTargets?: { ts: string | null; ageMinutes: number | null; state: 'fresh' | 'stale' } | null;
  liveTargetsDown?: boolean;  // live file present but >2h old → showing the plan instead
  stale?: boolean;            // plan path only: ≥1 validator moved since the plan (drives the mover banner)
  ts: string | null;
  params: { minStakeSol: number; maxStakeSol: number; curveK: number; incGradMin?: number; minMove?: number;
            curveCapSol?: number; directedCapSol?: number; totalCapSol?: number; curveScale?: number; availableCurveSol?: number } | null;
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

// ── Curve tier classifier — mirrors the optimiser's Phase 3, model B (curve book) ──
// Directed is a SEPARATE protected layer (its own cap) that no longer affects curve.
// The optimiser steers the CURVE toward its NORMALISED curve target curveTargetSol — the SAME
// target the /curve-allocation view shows. The displayed target is ALWAYS curveTargetSol, so the
// two pages agree to the SOL. Classified by where the curve sits relative to that target:
//   Building    curve < curveTarget, gc ≥ incGradMin → funded toward the target with priority
//               (a high-conviction seat also fills above it, toward the cap).
//   Allocating  curve < curveTarget, gc < incGradMin → funded toward the target, reserve-limited.
//   Trimming    curve − curveTarget > minMove → trimmed back toward the target.
//   At target   within the dead-band.
// Fallback (telemetry predating model B): legacy total-sigmoid target max(0, σ − directed).
const DUST = 100;                             // SOL — mirrors scenario.ts DUST
const INC_GRAD_MIN = 1.05, MIN_MOVE = 750;    // fallbacks if telemetry lacks the params

type State = 'building' | 'trimming' | 'allocating' | 'held';
type Steer = { state: State; label: string; arrow: string; dir: -1 | 0 | 1; target: number; mag: number };

// Curve target + the gradient that ranks the curve, under model B — falling back to
// the legacy total-sigmoid model when the optimiser telemetry predates model B.
function curveModel(v: Row): { gc: number; curveTgt: number; isB: boolean } {
  const isB = v.curveTargetSol != null && v.gradientCurve != null;
  return isB
    ? { gc: v.gradientCurve as number, curveTgt: v.curveTargetSol as number, isB: true }
    : { gc: v.g, curveTgt: Math.max(0, (v.targetCurveSol ?? 0) - v.directedSol), isB: false };
}

function classify(v: Row, p: Data['params']): Steer {
  const incGradMin = p?.incGradMin ?? INC_GRAD_MIN;
  const minMove = p?.minMove ?? MIN_MOVE;
  const curve = v.curveSol;
  const { gc, curveTgt } = curveModel(v);
  const over = curve - curveTgt;             // + above the normalised target, − below it
  if (over < -DUST) {
    // Below the normalised curve target → funded toward it. Clearing the growth threshold funds
    // with priority (Building); below it, funded as reserve allows (Allocating). Both aim at curveTgt.
    const priority = gc >= incGradMin;
    return { state: priority ? 'building' : 'allocating', label: priority ? 'Building' : 'Allocating', arrow: '▲', dir: -1, target: curveTgt, mag: -over };
  }
  if (over > minMove) {
    return { state: 'trimming', label: 'Trimming', arrow: '▼', dir: 1, target: curveTgt, mag: over };
  }
  return { state: 'held', label: 'At target', arrow: '—', dir: 0, target: curveTgt, mag: 0 };
}

function steerText(v: Row, s: Steer): string {
  const { curveTgt, isB } = curveModel(v);
  const dir = `Your directed commitment of ${fmt(v.directedSol)} ◎ is protected and never moves`;
  const indep = isB ? ' — computed on the curve book alone, independent of your directed' : '';
  // Fallback drain-to-zero narrative (legacy telemetry only; under B curveTgt ≥ floor).
  if (!isB && s.state === 'trimming' && curveTgt <= DUST) {
    return `${dir}. GDI target ${fmt(v.targetCurveSol ?? 0)} ◎ · your directed ${fmt(v.directedSol)} ◎ already exceeds it, so curve → 0.`;
  }
  switch (s.state) {
    case 'building':
      return `${dir}. Your curve-book rarity clears the growth threshold, so the optimiser is building your curve toward your GDI target of ${fmt(curveTgt)} ◎${indep}, gradually as reserve allows.`;
    case 'allocating':
      return `${dir}. Your curve (${fmt(v.curveSol)} ◎) is below your GDI target of ${fmt(curveTgt)} ◎ — the optimiser is allocating ${fmt(s.mag)} ◎ toward it${indep}, gradually as reserve allows (a tight epoch may fund part of it).`;
    case 'trimming':
      return `${dir}. Your curve (${fmt(v.curveSol)} ◎) is ${fmt(s.mag)} ◎ above your GDI target of ${fmt(curveTgt)} ◎ — the optimiser trims it back toward the target${indep}.`;
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
  const ct = s.target;                       // normalised curve target — always shown (matches /curve-allocation)
  const drainToZero = ct < DUST;             // directed ≥ GDI target → curve is all excess (legacy fallback only)
  const dFrac = total > 0 ? v.directedSol / total : 0;
  const cScale = Math.max(curve, ct, 1);
  // teal = building (good), muted = trimming, dim = held
  const deltaTone = s.dir === -1 ? 'var(--teal)' : s.dir === 1 ? 'var(--faint)' : 'var(--dim)';
  // Targets (gradient/curveTargetSol) come from the plan (data.epoch); geo comes from the live
  // index (data.liveEpoch). Stale is PER-VALIDATOR (set by the API): only a validator that changed
  // location since the plan carries a stale gradient/target — for it we SUPPRESS the specific
  // target rather than show a number a partner would act on. A wrong target is worse than no
  // target. An unmoved validator's target is still valid even when the plan epoch is behind.
  const stale = v.stale ?? false;
  // Plan behind the live epoch (but this validator didn't move): its target is still shown, but it
  // was normalised pool-wide at plan time and re-prices a little whenever ANY validator moves — so
  // it's a close guide, exact only as of the plan epoch, not a suppression case.
  const planBehind = data.epoch != null && data.liveEpoch != null && data.epoch < data.liveEpoch;
  // On the live path the numbers are the 15-min live book (no "plan epoch" framing); on the plan
  // fallback they're the last plan's book. `liveStale` = live file 30–120 min old (shown, but the
  // updater may be lagging) — the footnote softens its confidence to match the top banner.
  const isLive = (data.source ?? 'plan') === 'live';
  const liveStale = data.liveTargets?.state === 'stale';
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

        {/* CURVE — current curve vs its normalised target (curveTargetSol); builds/allocates/trims toward it */}
        <div style={{ padding: '24px 26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <div style={LABEL}>Curve stake{stale ? '' : ' — current vs target'}</div>
          </div>

          {stale ? (
            <>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>Current curve</div>
                <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(curve)} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
              </div>
              <p style={{ marginTop: 15, fontSize: 13, color: 'var(--faint)', lineHeight: 1.7 }}>
                Your curve target is <span style={{ color: '#fff' }}>recomputing for epoch {data.liveEpoch}</span>. Your location has changed since the last plan (epoch {data.epoch}), and the target is set by your geographic rarity — so it&apos;s held back until the next plan (usually within a day), because the move can shift your target materially. Your current stake, directed and geo above are live.
              </p>
            </>
          ) : (
            <>
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>Current curve</div>
                  <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(curve)} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
                </div>
                {!drainToZero ? <div style={{ ...SERIF, fontSize: 28, color: 'var(--faint)', lineHeight: 1.4 }}>→</div> : null}
                <div>
                  <div style={{ fontSize: 10.5, color: 'var(--faint)' }}>{drainToZero ? 'GDI target' : 'Target curve'}</div>
                  <div style={{ ...SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1 }}>{fmt(drainToZero ? (v.targetCurveSol ?? 0) : (ct ?? 0))} <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--dim)' }}>◎</span></div>
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
          )}
          {!stale ? <p style={{ marginTop: 15, fontSize: 13, color: 'var(--dim)', lineHeight: 1.7 }}>{steerText(v, s)}</p> : null}
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.7, maxWidth: 860 }}>
        <span style={{ color: 'var(--dim)' }}>Directed</span> (your directed principal + matching) is a protected commitment — it never moves, and it no longer affects your curve. The optimiser ranks and steers your <span style={{ color: 'var(--dim)' }}>curve</span> on the <span style={{ color: 'var(--dim)' }}>curve book alone</span> — independent of directed — toward your own <span style={{ color: 'var(--dim)' }}>GDI target</span> — sized by your marginal contribution to the <span style={{ color: 'var(--dim)' }}>published GDI</span> the pool is ranked on (your country · city · ASN rarity, the same index as your G score above){data.params ? `, shaped to a ${fmt(data.params.minStakeSol)}–${fmt(data.params.maxStakeSol)} ◎ sigmoid` : ''}: below it the optimiser <span style={{ color: 'var(--dim)' }}>allocates</span> stake toward the target (a rare curve-book seat <span style={{ color: 'var(--dim)' }}>builds</span> further, toward the cap); above it your curve is <span style={{ color: 'var(--dim)' }}>trimmed</span> toward the target; at it, <span style={{ color: 'var(--dim)' }}>held</span>. Your total is directed + curve.{data.params?.curveScale != null && data.params.curveScale < 0.99 ? ` Targets are pool-wide normalised (×${data.params.curveScale.toFixed(2)}) so they sum to the available curve.` : ''}{' '}
        {isLive
          ? `This is a live target — what the curve would steer to now, recomputed every 15 minutes${data.ts ? ` (updated ${ago(data.ts)})` : ''}${liveStale ? ', though the updater may be lagging, so it could be slightly behind' : ''}. It is NOT a committed move: the epoch's actual rebalance is gradual, budget-limited, gate-checked and operator-approved, so being above or below target by N does not mean N will move. Because targets are normalised across the whole pool, this figure re-prices slightly whenever any validator's stake or location changes.`
          : `Rebalancing is gradual and operator-approved each epoch. As of plan epoch ${data.epoch ?? '—'}${data.ts ? ` · ${ago(data.ts)}` : ''}${stale ? `; the network is now on epoch ${data.liveEpoch} — your target is held back until the plan catches up (targets track your live location)` : (planBehind ? `; the network is now on epoch ${data.liveEpoch} — this is as of the last plan and, because targets are normalised across the pool, it re-prices slightly whenever any validator moves` : '')}.`}
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
              const stale = v.stale ?? false;   // per-validator: moved since the plan → Δ suppressed
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
                  <td style={{ ...td, color: stale ? 'var(--faint)' : dTone }}>{stale || s.dir === 0 ? '—' : `${s.arrow} ${fmt(s.mag)}`}</td>
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
  // Freshness/source status. On the LIVE path the numbers are the 15-min live book — correct all
  // epoch — so there's no mover banner; we show a small freshness line (and mark it if the updater
  // is lagging). The mover banner + per-validator suppression only apply on the PLAN fallback path
  // (live file missing or >2h old), which the API signals via source==='plan'.
  const source = data?.source ?? 'plan';
  const lt = data?.liveTargets ?? null;
  const anyStale = source === 'plan' && (data?.stale ?? false);

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

        {/* LIVE path — freshness line (+ the load-bearing "not a plan" caveat, visible in Browse too). */}
        {source === 'live' && lt ? (
          lt.state === 'stale' ? (
            <div style={{ ...PANEL, marginTop: 18, padding: '14px 18px', borderLeft: '3px solid #f2b366', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, maxWidth: 860 }}>
              <b style={{ color: '#f2b366' }}>Live targets are {lt.ageMinutes} min old.</b> They refresh every 15 minutes, so the updater may be lagging — treat these as slightly behind. This is what the curve would target now, not a committed move.
            </div>
          ) : (
            <div style={{ ...PANEL, marginTop: 18, padding: '14px 18px', borderLeft: '3px solid var(--teal)', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, maxWidth: 860 }}>
              <b style={{ color: 'var(--teal)' }}>Targets are live.</b> Recomputed from the current book every 15 minutes{lt.ageMinutes != null ? (lt.ageMinutes < 1 ? ', last refreshed moments ago' : `, last refreshed ${lt.ageMinutes} min ago`) : ''} — correct all epoch, not just after a plan. This is what the curve would target <b>now</b>, not a committed move: the epoch&apos;s actual rebalance is smaller — budget-limited, gate-checked and operator-approved, so being N above target doesn&apos;t mean N moves.
            </div>
          )
        ) : null}

        {/* PLAN fallback — live source down (>2h) or absent. */}
        {source === 'plan' && data?.liveTargetsDown ? (
          <div style={{ ...PANEL, marginTop: 18, padding: '14px 18px', borderLeft: '3px solid #f2b366', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, maxWidth: 860 }}>
            <b style={{ color: '#f2b366' }}>Live target figures are temporarily unavailable.</b> Showing the last approved plan{data.planEpoch != null ? ` (epoch ${data.planEpoch})` : ''}, which may lag the current book — the live updater will resume shortly.
          </div>
        ) : null}

        {/* PLAN fallback — a validator moved since that plan (its target is genuinely stale). */}
        {source === 'plan' && data && anyStale ? (
          <div style={{ ...PANEL, marginTop: 18, padding: '14px 18px', borderLeft: '3px solid #f2b366', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.6, maxWidth: 860 }}>
            <b style={{ color: '#f2b366' }}>A validator has moved since the last plan.</b> The last plan is epoch {data.epoch}; the network is on epoch {data.liveEpoch}. A target is set by geographic rarity, so a validator that changed location carries an out-of-date one — <b>those are held back</b> until the next plan. Targets are also normalised across the whole pool, so every other target re-prices slightly when the book changes — the rest are shown <b>as of epoch {data.epoch}</b>, a close guide that&apos;s exact at their plan. Stake, directed and geo here are live.
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
          <Browse rows={rows} onPick={pick} params={data.params} />
        ) : !err ? (
          <p style={{ marginTop: 24, color: 'var(--faint)', fontSize: 13 }}>Loading…</p>
        ) : null}
      </div>
    </section>
  );
}
