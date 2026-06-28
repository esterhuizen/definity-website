'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSelectedWalletAccount } from '@solana/react';
import { Copy, Check, ArrowUpRight } from 'lucide-react';

const DEFINSOL_MINT = 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';
// Memo-model LST is liquid and not locked to the validator, so "unstake" = redeem
// definSOL, which already exists via the ecosystem (item 4) — route there rather
// than build a native unstake.
const redeemHref = `https://jup.ag/swap/${DEFINSOL_MINT}-${WSOL_MINT}`;

const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;
const fmt = (n: number, d = 5) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

type Position = {
  vote: string;
  name: string | null;
  city: string | null;
  directedDefinsol: number;
  directedValueSol: number;
  unstakableDefinsol: number;
  unstakableValueSol: number;
  matchedPlannedSol: number;
  pendingMatchSol: number;
  pendingWaves: { hours: number; matchSol: number }[];
  matchedDeployedSol: number;
  allMatured: boolean;
};
type Balance = {
  positions: Position[];
  totals: { directedDefinsol: number; directedValueSol: number; matchedPlannedSol: number; pendingMatchSol: number; matchedDeployedSol: number };
  matchingLive: boolean;
};
type Meta = { vote: string; image: string | null; country: string | null; city: string | null; name: string | null };

function CopyVote({ vote }: { vote: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(vote); setDone(true); setTimeout(() => setDone(false), 1200); }}
      className="ml-1 inline-flex items-center text-ink-dim transition hover:text-ink"
      aria-label="Copy vote account"
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Amount({ definsol, sol }: { definsol: number; sol: number }) {
  return (
    <div>
      <div className="font-mono text-base font-semibold text-ink">{fmt(definsol)} <span className="text-sm font-normal text-ink-dim">definSOL</span></div>
      <div className="font-mono text-xs text-ink-dim">{fmt(sol)} SOL</div>
    </div>
  );
}

export function MyDirectStakeBalance() {
  const [selected] = useSelectedWalletAccount();
  const wallet = selected?.address;
  const [data, setData] = useState<Balance | null>(null);
  const [meta, setMeta] = useState<Map<string, Meta>>(new Map());
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!wallet) { setData(null); return; }
    setLoading(true);
    try {
      const [bRes, vRes] = await Promise.all([
        fetch(`/api/direct-stake/balance?wallet=${wallet}`, { cache: 'no-store' }),
        meta.size ? Promise.resolve(null) : fetch('/validators.json', { cache: 'force-cache' }),
      ]);
      if (vRes) {
        const v = await vRes.json();
        setMeta(new Map((v?.validators ?? []).map((x: Meta) => [x.vote, x])));
      }
      setData(await bRes.json());
    } catch { /* keep prior */ } finally { setLoading(false); }
  }, [wallet, meta]);

  useEffect(() => { load(); }, [load]);

  if (!wallet) return null;
  if (loading && !data) return <div className="mx-auto mt-6 max-w-md text-center font-mono text-sm text-ink-dim">Loading your direct stake…</div>;
  if (!data || data.positions.length === 0) return null;

  const t = data.totals;

  return (
    <div className="mx-auto mt-10 w-full max-w-lg">
      <h3 className="mb-4 text-center font-display text-xl font-semibold text-ink">My Direct Stake Balance</h3>

      <div className="rounded-2xl border border-ring bg-bg-muted/60 p-5">
        {/* Total */}
        <div className="flex items-start justify-between px-1 pb-4">
          <span className="text-sm font-medium text-ink">Total Direct Stake</span>
          <div className="text-right">
            <div className="font-mono text-lg font-semibold text-ink">{fmt(t.directedDefinsol)} definSOL</div>
            <div className="font-mono text-xs text-ink-dim">{fmt(t.directedValueSol)} SOL</div>
          </div>
        </div>

        <div className="space-y-3">
          {data.positions.map((p) => {
            const m = meta.get(p.vote);
            const name = p.name || m?.name || short(p.vote);
            const loc = [m?.country, m?.city || p.city].filter(Boolean).join(', ');
            return (
              <div key={p.vote} className="rounded-xl border border-ring bg-bg p-4">
                {/* validator header */}
                <div className="flex items-center gap-3">
                  {m?.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.image} alt="" className="h-10 w-10 shrink-0 rounded-full" />
                    : <span className="h-10 w-10 shrink-0 rounded-full bg-ring" aria-hidden="true" />}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{name}</div>
                    <div className="flex items-center truncate font-mono text-xs text-ink-dim">
                      {loc ? <span className="mr-2">{loc}</span> : null}
                      <span>{short(p.vote)}</span>
                      <CopyVote vote={p.vote} />
                    </div>
                  </div>
                </div>

                <div className="my-3 h-px bg-ring" />

                {/* amounts + action */}
                <div className="flex items-end justify-between gap-3">
                  <div className="flex gap-8">
                    <div>
                      <div className="mb-1 text-xs text-ink-dim">Direct Stake</div>
                      <Amount definsol={p.directedDefinsol} sol={p.directedValueSol} />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-ink-dim">Unstakable</div>
                      <Amount definsol={p.unstakableDefinsol} sol={p.unstakableValueSol} />
                    </div>
                  </div>
                  <a
                    href={redeemHref}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full border border-ring bg-bg px-4 py-2 text-sm font-medium text-ink transition hover:border-ink-dim hover:bg-bg-muted"
                  >
                    Unstake
                  </a>
                </div>

                {/* matched-by-Definity — each tranche vests when IT has been held a full
                    lookback window (~1 epoch of duration), so different deposits show
                    different countdowns. */}
                <div className="mt-3 space-y-1 rounded-lg bg-success/10 px-3 py-2 text-xs leading-relaxed">
                  {p.matchedDeployedSol > 0 ? (
                    <div className="text-success">✓ <b>{fmt(p.matchedDeployedSol, 2)} SOL</b> matched &amp; directed by Definity.</div>
                  ) : p.matchedPlannedSol > 0 ? (
                    <div className="text-ink-dim"><b className="text-ink">{fmt(p.matchedPlannedSol, 2)} SOL</b> eligible — directs on the next optimiser cycle.</div>
                  ) : null}
                  {p.pendingWaves.map((w) => (
                    <div key={w.hours} className="text-ink-dim">
                      <b className="text-ink">{fmt(w.matchSol, 2)} SOL</b> — eligible once that stake completes a full epoch (~{w.hours}h).
                    </div>
                  ))}
                  {p.matchedDeployedSol <= 0 && p.matchedPlannedSol <= 0 && p.pendingWaves.length === 0 ? (
                    <div className="text-ink-dim">Matching begins once this deposit completes a full epoch.</div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {(t.matchedPlannedSol > 0 || t.pendingMatchSol > 0) && (
          <div className="mt-4 flex items-center justify-between px-1 text-xs text-ink-dim">
            <span>Matched by Definity</span>
            <span className="font-mono">
              {t.matchedPlannedSol > 0 || data.matchingLive
                ? `${fmt(data.matchingLive ? t.matchedDeployedSol : t.matchedPlannedSol, 2)} SOL${t.pendingMatchSol > 0 ? ` (+${fmt(t.pendingMatchSol, 2)} maturing)` : ''}`
                : `${fmt(t.pendingMatchSol, 2)} SOL maturing`}
            </span>
          </div>
        )}
      </div>

      <a href={redeemHref} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-center gap-1 font-mono text-xs text-ink-dim transition hover:text-ink">
        Unstake routes via the Sanctum/Jupiter ecosystem <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}
