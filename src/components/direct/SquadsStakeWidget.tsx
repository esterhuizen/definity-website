'use client';

// Squads / multisig direct-stake — ISOLATED staging WIP.
//
// Parallel to DirectStakeWidget, but for wallets that can only PROPOSE. Instead
// of sign-and-send, we build the deposit, hand it to `solana:signTransaction`,
// and submit what comes back. For a Squads multisig that submit creates a
// PROPOSAL; the deposit executes later, after approval, and the 5-min scanner
// attributes it to the vault. So success here means "proposal created", never
// "deposited". The current DirectStakeWidget is untouched.

import { useEffect, useMemo, useState } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useSelectedWalletAccount, useSignTransaction } from '@solana/react';
import { Search, Check, X, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { ConnectWallet } from '../stake/ConnectWallet';
import { SOLANA_CHAIN } from '@/lib/solana/constants';
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
  | { kind: 'submitted'; signature: string }
  | { kind: 'error'; message: string };

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
  const canSubmit = !!picked && Number.isFinite(amt) && amt > 0 && sub.kind !== 'signing';

  async function onSubmit() {
    if (!picked || !(amt > 0)) return;
    try {
      setSub({ kind: 'signing' });
      // The connected account is the Squads vault PDA — funds source + definSOL owner.
      const wire = await buildVaultDepositWireTx(account.address, picked.vote, amt);
      const { signedTransaction } = await signTransaction({ transaction: wire });
      const signature = await submitSignedTx(signedTransaction);
      setSub({ kind: 'submitted', signature });
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
              Your stake of {amt} SOL to {picked?.name || short(picked!.vote)} is now a proposal in your Squad. Open
              Squads, then <strong className="text-ink">approve and execute</strong> it — funds and definSOL never leave
              your vault. Your stake is directed once it executes; matching accrues after a full epoch.
            </>
          ) : (
            <>
              Your {amt} SOL stake to {picked?.name || short(picked!.vote)} is on-chain — definSOL is in your wallet.
              Your stake is directed at the next optimiser cycle; matching accrues after a full epoch.
            </>
          )}
        </p>
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
          className="text-ink-dim underline-offset-2 hover:text-ink hover:underline"
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
              className="ml-auto text-ink-dim hover:text-ink"
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
        <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">Amount to direct-stake</div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.0"
            className="w-full min-w-0 bg-transparent font-display text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink-dim md:text-4xl"
          />
          <span className="shrink-0 font-medium text-ink-muted">SOL</span>
        </div>
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
          ? isMultisig ? 'Forming proposal…' : 'Staking…'
          : isMultisig ? 'Create stake proposal' : 'Direct-stake'}
      </button>

      {sub.kind === 'error' ? (
        <p className="break-words text-center text-sm text-fuchsia-600">Failed: {sub.message}</p>
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
