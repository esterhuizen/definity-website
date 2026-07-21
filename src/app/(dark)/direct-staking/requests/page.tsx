'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, RefreshCw, Circle, Search, Eye, EyeOff, X } from 'lucide-react';

type Req = {
  signature: string;
  depositor: string;
  validatorVote: string | null;
  validatorName: string | null;
  validatorCity: string | null;
  depositSol: number | null;
  holdingsSol: number;
  plannedMatchSol: number;
  deployedMatchSol: number;
  validatorPoolStakeSol: number;
  status: 'maturing' | 'awaiting' | 'matched' | 'reduced' | 'withdrawn';
  matured: boolean;
  maturesInHours: number;
  blockTime: number | null;
  slot: number;
};
type Data = {
  generatedAt: string;
  nav: number;
  retailMultiple: number;
  sleeveCapSol: number;
  deployment: { live: boolean; plannedSol: number; deployedSol: number; deployedPct: number };
  totals: {
    requests: number;
    wallets: number;
    depositedSol: number;
    plannedSol: number;
    deployedSol: number;
    sleeveUsedPct: number;
    matched: number;
    awaiting: number;
    maturing: number;
    reduced: number;
    withdrawn: number;
  };
  requests: Req[];
};

const short = (a: string | null) => (a ? `${a.slice(0, 4)}…${a.slice(-4)}` : '—');
const fmt = (n: number, d = 2) => n.toLocaleString('en-US', { maximumFractionDigits: d });

function ago(t: number | null): string {
  if (!t) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - t));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const STATUS: Record<Req['status'], { label: string; cls: string }> = {
  maturing: { label: 'Maturing', cls: 'bg-sunrise-300/15 text-sunrise-300' },
  awaiting: { label: 'Awaiting match', cls: 'bg-ink/10 text-ink' },
  matched: { label: 'Matched', cls: 'bg-success/15 text-success' },
  reduced: { label: 'Reduced', cls: 'bg-ring/40 text-ink-muted' },
  withdrawn: { label: 'Withdrawn', cls: 'bg-ring/40 text-ink-dim' },
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-ink-dim">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-ink-dim">{sub}</div> : null}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex min-w-[170px] flex-1 items-center gap-2 rounded-lg border border-ring bg-bg-muted/40 px-3 py-1.5">
      <Search className="h-3.5 w-3.5 shrink-0 text-ink-dim" aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim"
      />
      {value ? (
        <button type="button" aria-label="Clear" onClick={() => onChange('')} className="shrink-0 text-ink-dim hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </label>
  );
}

export default function DirectStakeRequestsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number>(0);

  // Filters — active-only by default; withdrawn (superseded/exited) hidden.
  const [depQ, setDepQ] = useState('');
  const [valQ, setValQ] = useState('');
  const [showWithdrawn, setShowWithdrawn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/direct-stake/requests', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Data);
      setErr(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  const t = data?.totals;
  const dep = data?.deployment;
  const pct = dep ? Math.min(100, dep.deployedPct) : 0;
  const withdrawnCount = t?.withdrawn ?? 0;

  const visible = useMemo(() => {
    const dq = depQ.trim().toLowerCase();
    const vq = valQ.trim().toLowerCase();
    return (data?.requests ?? []).filter((r) => {
      if (!showWithdrawn && r.status === 'withdrawn') return false;
      if (dq && !r.depositor.toLowerCase().includes(dq)) return false;
      if (vq) {
        const hay = `${r.validatorName ?? ''} ${r.validatorVote ?? ''} ${r.validatorCity ?? ''}`.toLowerCase();
        if (!hay.includes(vq)) return false;
      }
      return true;
    });
  }, [data, depQ, valQ, showWithdrawn]);

  const planSub = t
    ? [t.matched ? `${t.matched} matched` : '', t.awaiting ? `${t.awaiting} awaiting` : '', t.maturing ? `${t.maturing} maturing` : '', t.reduced ? `${t.reduced} reduced` : '']
        .filter(Boolean)
        .join(' · ') || undefined
    : undefined;
  const filtering = depQ.trim() !== '' || valQ.trim() !== '' || showWithdrawn;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:py-14">
      {/* Header — on the dark canvas, so light text */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <Circle className="h-2 w-2 fill-success text-success" aria-hidden="true" />
            Live · directed-stake
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">Direct-stake requests</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/70">
            On-chain <span className="font-mono">direct:</span> stakes into definSOL, with live holdings.{' '}
            <span className="text-white">Planned</span> = the directed target: the staker&apos;s own 1× stake (directed next cycle) plus up to{' '}
            {data?.retailMultiple ?? 3.5}× matching once a stake has been held a full epoch (the trailing-minimum anti-gaming basis) — up
            to 4.5× total. <span className="text-white">Deployed</span> = pool stake actually placed on-chain.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5 text-sm text-white/70 transition hover:border-white/40 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {updatedAt ? `Updated ${ago(Math.floor(updatedAt / 1000))}` : 'Refresh'}
        </button>
      </div>

      {err ? (
        <p className="mt-6 rounded-lg border border-fuchsia-600/40 bg-fuchsia-600/10 px-4 py-3 text-sm text-fuchsia-300">
          Could not load: {err}
        </p>
      ) : null}

      {/* Deployment status bar — PLANNED vs DEPLOYED */}
      <div className="surface mt-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-ink-dim">Directed stake · planned vs deployed</div>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${dep?.live ? 'bg-success/15 text-success' : 'bg-sunrise-300/20 text-sunrise-300'}`}>
            {dep?.live ? 'Live' : 'Pending go-live'}
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-3xl font-semibold text-ink">{dep ? fmt(dep.deployedSol) : '—'}</span>
          <span className="text-ink-dim">/ {dep ? fmt(dep.plannedSol) : '—'} ◎ deployed</span>
          <span className="ml-auto font-mono text-sm text-ink-muted">{dep ? `${dep.deployedPct}%` : ''}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ring/40">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
        </div>
        {dep?.live && dep.deployedSol < 1e-9 ? (
          <p className="mt-3 text-xs text-ink-dim">
            The directed-stake program is <span className="text-success">live</span>. Eligible matching deploys on the next optimiser
            cycle — each cycle is operator-approved before any pool stake is directed, so this fills in right after the first approval.
          </p>
        ) : !dep?.live ? (
          <p className="mt-3 text-xs text-ink-dim">Matching is computed but <span className="text-ink-muted">not yet deployed</span>.</p>
        ) : null}
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requests" value={t ? String(t.requests) : '—'} sub={t ? `${t.wallets} wallet${t.wallets === 1 ? '' : 's'}` : undefined} />
        <Stat label="Staked" value={t ? `${fmt(t.depositedSol)} ◎` : '—'} sub={data ? `NAV ${data.nav}` : undefined} />
        <Stat label="Planned directed" value={t ? `${fmt(t.plannedSol)} ◎` : '—'} sub={planSub} />
        <Stat label="Sleeve used" value={t ? `${t.sleeveUsedPct}%` : '—'} sub={data ? `${fmt(t?.plannedSol ?? 0)} / ${fmt(data.sleeveCapSol, 0)} ◎` : undefined} />
      </div>

      {/* Filters */}
      <div className="surface mt-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <SearchInput value={depQ} onChange={setDepQ} placeholder="Filter staker…" />
          <SearchInput value={valQ} onChange={setValQ} placeholder="Filter validator (name, city, vote)…" />
        </div>
        <button
          type="button"
          onClick={() => setShowWithdrawn((v) => !v)}
          aria-pressed={showWithdrawn}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition ${
            showWithdrawn ? 'border-ink/25 bg-ink/5 text-ink' : 'border-ring text-ink-muted hover:text-ink'
          }`}
        >
          {showWithdrawn ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
          {showWithdrawn ? 'Hide' : 'Show'} withdrawn ({withdrawnCount})
        </button>
        <span className="shrink-0 font-mono text-xs text-ink-dim">
          {data ? `${visible.length} of ${t?.requests ?? 0}` : ''}
        </span>
      </div>

      {/* Table */}
      <div className="surface mt-3 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-ring text-left text-[11px] uppercase tracking-[0.12em] text-ink-dim">
                <th className="px-4 py-3 font-medium">Staker</th>
                <th className="px-4 py-3 font-medium">Validator</th>
                <th className="px-4 py-3 text-right font-medium">Staked</th>
                <th className="px-4 py-3 text-right font-medium">Held now</th>
                <th className="px-4 py-3 text-right font-medium">Planned</th>
                <th className="px-4 py-3 text-right font-medium">Deployed</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Age</th>
                <th className="px-4 py-3 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((r) => (
                  <tr key={r.signature} className="border-b border-ring/50 last:border-0">
                    <td className="px-4 py-3">
                      <a className="font-mono text-ink hover:underline" href={`https://solscan.io/account/${r.depositor}`} target="_blank" rel="noreferrer">
                        {short(r.depositor)}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <a className="text-ink hover:underline" href={`https://solscan.io/account/${r.validatorVote}`} target="_blank" rel="noreferrer">
                        {r.validatorName || short(r.validatorVote)}
                      </a>
                      <div className="font-mono text-[11px] text-ink-dim">
                        {short(r.validatorVote)}
                        {r.validatorCity ? ` · ${r.validatorCity}` : ''}
                        {r.validatorPoolStakeSol ? ` · pool ${fmt(r.validatorPoolStakeSol, 0)} ◎` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-ink">{fmt(r.depositSol ?? 0)} ◎</td>
                    <td className="px-4 py-3 text-right font-mono text-ink-muted">{fmt(r.holdingsSol)} ◎</td>
                    <td className="px-4 py-3 text-right font-mono text-ink">{fmt(r.plannedMatchSol)} ◎</td>
                    <td className={`px-4 py-3 text-right font-mono ${r.deployedMatchSol > 1e-3 ? 'text-success' : 'text-ink-dim'}`}>
                      {r.deployedMatchSol > 1e-3 ? `${fmt(r.deployedMatchSol)} ◎` : r.status === 'withdrawn' ? '—' : '— pending'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[r.status].cls}`}>
                        {STATUS[r.status].label}
                      </span>
                      {r.status === 'maturing' && r.maturesInHours > 0 ? (
                        <div className="mt-0.5 text-[10px] text-ink-dim">~{r.maturesInHours}h to match</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-dim">{ago(r.blockTime)}</td>
                    <td className="px-4 py-3">
                      <a className="inline-flex items-center gap-0.5 text-ink-dim hover:text-ink" href={`https://solscan.io/tx/${r.signature}`} target="_blank" rel="noreferrer">
                        {short(r.signature)} <ArrowUpRight className="h-3 w-3" />
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-dim">
                    {!data
                      ? 'Loading…'
                      : (data.requests.length && filtering)
                        ? 'No requests match your filters.'
                        : 'No direct-stake requests yet. New stakes appear here within ~5 min of the stake.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 text-center text-[11px] text-white/40">
        Source of truth is on-chain. Planned = 1× principal + up to {data?.retailMultiple ?? 3.5}× matching (recency-backed, up to 4.5×).
        Deployed = the optimiser&apos;s directed deployments. Withdrawn = a stake superseded by a more-recent one or fully exited.
        Auto-refreshes every 15s.
      </p>
    </div>
  );
}
