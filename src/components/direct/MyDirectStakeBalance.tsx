'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useSelectedWalletAccount, useSignAndSendTransaction, useSignTransaction } from '@solana/react';
import { getBase58Decoder } from '@solana/kit';
import { Copy, Check } from 'lucide-react';
import { SOLANA_CHAIN, DEFINSOL_MINT, DEFINSOL_DECIMALS, SOL_MINT, SOL_DECIMALS } from '@/lib/solana/constants';
import { quoteSwap, quoteOut, buildSwapTransaction, toBaseUnits, type JupiterQuote } from '@/lib/solana/jupiter';
import { errMsg } from '@/lib/solana/unstake';
import { waitForSignatureOutcome, getDefinsolBalance } from '@/lib/solana/rpc';
import { submitSignedTx } from '@/lib/solana/deposit-squads';

// FLOOR to 6 decimals, never round. toFixed()/r6() round half-up, so a
// prefill from the balance API can land a few lamports ABOVE the true wallet
// balance — the swap then tries to sell definSOL the wallet doesn't have and
// the wallet's simulation fails ("can't predict balance changes"). Flooring
// keeps the amount at or below the real balance. (Same fix the StakeWidget made.)
const floor6 = (n: number) => (Math.floor(n * 1e6) / 1e6).toFixed(6).replace(/\.?0+$/, '');

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
// 'done' renders only after on-chain confirmation and carries a frozen snapshot
// of the unstaked amount (the live field could be edited during the wait).
type USub =
  | { k: 'idle' } | { k: 'signing' }
  | { k: 'confirming'; sig: string }
  | { k: 'done'; sig: string; amt: number }
  | { k: 'timeout'; sig: string }
  | { k: 'error'; m: string; sig?: string };

function UnstakeInline({
  account, maxDefinsol, onDone, onBusy,
}: {
  account: UiWalletAccount;
  maxDefinsol: number;
  onDone: () => void;
  // Lets the parent lock this row's Unstake/Close toggle mid-confirmation —
  // closing would unmount this panel, drop the in-flight outcome, and reopen
  // a fresh form primed for a duplicate submit.
  onBusy?: (b: boolean) => void;
}) {
  // Identical wiring to the main StakeWidget's unstake (the proven mobile path):
  // quoteSwap + buildSwapTransaction from lib/solana/jupiter, no cast on account.
  const signAndSend = useSignAndSendTransaction(account, SOLANA_CHAIN);
  // The hard cap is the REAL on-chain definSOL balance, not the balance API's
  // rounded per-position figure (which can exceed it by a few lamports).
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const usableMax = walletBal != null ? Math.min(maxDefinsol, walletBal) : maxDefinsol;
  const [amount, setAmount] = useState(maxDefinsol > 0 ? floor6(maxDefinsol) : '');
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [sub, setSub] = useState<USub>({ k: 'idle' });
  const [requote, setRequote] = useState(0); // bumped on failed/timeout: retry must not reuse a stale route
  const amt = Number(amount);
  const out = quote ? quoteOut(quote, SOL_DECIMALS) : null;

  // Fetch the true balance and re-floor the prefill to it (matches StakeWidget).
  useEffect(() => {
    let alive = true;
    getDefinsolBalance(account.address).then((b) => {
      if (!alive) return;
      setWalletBal(b);
      setAmount((cur) => (cur === '' || Number(cur) > b ? floor6(Math.min(maxDefinsol, b)) : cur));
    }).catch(() => {});
    return () => { alive = false; };
  }, [account.address, maxDefinsol]);

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
  }, [amount, amt, requote]);

  const can = amt > 0 && amt <= usableMax + 1e-9 && !!quote && sub.k !== 'signing' && sub.k !== 'confirming';

  async function submit() {
    if (!quote) return;
    try {
      const staked = amt; // frozen: the field stays live during confirmation
      setSub({ k: 'signing' });
      onBusy?.(true);
      const bytes = await buildSwapTransaction(quote, account.address);
      const { signature } = await signAndSend({ transaction: bytes });
      const sig = getBase58Decoder().decode(signature);
      // "Unstaked" renders only once confirmed; one outcome poll drives both
      // the banner and the balance-card refresh (was two duplicate loops).
      setSub({ k: 'confirming', sig });
      const outcome = await waitForSignatureOutcome(sig);
      if (outcome === 'confirmed') {
        // Banner only — the refresh happens when the user dismisses it. An
        // immediate dispatch made the parent refetch, zero out this position,
        // and unmount the banner (evidence + Solscan link) within seconds.
        setSub({ k: 'done', sig, amt: staked });
      } else if (outcome === 'failed') {
        setSub({ k: 'error', sig, m: 'The transaction failed on-chain — nothing was unstaked (only the network fee was spent).' });
        setQuote(null);
        setRequote((n) => n + 1);
        // Nothing landed → position unchanged → the refetch can't unmount this
        // panel; the card must show current data next to the failure message.
        window.dispatchEvent(new CustomEvent('definity:direct-staked'));
      } else {
        // Timeout: the tx may yet land. Do NOT refresh here — a refetch that
        // zeroes this position would unmount the card and take the "check this
        // transaction" warning + Solscan link with it, which is the one thing
        // the user needs on a timeout. The card stays until they act on it.
        setSub({ k: 'timeout', sig });
        setQuote(null);
        setRequote((n) => n + 1);
      }
    } catch (e) {
      console.error('[unstake] failed', e);
      setSub({ k: 'error', m: errMsg(e) });
    } finally {
      onBusy?.(false);
    }
  }

  if (sub.k === 'done') {
    return (
      <div className="mt-3 rounded-lg border border-success/40 bg-success/10 px-3 py-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-ink">✓ Unstaked {fmt(sub.amt, 4)} definSOL → SOL</span>
          <button
            type="button"
            className="text-ink-dim underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              // Refresh (with the +4s registry-latency retry) and close the panel.
              window.dispatchEvent(new CustomEvent('definity:direct-staked'));
              onDone();
            }}
          >Done</button>
        </div>
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
        <button type="button" className="text-xs text-sunrise-500 hover:underline" onClick={() => setAmount(floor6(usableMax))}>
          Max {fmt(usableMax, 4)}
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
        {sub.k === 'signing' ? 'Confirm in your wallet…' : sub.k === 'confirming' ? 'Confirming on-chain…' : 'Unstake to SOL'}
      </button>
      {sub.k === 'timeout' ? (
        <div className="mt-2 break-words text-xs text-sunrise-500">
          Still unconfirmed — check{' '}
          <a className="underline" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">the transaction</a>{' '}
          before retrying so you don&apos;t unstake twice.
        </div>
      ) : null}
      {sub.k === 'error' ? (
        <div className="mt-2 break-words text-xs text-fuchsia-600">
          Failed: {sub.m}
          {sub.sig ? <> <a className="underline" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">Details</a></> : null}
        </div>
      ) : null}
    </div>
  );
}

// Multisig exit: build the same Jupiter definSOL→SOL swap with the vault as signer,
// hand it to signTransaction — which a Squad turns into a vault-transaction PROPOSAL
// — and submit the proposal-create tx. The swap executes when the Squad approves;
// the route is quoted at proposal time, so a much-later execution may slip and need
// re-proposing (definSOL↔SOL is a stable pair, so this is rare). Mounted only for a
// sign-only wallet, so useSignTransaction never runs for a regular one.
function MultisigUnstakeInline({ account, maxDefinsol, onBusy }: { account: UiWalletAccount; maxDefinsol: number; onBusy?: (b: boolean) => void }) {
  const signTransaction = useSignTransaction(account, SOLANA_CHAIN);
  const [walletBal, setWalletBal] = useState<number | null>(null);
  const usableMax = walletBal != null ? Math.min(maxDefinsol, walletBal) : maxDefinsol;
  const [amount, setAmount] = useState(maxDefinsol > 0 ? floor6(maxDefinsol) : '');
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [sub, setSub] = useState<
    | { k: 'idle' } | { k: 'signing' }
    | { k: 'confirming'; sig: string }
    | { k: 'proposed'; sig: string; amt: number } // frozen snapshot; renders only after confirmation
    | { k: 'timeout'; sig: string }
    | { k: 'error'; m: string; sig?: string }
  >({ k: 'idle' });
  const [requote, setRequote] = useState(0); // bumped on failed/timeout: a retry must not reuse a known-failed route
  const amt = Number(amount);
  const out = quote ? quoteOut(quote, SOL_DECIMALS) : null;

  useEffect(() => {
    let alive = true;
    getDefinsolBalance(account.address).then((b) => {
      if (!alive) return;
      setWalletBal(b);
      setAmount((cur) => (cur === '' || Number(cur) > b ? floor6(Math.min(maxDefinsol, b)) : cur));
    }).catch(() => {});
    return () => { alive = false; };
  }, [account.address, maxDefinsol]);

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
  }, [amount, amt, requote]);

  const can = amt > 0 && amt <= usableMax + 1e-9 && !!quote && sub.k !== 'signing' && sub.k !== 'confirming';

  async function submit() {
    if (!quote) return;
    try {
      const staked = amt; // frozen: the field stays live during confirmation
      setSub({ k: 'signing' });
      onBusy?.(true);
      const bytes = await buildSwapTransaction(quote, account.address);
      const { signedTransaction } = await signTransaction({ transaction: bytes });
      const sig = await submitSignedTx(signedTransaction);
      // "Proposal created" only after the proposal-create tx confirms — a
      // failed create means NO proposal exists in the Squad.
      setSub({ k: 'confirming', sig });
      const outcome = await waitForSignatureOutcome(sig);
      if (outcome === 'confirmed') {
        setSub({ k: 'proposed', sig, amt: staked });
      } else if (outcome === 'failed') {
        setSub({ k: 'error', sig, m: 'The transaction failed on-chain — no proposal was created (only the network fee was spent).' });
        setQuote(null);
        setRequote((n) => n + 1);
      } else {
        setSub({ k: 'timeout', sig });
        setQuote(null);
        setRequote((n) => n + 1);
      }
    } catch (e) {
      console.error('[unstake-proposal] failed', e);
      setSub({ k: 'error', m: errMsg(e) });
    } finally {
      onBusy?.(false);
    }
  }

  if (sub.k === 'proposed') {
    return (
      <div className="mt-3 rounded-lg border border-sunrise-300/40 bg-sunrise-300/10 px-3 py-3 text-xs">
        <div className="font-medium text-ink">Unstake proposal created</div>
        <p className="mt-1 leading-relaxed text-ink-muted">
          Swapping {fmt(sub.amt, 4)} definSOL → SOL is now a proposal in your Squad. Open Squads and{' '}
          <strong className="text-ink">approve + execute it soon</strong> — the route is quoted now. SOL lands in your vault.
        </p>
        <a href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-ink-dim underline hover:text-ink">
          View proposal transaction →
        </a>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-ring bg-bg-muted/40 p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs text-ink-dim">Amount to unstake</span>
        <button type="button" className="text-xs text-sunrise-500 hover:underline" onClick={() => setAmount(floor6(usableMax))}>
          Max {fmt(usableMax, 4)}
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
        {quoting ? 'Fetching rate…' : out != null ? `≈ ${fmt(out, 4)} SOL · forms a Squads proposal` : 'Redeemed at the best market rate, into your vault, via a Squads proposal.'}
      </div>
      <button
        type="button"
        disabled={!can}
        onClick={submit}
        className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {sub.k === 'signing' ? 'Forming proposal…' : sub.k === 'confirming' ? 'Confirming on-chain…' : 'Create unstake proposal'}
      </button>
      {sub.k === 'timeout' ? (
        <div className="mt-2 break-words text-xs text-sunrise-500">
          Still unconfirmed — check{' '}
          <a className="underline" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">the transaction</a>{' '}
          before retrying so you don&apos;t create two proposals.
        </div>
      ) : null}
      {sub.k === 'error' ? (
        <div className="mt-2 break-words text-xs text-fuchsia-600">
          Failed: {sub.m}
          {sub.sig ? <> <a className="underline" href={`https://solscan.io/tx/${sub.sig}`} target="_blank" rel="noreferrer">Details</a></> : null}
        </div>
      ) : null}
    </div>
  );
}

export function MyDirectStakeBalance() {
  const [selected] = useSelectedWalletAccount();
  // A multisig (SquadsX) can't sign-and-send, so the Jupiter-swap unstake path
  // (UnstakeInline → useSignAndSendTransaction) would throw. Detect it and show a
  // vault-exit note instead of mounting that hook.
  const isMultisig = selected ? !selected.features.includes('solana:signAndSendTransaction') : false;
  const wallet = selected?.address;
  const [data, setData] = useState<Balance | null>(null);
  const [meta, setMeta] = useState<Map<string, Meta>>(new Map());
  const [loading, setLoading] = useState(false);
  const [unstakingVote, setUnstakingVote] = useState<string | null>(null);
  // True while the open unstake panel has a submit in flight — locks EVERY
  // row's Unstake/Close toggle (opening another row unmounts the busy panel
  // and discards its outcome: the duplicate-unstake vector). A watchdog timer
  // releases the lock if a wallet promise never settles (mobile deep-link apps
  // backgrounded mid-sign), so the page can't dead-lock.
  const [unstakeBusy, setUnstakeBusyRaw] = useState(false);
  const busyWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setUnstakeBusy = useCallback((b: boolean) => {
    setUnstakeBusyRaw(b);
    if (busyWatchdog.current) clearTimeout(busyWatchdog.current);
    // Pure dead-session rescue (a mobile wallet killed mid-sign never settles its
    // promise, so the finally never runs). 5 min sits safely ABOVE any real
    // approve-then-confirm (unbounded sign + ≤55s confirm), so it can't fire
    // mid-flight and re-open the row-swap discard window it guards against.
    if (b) busyWatchdog.current = setTimeout(() => setUnstakeBusyRaw(false), 300_000);
  }, []);
  useEffect(() => () => { if (busyWatchdog.current) clearTimeout(busyWatchdog.current); }, []);

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

  // Reload the moment a stake lands on this page (DirectStakeWidget dispatches
  // this after confirm + ingest) — no page refresh needed. Retry once after a
  // short delay to cover ingest/registry write latency.
  useEffect(() => {
    const onStaked = () => {
      load();
      setTimeout(() => { void load(); }, 4_000);
    };
    window.addEventListener('definity:direct-staked', onStaked);
    return () => window.removeEventListener('definity:direct-staked', onStaked);
  }, [load]);

  if (!wallet) return null;
  if (loading && !data) return <div className="mx-auto mt-6 max-w-md text-center font-mono text-sm text-ink-dim">Loading your direct stake…</div>;
  if (!data) return null;

  // Show EVERY validator this wallet has directed to (operator request 2026-09-09):
  // a validator drops to zero "backing" whenever newer stakes consume the wallet's
  // definSOL under the recency-first (LIFO) model, and hiding those made stakes
  // appear/vanish confusingly. Keep them all; mark the un-backed ones distinctly
  // instead. `backed` = the wallet's current holdings still cover this deposit.
  const DUST = 1e-6;
  const isBacked = (p: Position) =>
    p.directedDefinsol > DUST || p.principalSol > DUST || p.pendingMatchSol > DUST || p.matchedDeployedSol > DUST;
  const positions = [...data.positions].sort((a, b) => {
    const ab = isBacked(a), bb = isBacked(b);
    if (ab !== bb) return ab ? -1 : 1; // backed cards first, directed-earlier below
    return b.directedDefinsol - a.directedDefinsol;
  });
  if (positions.length === 0) return null;

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
          {positions.map((p) => {
            const m = meta.get(p.vote);
            const name = p.name || m?.name || short(p.vote);
            const loc = [m?.country, m?.city || p.city].filter(Boolean).join(', ');
            const backed = isBacked(p);
            return (
              <div key={p.vote} className={`rounded-xl border p-4 ${backed ? 'border-ring bg-bg' : 'border-ring/50 bg-bg/40'}`}>
                {/* validator header */}
                <div className="flex items-center gap-3">
                  {m?.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={m.image} alt="" className="h-10 w-10 shrink-0 rounded-full" />
                    : <span className="h-10 w-10 shrink-0 rounded-full bg-ring" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm font-semibold ${backed ? 'text-ink' : 'text-ink-muted'}`}>{name}</span>
                      {!backed ? (
                        <span className="shrink-0 rounded-full border border-ring/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-dim">directed earlier</span>
                      ) : null}
                    </div>
                    <div className="flex items-center truncate font-mono text-xs text-ink-dim">
                      {loc ? <span className="mr-2">{loc}</span> : null}
                      <span>{short(p.vote)}</span>
                      <CopyVote vote={p.vote} />
                    </div>
                  </div>
                </div>

                <div className="my-3 h-px bg-ring" />

                {!backed ? (
                  <p className="text-xs leading-relaxed text-ink-dim">
                    Not currently backed by your definSOL — your holdings back your most recent stakes first, so this
                    one reads zero until you hold enough definSOL to cover it again. Your on-chain deposit to this
                    validator is unchanged.
                  </p>
                ) : (
                <>
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
                  {p.unstakableDefinsol > DUST ? (
                    <button
                      type="button"
                      disabled={unstakeBusy}
                      onClick={() => {
                        // Closing after a confirmed unstake must still refresh the card.
                        if (unstakingVote === p.vote) window.dispatchEvent(new CustomEvent('definity:direct-staked'));
                        setUnstakingVote((v) => (v === p.vote ? null : p.vote));
                      }}
                      className="shrink-0 rounded-full border border-ring bg-bg px-4 py-2 text-sm font-medium text-ink transition hover:border-ink-dim hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {unstakingVote === p.vote ? 'Close' : 'Unstake'}
                    </button>
                  ) : null}
                </div>

                {unstakingVote === p.vote && selected && p.unstakableDefinsol > DUST ? (
                  isMultisig ? (
                    <MultisigUnstakeInline account={selected} maxDefinsol={p.unstakableDefinsol} onBusy={setUnstakeBusy} />
                  ) : (
                    <UnstakeInline
                      account={selected}
                      maxDefinsol={p.unstakableDefinsol}
                      onDone={() => { setUnstakingVote(null); load(); }}
                      onBusy={setUnstakeBusy}
                    />
                  )
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
                </>
                )}
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
