'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { ArrowDown, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useSignAndSendTransaction, useSelectedWalletAccount } from '@solana/react';
import { getBase58Decoder } from '@solana/kit';
import { ConnectWallet } from './ConnectWallet';
import { RewardsPanel } from './RewardsPanel';
import { getSolBalance, getDefinsolBalance } from '@/lib/solana/rpc';
import {
  quoteSwap, quoteOut, buildSwapTransaction, toBaseUnits, type JupiterQuote,
} from '@/lib/solana/jupiter';
import {
  SOLANA_CHAIN, SOL_MINT, SOL_DECIMALS, DEFINSOL_MINT, DEFINSOL_DECIMALS, DEFINSOL_SYMBOL,
} from '@/lib/solana/constants';

type Mode = 'stake' | 'unstake' | 'rewards';
type Tone = 'solana' | 'sunrise';

type TxState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'done'; signature: string }
  | { kind: 'error'; message: string };

function TokenChip({ label, tone }: { label: string; tone: Tone }) {
  const ring =
    tone === 'sunrise'
      ? 'ring-sunrise-500/40 bg-sunrise-500/10'
      : 'ring-solana-500/40 bg-solana-500/10';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-ink ring-1 ${ring}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          tone === 'sunrise' ? 'bg-sunrise-500' : 'bg-solana-500'
        }`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function DepositPanel({ account }: { account: UiWalletAccount }) {
  const signAndSend = useSignAndSendTransaction(account, SOLANA_CHAIN);
  const [, setSelected] = useSelectedWalletAccount();

  const [mode, setMode] = useState<Mode>('stake');
  const [sol, setSol] = useState<number | null>(null);
  const [definsol, setDefinsol] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [tx, setTx] = useState<TxState>({ kind: 'idle' });
  const quoteSeq = useRef(0);

  // Direction-dependent token framing. SOL and definSOL are both 9-decimal.
  const dir = useMemo(() => {
    if (mode !== 'unstake') {
      return {
        inMint: SOL_MINT, inSym: 'SOL', inTone: 'solana' as Tone,
        inDecimals: SOL_DECIMALS, inBalance: sol, gasReserve: 0.01,
        outMint: DEFINSOL_MINT, outSym: DEFINSOL_SYMBOL, outTone: 'sunrise' as Tone,
        outDecimals: DEFINSOL_DECIMALS, outBalance: definsol,
        outBlurb: 'Liquid receipt · accrues staking rewards',
        cta: `Stake to ${DEFINSOL_SYMBOL}`,
      };
    }
    return {
      inMint: DEFINSOL_MINT, inSym: DEFINSOL_SYMBOL, inTone: 'sunrise' as Tone,
      inDecimals: DEFINSOL_DECIMALS, inBalance: definsol, gasReserve: 0,
      outMint: SOL_MINT, outSym: 'SOL', outTone: 'solana' as Tone,
      outDecimals: SOL_DECIMALS, outBalance: sol,
      outBlurb: 'Native Solana · settles to your wallet',
      cta: 'Unstake to SOL',
    };
  }, [mode, sol, definsol]);

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

  function switchMode(next: Mode) {
    if (next === mode) return;
    quoteSeq.current++; // cancel any in-flight quote
    setMode(next);
    setAmount('');
    setQuote(null);
    setQuoting(false);
    setTx({ kind: 'idle' });
  }

  // Debounced quote on amount / direction change. (Not used in rewards mode.)
  useEffect(() => {
    if (mode === 'rewards') return;
    const n = Number(amount);
    if (!amount || !Number.isFinite(n) || n <= 0) { setQuote(null); setQuoting(false); return; }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await quoteSwap(dir.inMint, dir.outMint, toBaseUnits(amount, dir.inDecimals));
        if (seq === quoteSeq.current) setQuote(q);
      } catch {
        if (seq === quoteSeq.current) setQuote(null);
      } finally {
        if (seq === quoteSeq.current) setQuoting(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [amount, mode, dir.inMint, dir.outMint, dir.inDecimals]);

  // Largest amount the user can actually submit (keeps a gas reserve when the
  // input is native SOL). Both presets and the slider scale off this.
  const usableMax =
    dir.inBalance == null ? 0 : Math.max(0, dir.inBalance - dir.gasReserve);

  function trimAmount(n: number) {
    return n.toFixed(6).replace(/\.?0+$/, '');
  }

  function setPct(pct: number) {
    if (dir.inBalance == null) return;
    setAmount(trimAmount((usableMax * pct) / 100));
  }

  // Slider thumb position derived from the typed amount (so typing and dragging stay in sync).
  const sliderPct =
    usableMax > 0 && amount ? Math.min(100, Math.max(0, (Number(amount) / usableMax) * 100)) : 0;

  const overBalance = dir.inBalance != null && Number(amount) > dir.inBalance;
  const canSubmit =
    tx.kind !== 'submitting' && !!quote && Number(amount) > 0 && !overBalance;

  async function onSubmit() {
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
    <div className="relative space-y-3">
      {/* Connected wallet row */}
      <div className="flex items-center justify-between rounded-xl border border-ring bg-bg-muted/60 px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-ink-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-success" aria-hidden="true" />
          <span className="font-mono text-ink">
            {account.address.slice(0, 4)}…{account.address.slice(-4)}
          </span>
        </span>
        <button
          type="button"
          className="text-ink-dim underline-offset-2 hover:text-ink hover:underline"
          onClick={() => setSelected(undefined)}
        >
          Disconnect
        </button>
      </div>

      {/* Stake / Unstake / Rewards toggle */}
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-ring bg-bg-muted/60 p-1">
        {(['stake', 'unstake', 'rewards'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            aria-pressed={mode === m}
            className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${
              mode === m
                ? 'bg-bg text-ink shadow-card'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'rewards' ? (
        <RewardsPanel account={account} />
      ) : (
      <>
      {/* Input */}
      <div className="rounded-xl border border-ring bg-bg-muted/60 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.18em] text-ink-dim">
            {mode === 'stake' ? 'You stake' : 'You unstake'}
          </span>
          <span className="text-xs text-ink-dim">
            Balance:{' '}
            <button
              type="button"
              onClick={() => setPct(100)}
              className="font-mono text-ink-muted hover:text-ink"
              title={dir.gasReserve ? `Use max (leaves ~${dir.gasReserve} SOL for fees)` : 'Use max'}
            >
              {dir.inBalance == null ? '-' : dir.inBalance.toFixed(4)}
            </button>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.0"
            className="w-full min-w-0 bg-transparent font-display text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink-dim md:text-4xl"
          />
          <TokenChip label={dir.inSym} tone={dir.inTone} />
        </div>

        {/* Percent slider: snaps to 25 / 50 / 75 / 100% of the usable balance */}
        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={100}
            step={25}
            value={sliderPct}
            disabled={dir.inBalance == null}
            onChange={(e) => setPct(Number(e.target.value))}
            aria-label={`${mode} amount as a percentage of balance`}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ring accent-sunrise-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="mt-2 grid grid-cols-4 gap-1">
            {[25, 50, 75, 100].map((p) => {
              const active = Math.round(sliderPct) === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={dir.inBalance == null}
                  onClick={() => setPct(p)}
                  className={`rounded-md py-1 text-xs font-medium transition disabled:opacity-50 ${
                    active
                      ? 'bg-bg text-ink shadow-card'
                      : 'text-ink-dim hover:text-ink'
                  }`}
                >
                  {p === 100 ? 'Max' : `${p}%`}
                </button>
              );
            })}
          </div>
        </div>

        {overBalance ? (
          <p className="mt-2 text-xs text-fuchsia-600">Amount exceeds your {dir.inSym} balance.</p>
        ) : null}
      </div>

      {/* Arrow */}
      <div className="flex items-center justify-center" aria-hidden="true">
        <div className="-my-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-ring bg-bg">
          <ArrowDown className="h-4 w-4 text-sunrise-500" />
        </div>
      </div>

      {/* Output */}
      <div
        className={`rounded-xl border bg-bg-muted/60 p-5 ${
          dir.outTone === 'sunrise' ? 'border-sunrise-300' : 'border-ring'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.18em] text-ink-dim">You receive</span>
          <span className="text-xs text-ink-dim">
            Balance:{' '}
            <span className="font-mono text-ink-muted">
              {dir.outBalance == null ? '-' : dir.outBalance.toFixed(4)}
            </span>
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-4">
          <span className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            {quoting ? '…' : quote ? quoteOut(quote, dir.outDecimals).toFixed(4) : '0.0'}
          </span>
          <TokenChip label={dir.outSym} tone={dir.outTone} />
        </div>
        <p className="mt-2 flex items-center justify-between text-xs text-ink-dim">
          <span>{dir.outBlurb}</span>
          {quote ? <span>impact {Number(quote.priceImpactPct).toFixed(3)}%</span> : null}
        </p>
      </div>

      {/* CTA */}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        {tx.kind === 'submitting' ? 'Confirm in wallet…' : dir.cta}
      </button>

      {tx.kind === 'done' ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-sm text-success">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Done.{' '}
          <a
            className="inline-flex items-center gap-1 underline underline-offset-2"
            href={`https://solscan.io/tx/${tx.signature}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction <ArrowUpRight className="h-3 w-3" />
          </a>
        </p>
      ) : null}
      {tx.kind === 'error' ? (
        <p className="break-words text-center text-sm text-fuchsia-600">Failed: {tx.message}</p>
      ) : null}

      <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[11px] text-ink-dim">
        <ShieldCheck className="h-3 w-3 text-success" aria-hidden="true" />
        Swaps route through Jupiter. Your wallet signs and submits; Definity never holds your funds.
      </p>
      </>
      )}
    </div>
  );
}

export function StakeWidget() {
  const [selected] = useSelectedWalletAccount();
  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="surface relative overflow-hidden p-6 shadow-glow-sm md:p-8">
        <div className="absolute inset-0 bg-dawn-gradient opacity-50" aria-hidden="true" />
        <div className="relative">
          {selected ? <DepositPanel account={selected} /> : <ConnectWallet />}
        </div>
      </div>
    </div>
  );
}
