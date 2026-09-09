'use client';

import { useState } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useSignTransaction } from '@solana/react';
import { Check, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { SOLANA_CHAIN } from '@/lib/solana/constants';
import { buildVaultDepositWireTx, submitSignedTx } from '@/lib/solana/deposit-squads';
import { waitForSignatureOutcome } from '@/lib/solana/rpc';

function short(a: string) {
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}

type Sub =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'confirming'; signature: string }
  // Renders only after the proposal-create tx CONFIRMS, with a frozen snapshot
  // of the amount (the live field could change during the wait).
  | { kind: 'submitted'; signature: string; stakedAmt: number }
  | { kind: 'timeout'; signature: string }
  | { kind: 'error'; message: string; signature?: string };

// Liquid (undirected) stake from a multisig (SquadsX). Builds a plain DepositSol
// (NO `direct:` memo) with the vault as funds source, hands it to the wallet's
// signTransaction — which a Squad turns into a vault-transaction PROPOSAL — and
// submits the proposal-create tx. The deposit executes once the Squad approves +
// executes. Regular wallets use the normal sign-and-send DepositPanel; this panel
// is only mounted for a sign-only (multisig) wallet, so its hook never runs for a
// regular one.
export function MultisigLiquidPanel({ account }: { account: UiWalletAccount }) {
  const signTransaction = useSignTransaction(account, SOLANA_CHAIN);
  const [amount, setAmount] = useState('');
  const [sub, setSub] = useState<Sub>({ kind: 'idle' });
  const amt = Number(amount);
  const busy = sub.kind === 'signing' || sub.kind === 'confirming';
  const canSubmit = Number.isFinite(amt) && amt > 0 && !busy;

  async function onSubmit() {
    if (!(amt > 0)) return;
    const stakedAmt = amt; // frozen: the field stays live during confirmation
    try {
      setSub({ kind: 'signing' });
      const wire = await buildVaultDepositWireTx(account.address, null, stakedAmt); // null vote → liquid, no memo
      const { signedTransaction } = await signTransaction({ transaction: wire });
      const signature = await submitSignedTx(signedTransaction);
      // "Proposal created" only after the create tx confirms — a failed create
      // means NO proposal exists in the Squad.
      setSub({ kind: 'confirming', signature });
      const outcome = await waitForSignatureOutcome(signature);
      if (outcome === 'confirmed') {
        setSub({ kind: 'submitted', signature, stakedAmt });
      } else if (outcome === 'failed') {
        setSub({ kind: 'error', signature, message: 'The transaction failed on-chain — no proposal was created (only the network fee was spent).' });
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
        <p className="font-display text-lg font-semibold text-ink">Proposal created</p>
        <p className="text-sm text-ink-muted">
          Your liquid stake of {sub.stakedAmt} SOL is now a proposal in your Squad. Open Squads, then{' '}
          <strong className="text-ink">approve and execute</strong> it — the SOL converts to definSOL, owned by your vault.
          Funds never leave the vault.
        </p>
        <a
          className="inline-flex items-center gap-1 text-sm text-ink underline underline-offset-2"
          href={`https://solscan.io/tx/${sub.signature}`}
          target="_blank"
          rel="noreferrer"
        >
          View proposal transaction <ArrowUpRight className="h-3 w-3" />
        </a>
        <div>
          <button
            type="button"
            className="text-sm text-ink-dim underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              setSub({ kind: 'idle' });
              setAmount('');
            }}
          >
            Propose another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Connected vault */}
      <div className="flex items-center gap-2 rounded-xl border border-ring bg-bg-muted/60 px-4 py-2.5 text-sm text-ink-muted">
        <ShieldCheck className="h-4 w-4 text-sunrise-300" aria-hidden="true" />
        <span className="font-mono text-ink">{short(account.address)}</span>
        <span className="text-ink-dim">vault</span>
      </div>

      {/* Amount */}
      <div className="rounded-xl border border-ring bg-bg-muted/60 px-4 py-3">
        <div className="mb-1 text-xs uppercase tracking-[0.18em] text-ink-dim">Amount</div>
        <div className="flex items-baseline gap-2">
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
          Liquid-stakes SOL from your vault into definSOL — no direction. Forms a Squads proposal; approve and execute it
          in your Squad to complete the stake. To direct your stake to a validator (and earn matching), use{' '}
          <a className="font-medium text-sunrise-400 underline underline-offset-2" href="/direct-staking">Direct Staking</a>.
        </p>
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="btn-primary mt-1 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sub.kind === 'signing' ? 'Forming proposal…' : sub.kind === 'confirming' ? 'Confirming on-chain…' : 'Create stake proposal'}
      </button>

      {sub.kind === 'confirming' ? (
        <p className="text-center text-xs text-ink-dim">
          Submitted — waiting for on-chain confirmation.{' '}
          <a className="underline underline-offset-2 hover:text-ink" href={`https://solscan.io/tx/${sub.signature}`} target="_blank" rel="noreferrer">View on Solscan</a>
        </p>
      ) : null}
      {sub.kind === 'timeout' ? (
        <p className="break-words text-center text-sm text-sunrise-500">
          Still unconfirmed — check{' '}
          <a className="underline underline-offset-2" href={`https://solscan.io/tx/${sub.signature}`} target="_blank" rel="noreferrer">the transaction</a>{' '}
          before retrying so you don&apos;t create two proposals.
        </p>
      ) : null}
      {sub.kind === 'error' ? (
        <p className="break-words text-center text-sm text-fuchsia-600">
          Failed: {sub.message}
          {sub.signature ? <> <a className="underline underline-offset-2" href={`https://solscan.io/tx/${sub.signature}`} target="_blank" rel="noreferrer">Details</a></> : null}
        </p>
      ) : null}
    </div>
  );
}
