'use client';

// The production direct-stake widget (mounted on /direct-staking as
// DirectStakeWidget). Serves BOTH regular wallets and Squads multisigs: we build
// the deposit, hand it to `solana:signTransaction`, and submit what comes back.
// A regular wallet's submit EXECUTES the deposit; a Squads wallet substitutes a
// Multisig Transaction, so its submit creates a PROPOSAL — the deposit executes
// later, after approval, and the scanner attributes it to the vault. Success
// therefore means "deposit confirmed" or "proposal created" respectively.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useSelectedWalletAccount, useSignTransaction } from '@solana/react';
import { Search, Check, X, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { ConnectWallet } from '../stake/ConnectWallet';
import { SOLANA_CHAIN } from '@/lib/solana/constants';
import { getSolBalance, getDefinsolBalance, waitForSignatureOutcome } from '@/lib/solana/rpc';
import { buildVaultDepositWireTx, submitSignedTx } from '@/lib/solana/deposit-squads';

type V = {
  vote: string;
  name: string | null;
  city: string | null;
  country: string | null;
  image: string | null;
  activatedStakeSol: number | null;
  pending?: boolean;
};

type SubState =
  | { kind: 'idle' }
  | { kind: 'signing' }
  // Submitted to the network, landing not yet known. A signature alone proves
  // NOTHING — sendTransaction resolves on submission, so success may only be
  // claimed after confirmation (this widget once showed "Staked" for
  // transactions that never landed).
  | { kind: 'confirming'; signature: string }
  // Snapshot of WHAT was staked rides in the state: the form stays live under a
  // 45s confirming window, so reading `amount`/`picked` at success-render time
  // reported whatever the user typed since — or crashed if they cleared the
  // validator. Success renders only its own frozen facts.
  | { kind: 'submitted'; signature: string; stakedAmt: number; stakedName: string }
  // Deadline passed with the signature still unresolved: claim neither success
  // nor failure — hand the user the explorer link.
  | { kind: 'timeout'; signature: string }
  | { kind: 'error'; message: string; signature?: string };

function short(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

function Panel({ account }: { account: UiWalletAccount }) {
  const signTransaction = useSignTransaction(account, SOLANA_CHAIN);
  const [, setSelected] = useSelectedWalletAccount();

  // A Squads/multisig wallet can only PROPOSE (it advertises signTransaction but
  // NOT signAndSendTransaction): signing substitutes a Multisig Transaction, so
  // submitting creates a proposal. A regular wallet (Phantom etc.) simply signs,
  // and submitting EXECUTES the deposit immediately. Same submit path either way —
  // only the copy differs, so this widget serves both.
  const isMultisig = !account.features.includes('solana:signAndSendTransaction');

  const [vals, setVals] = useState<V[]>([]);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<V | null>(null);
  const [amount, setAmount] = useState('');
  const [sub, setSub] = useState<SubState>({ kind: 'idle' });
  const [sol, setSol] = useState<number | null>(null);
  // definSOL evidence for the success screen — set ONLY by a post-confirmation
  // fetch that succeeded. Rendering the pre-stake value there would show stale
  // (even zero) "evidence" under a Staked banner.
  const [evidence, setEvidence] = useState<number | null>(null);
  const balSeq = useRef(0);

  // Wallet/vault balances (the vault PDA is the funds source for a multisig, so
  // the same address is right in both modes). Null = not fetched yet — the UI
  // shows "–" and skips the over-balance guard rather than blocking on an RPC blip.
  // The seq guard drops slow responses that arrive after an account switch.
  const refreshBalances = useCallback(async () => {
    const seq = ++balSeq.current;
    try {
      const s = await getSolBalance(account.address);
      if (seq === balSeq.current) setSol(s);
    } catch (e) {
      console.error('balance fetch failed', e);
    }
  }, [account.address]);

  useEffect(() => {
    balSeq.current++; // invalidate in-flight fetches for the previous account
    setSol(null);
    setEvidence(null);
    void refreshBalances();
  }, [account.address, refreshBalances]);

  // Keep ~0.01 SOL behind. Regular wallet: tx fee + ATA rent on a first deposit
  // (~0.003 worst case). Vault mode: the member wallet pays the proposal fee, but
  // the vault still needs ATA rent + the execution fee — same reserve covers it.
  const GAS_RESERVE = 0.01;
  const usableMax = sol == null ? null : Math.max(0, sol - GAS_RESERVE);

  useEffect(() => {
    let alive = true;
    fetch('/validators.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.validators) setVals(d.validators as V[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return [...vals]
      .sort((a, b) => (b.activatedStakeSol ?? 0) - (a.activatedStakeSol ?? 0))
      .filter(
        (v) =>
          (v.name || '').toLowerCase().includes(q) ||
          v.vote.toLowerCase().includes(q) ||
          (v.city || '').toLowerCase().includes(q) ||
          (v.country || '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [vals, query]);

  const amt = Number(amount);
  // Guard only when the balance is known; dust epsilon forgives float edges.
  // Compared against usableMax, not the raw balance, so the guard and the Max
  // button agree on what is actually spendable (fees + rent stay behind).
  const overBalance = usableMax != null && amt > usableMax + 1e-9;
  const busy = sub.kind === 'signing' || sub.kind === 'confirming';
  const canSubmit = !!picked && Number.isFinite(amt) && amt > 0 && !overBalance && !busy;

  function fillMax() {
    if (usableMax == null) return;
    // Floor, never round: rounding can fill a hair above the true balance.
    const floored = Math.floor(usableMax * 1e6) / 1e6;
    setAmount(floored.toFixed(6).replace(/\.?0+$/, ''));
  }

  async function onSubmit() {
    if (!picked || !(amt > 0)) return;
    // Freeze the facts of THIS submission — the form stays mounted (and could
    // in principle change) all through the confirmation wait.
    const stakedAmt = amt;
    const stakedName = picked.name || short(picked.vote);
    const vote = picked.vote;
    try {
      setSub({ kind: 'signing' });
      // The connected account is the Squads vault PDA — funds source + definSOL owner.
      const wire = await buildVaultDepositWireTx(account.address, vote, stakedAmt);
      const { signedTransaction } = await signTransaction({ transaction: wire });
      const signature = await submitSignedTx(signedTransaction);
      // A signature is a submission receipt, not a result. Success renders only
      // after the transaction is CONFIRMED on-chain; failure and timeout each
      // get their own honest state.
      setSub({ kind: 'confirming', signature });
      const outcome = await waitForSignatureOutcome(signature);
      if (outcome === 'confirmed') {
        // Success renders immediately; evidence + attribution follow in the
        // background so a slow RPC can't hold the screen at "Confirming…".
        setSub({ kind: 'submitted', signature, stakedAmt, stakedName });
        if (!isMultisig) {
          void (async () => {
            try {
              await fetch('/api/direct-stake/ingest', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ signature }),
              });
            } catch { /* scanner backstop attributes it within minutes */ }
            // Nudge the directed-stake panel on this page to refetch now.
            window.dispatchEvent(new CustomEvent('definity:direct-staked'));
            try {
              setEvidence(await getDefinsolBalance(account.address));
            } catch { /* evidence line simply stays hidden */ }
            void refreshBalances();
          })();
        } else {
          void refreshBalances();
        }
      } else if (outcome === 'failed') {
        setSub({
          kind: 'error', signature,
          message: isMultisig
            ? 'The transaction failed on-chain — no proposal was created (only the network fee was spent).'
            : 'The transaction failed on-chain — nothing was staked (only the network fee was spent).',
        });
      } else {
        setSub({ kind: 'timeout', signature });
      }
    } catch (e) {
      setSub({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  if (sub.kind === 'submitted') {
    return (
      <div className="space-y-3 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-sunrise-300/15">
          <Check className="h-6 w-6 text-sunrise-300" aria-hidden="true" />
        </div>
        <p className="font-display text-lg font-semibold text-ink">{isMultisig ? 'Proposal created' : 'Staked'}</p>
        <p className="text-sm text-ink-muted">
          {isMultisig ? (
            <>
              Your stake of {sub.stakedAmt} SOL to {sub.stakedName} is now a proposal in your Squad. Open
              Squads, then <strong className="text-ink">approve and execute</strong> it — funds and definSOL never leave
              your vault. Your stake is directed once it executes; matching accrues after a full epoch.
            </>
          ) : (
            <>
              Your {sub.stakedAmt} SOL stake to {sub.stakedName} is confirmed on-chain — definSOL is in
              your wallet. Your stake is directed at the next optimiser cycle; matching accrues after a full epoch.
            </>
          )}
        </p>
        {!isMultisig && evidence != null ? (
          <p className="text-sm text-ink-muted">
            definSOL in wallet: <span className="font-mono text-ink">{evidence.toFixed(4)}</span>
            <span className="block text-xs text-ink-dim">
              Your directed-stake total on this page updates within a minute or two.
            </span>
          </p>
        ) : null}
        <a
          className="inline-flex items-center gap-1 text-sm text-ink underline underline-offset-2"
          href={`https://solscan.io/tx/${sub.signature}`}
          target="_blank"
          rel="noreferrer"
        >
          {isMultisig ? 'View proposal transaction' : 'View transaction'} <ArrowUpRight className="h-3 w-3" />
        </a>
        <div>
          <button
            type="button"
            className="text-sm text-ink-dim underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              setSub({ kind: 'idle' });
              setPicked(null);
              setAmount('');
              setQuery('');
              setEvidence(null);
              void refreshBalances();
            }}
          >
            {isMultisig ? 'Propose another' : 'Stake another'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connected vault */}
      <div className="flex items-center justify-between rounded-xl border border-ring bg-bg-muted/60 px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-ink-muted">
          <ShieldCheck className="h-4 w-4 text-sunrise-300" aria-hidden="true" />
          <span className="font-mono text-ink">{short(account.address)}</span>
          <span className="text-ink-dim">{isMultisig ? 'vault' : 'wallet'}</span>
        </span>
        <button
          type="button"
          disabled={busy}
          className="text-ink-dim underline-offset-2 hover:text-ink hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setSelected(undefined)}
        >
          Disconnect
        </button>
      </div>

      {/* Validator picker */}
      <div className="rounded-xl border border-ring bg-bg-muted/60 p-4">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">Choose a validator</div>
        {picked ? (
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-sunrise-300 bg-bg px-3 py-2">
            {picked.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={picked.image} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <span className="h-7 w-7 rounded-full bg-ring" aria-hidden="true" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{picked.name || short(picked.vote)}</span>
              <span className="block truncate font-mono text-xs text-ink-dim">{short(picked.vote)}</span>
            </span>
            <button
              type="button"
              disabled={busy}
              className="ml-auto text-ink-dim hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Clear selection"
              onClick={() => setPicked(null)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-ring bg-bg px-3 py-2">
              <Search className="h-4 w-4 text-ink-dim" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, city, or vote pubkey"
                className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim"
              />
            </div>
            {query.trim() ? (
              <ul className="mt-2 max-h-60 space-y-1 overflow-auto">
                {results.map((v) => (
                  <li key={v.vote}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(v);
                        setQuery('');
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-bg"
                    >
                      {v.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.image} alt="" className="h-6 w-6 rounded-full" />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-ring" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{v.name || short(v.vote)}</span>
                        <span className="block truncate font-mono text-[11px] text-ink-dim">{short(v.vote)}</span>
                      </span>
                    </button>
                  </li>
                ))}
                {results.length === 0 ? (
                  <li className="px-2 py-3 text-center text-xs text-ink-dim">No vetted validator matches.</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 px-1 text-[11px] text-ink-dim">Search Definity&apos;s vetted set. Pick one to direct your stake.</p>
            )}
          </>
        )}
      </div>

      {/* Amount */}
      <div className="rounded-xl border border-ring bg-bg-muted/60 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.18em] text-ink-dim">Amount to direct-stake</span>
          <span className="text-xs text-ink-dim">
            {isMultisig ? 'Vault balance' : 'Balance'}:{' '}
            <button
              type="button"
              onClick={fillMax}
              disabled={usableMax == null || usableMax <= 0 || busy}
              className="font-mono text-ink-muted hover:text-ink disabled:cursor-default disabled:hover:text-ink-muted"
              title={usableMax == null || usableMax <= 0 ? undefined : `Use max (leaves ~${GAS_RESERVE} SOL for fees)`}
            >
              {sol == null ? '–' : `${sol.toFixed(4)} SOL`}
            </button>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <input
            inputMode="decimal"
            value={amount}
            disabled={busy}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^0-9.]/g, ''));
              // A stale failure under a freshly edited form reads as current.
              if (sub.kind === 'error' || sub.kind === 'timeout') setSub({ kind: 'idle' });
            }}
            placeholder="0.0"
            className="w-full min-w-0 bg-transparent font-display text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink-dim disabled:opacity-60 md:text-4xl"
          />
          <span className="shrink-0 font-medium text-ink-muted">SOL</span>
        </div>
        {overBalance ? (
          <p className="mt-2 text-xs text-fuchsia-600">
            Amount exceeds what your {isMultisig ? 'vault' : 'wallet'} can spend ({usableMax?.toFixed(4)} SOL —
            ~{GAS_RESERVE} SOL stays behind for fees).
          </p>
        ) : null}
        <p className="mt-2 text-xs text-ink-dim">
          {isMultisig
            ? 'Stakes SOL from your vault into definSOL. This forms a Squads proposal — approve and execute it in your Squad to complete the stake.'
            : 'Stakes SOL from your wallet into definSOL, directed to your chosen validator.'}{' '}
          Up to 4.5× total directed (1× principal + up to 3.5× matching), capped at 20,000 SOL per validator.
        </p>
      </div>

      {/* Submit */}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="btn-primary mt-1 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sub.kind === 'signing'
          ? isMultisig ? 'Forming proposal…' : 'Confirm in wallet…'
          : sub.kind === 'confirming'
            ? 'Confirming on-chain…'
            : isMultisig ? 'Create stake proposal' : 'Direct-stake'}
      </button>

      {sub.kind === 'confirming' ? (
        <p className="text-center text-xs text-ink-dim">
          Submitted — waiting for on-chain confirmation.{' '}
          <a
            className="underline underline-offset-2 hover:text-ink"
            href={`https://solscan.io/tx/${sub.signature}`}
            target="_blank"
            rel="noreferrer"
          >
            View on Solscan
          </a>
        </p>
      ) : null}
      {sub.kind === 'timeout' ? (
        <p className="break-words text-center text-sm text-sunrise-500">
          Still unconfirmed — the network may be congested. Check{' '}
          <a
            className="underline underline-offset-2"
            href={`https://solscan.io/tx/${sub.signature}`}
            target="_blank"
            rel="noreferrer"
          >
            the transaction
          </a>{' '}
          before retrying so you don&apos;t {isMultisig ? 'create two proposals' : 'stake twice'}.
        </p>
      ) : null}
      {sub.kind === 'error' ? (
        <p className="break-words text-center text-sm text-fuchsia-600">
          Failed: {sub.message}
          {sub.signature ? (
            <>
              {' '}
              <a
                className="underline underline-offset-2"
                href={`https://solscan.io/tx/${sub.signature}`}
                target="_blank"
                rel="noreferrer"
              >
                Details
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

export function SquadsStakeWidget() {
  const [selected] = useSelectedWalletAccount();
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="surface relative overflow-hidden p-6 shadow-glow-sm md:p-8">
        <div className="absolute inset-0 bg-dawn-gradient opacity-50" aria-hidden="true" />
        <div className="relative">{selected ? <Panel account={selected} /> : <ConnectWallet />}</div>
      </div>
    </div>
  );
}
