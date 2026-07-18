'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useSelectedWalletAccount, useSignAndSendTransaction } from '@solana/react';
import { getBase58Decoder } from '@solana/kit';
import { Copy, Check } from 'lucide-react';
import { SOLANA_CHAIN, DEFINSOL_MINT, DEFINSOL_DECIMALS, SOL_MINT, SOL_DECIMALS } from '@/lib/solana/constants';
import { quoteSwap, quoteOut, buildSwapTransaction, toBaseUnits, type JupiterQuote } from '@/lib/solana/jupiter';
import { errMsg } from '@/lib/solana/unstake';
import { waitForConfirmation } from '@/lib/solana/rpc';

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
  principalSol: number;
  matchedPlannedSol: number;
  pendingMatchSol: number;
  pendingWaves: { hours: number; matchSol: number }[];
  directedTotalSol: number;
  matchedDeployedSol: number;
  allMatured: boolean;
};
type Balance = {
  positions: Position[];
  totals: { directedDefinsol: number; directedValueSol: number; principalSol: number; matchedPlannedSol: number; pendingMatchSol: number; directedTotalSol: number; matchedDeployedSol: number };
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

// On-site unstake: redeem definSOL → SOL, signed in the user's own wallet, right
// here — no redirect to jup.ag. Same Jupiter routing under the hood as the embed
// widget, presented in our own UI, via the SAME quoteSwap + buildSwapTransaction
// position's unstakable amount.
type USub = { k: 'idle' } | { k: 'signing' } | { k: 'done'; sig: string } | { k: 'error'; m: string };

function UnstakeInline({
  account, maxDefinsol, onDone,
}: {
  account: UiWalletAccount;
  maxDefinsol: number;
  onDone: () => void;
}) {
  // Identical wiring to the main StakeWidget's unstake (the proven mobile path):
  // quoteSwap + buildSwapTransaction from lib/solana/jupiter, no cast on account.
  const signAndSend = useSignAndSendTransaction(account, SOLANA_CHAIN);
  const [amount, setAmount] = useState(maxDefinsol > 0 ? String(Number(maxDefinsol.toFixed(6))) : '');
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [sub, setSub] = useState<USub>({ k: 'idle' });
  const amt = Number(amount);
  const out = quote ? quoteOut(quote, SOL_DECIMALS) : null;

  useEffect(() => {
    if (!(amt > 0)) { setQuote(null); setQuoting(false); return; }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(() => {
      quoteSwap(DEFINSOL_MINT, SOL_MINT, toBaseUnits(amount, DEFINSOL_DECIMALS))
        .then((q) => { if (alive) { setQuote(q); setQuoting(false); } })
        .catch(() => { if (alive) { setQuote(null); setQuoting(false); } });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [amount, amt]);

  const can = amt > 0 && amt <= maxDefinsol + 1e-9 && !!quote && sub.k !== 'signing';

  async function submit() {
    if (!quote) return;
    try {
      setSub({ k: 'signing' });
      const bytes = await buildSwapTransaction(quote, account.address);
      const { signature } = await signAndSend({ transaction: bytes });
      const sig = getBase58Decoder().decode(signature);
      setSub({ k: 'done', sig });
      void waitForConfirmation(sig).then(onDone).catch(() => {});
    } catch (e) {
      console.error('[unstake] failed', e);
      setSub({ k: 'error', m: errMsg(e) });
    }
  }

  if (sub.k === 'done') {
    return (
      <div className="mt-3 rounded-lg border border-success/40 bg-success/10 px-3 py-3 text-xs">
        <div className="font-medium text-ink">✓ Unstaked {fmt(amt, 4)} definSOL → SOL</div>
        <a href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-ink-dim underline hover:text-ink">
          View transaction →
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-ring bg-bg-muted/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-ink-dim">Amount to unstake</span>
        <button type="button" className="text-xs text-sunrise-500 hover:underline" onClick={() => setAmount(String(Number(maxDefinsol.toFixed(6))))}>
          Max {fmt(maxDefinsol, 4)}
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-ring bg-bg px-3 py-2">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0.0"
          className="w-full bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-dim"
        />
        <span className="shrink-0 text-xs text-ink-dim">definSOL</span>
      </div>
      <div className="mt-1 min-h-4 text-xs text-ink-dim">
        {quoting ? 'Fetching rate…' : out != null ? `≈ ${fmt(out, 4)} SOL` : 'Redeemed at the best market rate, into your wallet.'}
      </div>
      <button
        type="button"
        disabled={!can}
        onClick={submit}
        className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sub.k === 'signing' ? 'Confirm in your wallet…' : 'Unstake to SOL'}
      </button>
      {sub.k === 'error' ? <div className="mt-2 break-words text-xs text-fuchsia-600">Failed: {sub.m}</div> : null}
    </div>
  );
}

export function MyDirectStakeBalance() {
  const [selected] = useSelectedWalletAccount();
  const wallet = selected?.address;
  const [data, setData] = useState<Balance | null>(null);
  const [meta, setMeta] = useState<Map<string, Meta>>(new Map());
  const [loading, setLoading] = useState(false);
  const [unstakingVote, setUnstakingVote] = useState<string | null>(null);

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
                  <button
                    type="button"
                    disabled={p.unstakableDefinsol <= 0}
                    onClick={() => setUnstakingVote((v) => (v === p.vote ? null : p.vote))}
                    className="shrink-0 rounded-full border border-ring bg-bg px-4 py-2 text-sm font-medium text-ink transition hover:border-ink-dim hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {unstakingVote === p.vote ? 'Close' : 'Unstake'}
                  </button>
                </div>

                {unstakingVote === p.vote && selected ? (
                  <UnstakeInline
                    account={selected}
                    maxDefinsol={p.unstakableDefinsol}
                    onDone={() => { setUnstakingVote(null); load(); }}
                  />
                ) : null}

                {/* Directed to this validator: the user's own 1× principal (next cycle)
                    plus the matching uplift, which vests per-tranche after each deposit
                    has been held a full lookback window (~1 epoch of duration). */}
                <div className="mt-3 space-y-1 rounded-lg bg-success/10 px-3 py-2 text-xs leading-relaxed">
                  <div className="text-ink">Up to <b>{fmt(p.directedTotalSol, 2)} SOL</b> to your validator <span className="text-ink-dim">— your 1× + up to 3.5× matching</span></div>
                  {p.principalSol > 0 ? (
                    <div className="text-ink-dim">• <b className="text-ink">{fmt(p.principalSol, 2)} SOL</b> your stake — directs on the next cycle</div>
                  ) : null}
                  {p.matchedDeployedSol > 0 ? (
                    <div className="text-success">• ✓ <b>{fmt(p.matchedDeployedSol, 2)} SOL</b> matching directed by Definity</div>
                  ) : p.matchedPlannedSol > 0 ? (
                    <div className="text-ink-dim">• <b className="text-ink">{fmt(p.matchedPlannedSol, 2)} SOL</b> matching — directs on the next cycle</div>
                  ) : null}
                  {p.pendingWaves.map((w) => (
                    <div key={w.hours} className="text-ink-dim">• <b className="text-ink">{fmt(w.matchSol, 2)} SOL</b> matching — after a full epoch (~{w.hours}h)</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {t.directedTotalSol > 0 && (
          <div className="mt-4 flex items-center justify-between px-1 text-xs text-ink-dim">
            <span>Directed to your validators</span>
            <span className="font-mono">up to {fmt(t.directedTotalSol, 2)} SOL <span className="text-ink-dim">(1× + up to 3.5× match)</span></span>
          </div>
        )}
      </div>

      <p className="mt-3 text-center font-mono text-xs text-ink-dim">
        Unstake redeems definSOL → SOL at the best market rate, signed in your own wallet.
      </p>
    </div>
  );
}
