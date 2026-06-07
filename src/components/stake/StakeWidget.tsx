'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { useSignAndSendTransaction, useSelectedWalletAccount } from '@solana/react';
import { getBase58Decoder } from '@solana/kit';
import { ConnectWallet } from './ConnectWallet';
import { getSolBalance, getDefinsolBalance } from '@/lib/solana/rpc';
import {
  quoteSolToDefinsol, quoteOutDefinsol, buildSwapTransaction, solToLamports, type JupiterQuote,
} from '@/lib/solana/jupiter';
import { SOLANA_CHAIN, DEFINSOL_SYMBOL } from '@/lib/solana/constants';

type TxState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'done'; signature: string }
  | { kind: 'error'; message: string };

function DepositPanel({ account }: { account: UiWalletAccount }) {
  const signAndSend = useSignAndSendTransaction(account, SOLANA_CHAIN);
  const [, setSelected] = useSelectedWalletAccount();

  const [sol, setSol] = useState<number | null>(null);
  const [definsol, setDefinsol] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [tx, setTx] = useState<TxState>({ kind: 'idle' });
  const quoteSeq = useRef(0);

  const refreshBalances = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        getSolBalance(account.address),
        getDefinsolBalance(account.address),
      ]);
      setSol(s);
      setDefinsol(d);
    } catch (e) {
      console.error('balance fetch failed', e);
    }
  }, [account.address]);

  useEffect(() => { void refreshBalances(); }, [refreshBalances]);

  // Debounced quote on amount change.
  useEffect(() => {
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) { setQuote(null); return; }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await quoteSolToDefinsol(solToLamports(amount));
        if (seq === quoteSeq.current) setQuote(q);
      } catch {
        if (seq === quoteSeq.current) setQuote(null);
      } finally {
        if (seq === quoteSeq.current) setQuoting(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [amount]);

  const canDeposit =
    tx.kind !== 'submitting' && !!quote && Number(amount) > 0 && (sol == null || Number(amount) <= sol);

  async function onDeposit() {
    if (!quote) return;
    setTx({ kind: 'submitting' });
    try {
      const bytes = await buildSwapTransaction(quote, account.address);
      const { signature } = await signAndSend({ transaction: bytes });
      const sig = getBase58Decoder().decode(signature);
      setTx({ kind: 'done', signature: sig });
      setAmount('');
      setQuote(null);
      void refreshBalances();
    } catch (e) {
      setTx({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-neutral-700 px-4 py-3 text-sm">
        <span className="font-mono">{account.address.slice(0, 4)}…{account.address.slice(-4)}</span>
        <button
          type="button"
          className="text-neutral-400 underline hover:text-neutral-200"
          onClick={() => setSelected(undefined)}
        >
          Disconnect
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-neutral-700 px-4 py-3">
          <div className="text-neutral-400">SOL</div>
          <div className="text-lg font-semibold">{sol == null ? '—' : sol.toFixed(4)}</div>
        </div>
        <div className="rounded-lg border border-neutral-700 px-4 py-3">
          <div className="text-neutral-400">{DEFINSOL_SYMBOL}</div>
          <div className="text-lg font-semibold">{definsol == null ? '—' : definsol.toFixed(4)}</div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-neutral-400">Stake (SOL)</label>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.0"
            className="w-full rounded-lg border border-neutral-700 bg-transparent px-4 py-3 text-lg outline-none focus:border-neutral-400"
          />
          {sol != null ? (
            <button
              type="button"
              onClick={() => setAmount(Math.max(0, sol - 0.01).toString())}
              className="shrink-0 rounded-lg border border-neutral-700 px-3 py-3 text-sm hover:border-neutral-500"
              title="Leave ~0.01 SOL for fees"
            >
              Max
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-400">You receive</span>
          <span className="font-semibold">
            {quoting ? 'quoting…' : quote ? `${quoteOutDefinsol(quote).toFixed(4)} ${DEFINSOL_SYMBOL}` : '—'}
          </span>
        </div>
        {quote ? (
          <div className="mt-1 flex justify-between text-xs text-neutral-500">
            <span>via {quote.routePlan?.map((r) => r.swapInfo.label).join(' → ') || 'Sanctum'}</span>
            <span>impact {Number(quote.priceImpactPct).toFixed(3)}%</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={!canDeposit}
        onClick={onDeposit}
        className="w-full rounded-lg bg-white px-4 py-3 font-semibold text-neutral-900 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {tx.kind === 'submitting' ? 'Confirm in wallet…' : `Stake to ${DEFINSOL_SYMBOL}`}
      </button>

      {tx.kind === 'done' ? (
        <p className="text-sm text-emerald-400">
          Staked ✓{' '}
          <a className="underline" href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer">
            view transaction
          </a>
        </p>
      ) : null}
      {tx.kind === 'error' ? (
        <p className="break-words text-sm text-red-400">Failed: {tx.message}</p>
      ) : null}
    </div>
  );
}

export function StakeWidget() {
  const [selected] = useSelectedWalletAccount();
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-800 p-6">
      {selected ? <DepositPanel account={selected} /> : <ConnectWallet />}
    </div>
  );
}
