'use client';

// YIELD STREAMS — receive definSOL staking rewards in another token.
//
// Mechanics: definSOL yield accrues as exchange-rate appreciation. This panel
// sizes a slice equal to the holder's PROJECTED yield over a chosen horizon
// and creates a Jupiter Recurring order selling that slice into the target
// token each cycle, delivered straight to the wallet. The principal never
// leaves the wallet; only the yield-sized slice escrows in Jupiter's
// battle-tested DCA program, and cancelling refunds it instantly.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UiWalletAccount } from '@wallet-standard/react';
import { ArrowUpRight, CalendarSync, ShieldCheck, X } from 'lucide-react';
import { useSignAndSendTransaction } from '@solana/react';
import { getBase58Decoder } from '@solana/kit';
import { getDefinsolBalance, waitForConfirmation } from '@/lib/solana/rpc';
import { hasTokenAccount, buildCreateAtaTransaction } from '@/lib/solana/ata';
import {
  getUsdPrices, listRecurringOrders, createRecurringOrder, cancelRecurringOrder,
  planStream, type RecurringOrder, type StreamPlan,
} from '@/lib/solana/recurring';
import {
  SOLANA_CHAIN, DEFINSOL_MINT, DEFINSOL_DECIMALS, DEFINSOL_SYMBOL,
  DEFINSOL_APY_ESTIMATE, PAYOUT_TOKENS,
  RECURRING_MIN_TOTAL_USD, RECURRING_MIN_CYCLE_USD,
} from '@/lib/solana/constants';

type Busy = 'idle' | 'preparing' | 'signing' | 'cancelling';

const HORIZONS = [
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '12 months' },
];

function fmtToken(uiAmount: number, maxDp = 3): string {
  return uiAmount.toLocaleString('en-US', { maximumFractionDigits: maxDp });
}

export function RewardsPanel({ account }: { account: UiWalletAccount }) {
  const signAndSend = useSignAndSendTransaction(account, SOLANA_CHAIN);

  const [balance, setBalance] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [streams, setStreams] = useState<RecurringOrder[] | null>(null);
  const [payoutMint, setPayoutMint] = useState<string>(PAYOUT_TOKENS[0].mint);
  const [months, setMonths] = useState<number>(6);
  const [busy, setBusy] = useState<Busy>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const payoutToken = PAYOUT_TOKENS.find((t) => t.mint === payoutMint) ?? PAYOUT_TOKENS[0];

  const refresh = useCallback(async () => {
    try {
      const [bal, px, orders] = await Promise.all([
        getDefinsolBalance(account.address),
        getUsdPrices([DEFINSOL_MINT, ...PAYOUT_TOKENS.map((t) => t.mint)]),
        listRecurringOrders(account.address).catch(() => []),
      ]);
      setBalance(bal);
      setPrices(px);
      setStreams(orders.filter((o) => o.inputMint === DEFINSOL_MINT));
    } catch (e) {
      console.error('rewards refresh failed', e);
    }
  }, [account.address]);

  useEffect(() => { void refresh(); }, [refresh]);

  const definsolUsd = prices[DEFINSOL_MINT] ?? null;

  const plan: StreamPlan | null = useMemo(() => {
    if (balance == null || balance <= 0 || definsolUsd == null) return null;
    return planStream({
      holdingsUi: balance,
      apy: DEFINSOL_APY_ESTIMATE,
      months,
      definsolUsd,
      minTotalUsd: RECURRING_MIN_TOTAL_USD,
      minCycleUsd: RECURRING_MIN_CYCLE_USD,
      decimals: DEFINSOL_DECIMALS,
    });
  }, [balance, definsolUsd, months]);

  async function onCreate() {
    if (!plan) return;
    setError(null);
    setLastSig(null);
    try {
      // Step 1 (only when needed): make sure payouts have somewhere to land.
      setBusy('preparing');
      const ataExists = await hasTokenAccount(account.address, payoutMint);
      if (!ataExists) {
        const ataTx = await buildCreateAtaTransaction(account.address, payoutMint);
        setBusy('signing');
        await signAndSend({ transaction: ataTx });
        setBusy('preparing');
      }
      // Step 2: the stream itself.
      const orderTx = await createRecurringOrder({
        user: account.address,
        inputMint: DEFINSOL_MINT,
        outputMint: payoutMint,
        inAmountRaw: plan.inAmountRaw,
        numberOfOrders: plan.numberOfOrders,
        intervalSeconds: plan.intervalSeconds,
      });
      setBusy('signing');
      const { signature } = await signAndSend({ transaction: orderTx });
      const sig = getBase58Decoder().decode(signature);
      setLastSig(sig);
      await waitForConfirmation(sig);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('idle');
    }
  }

  async function onCancel(orderKey: string) {
    setError(null);
    try {
      setBusy('cancelling');
      const tx = await cancelRecurringOrder({ user: account.address, orderKey });
      setBusy('signing');
      const { signature } = await signAndSend({ transaction: tx });
      await waitForConfirmation(getBase58Decoder().decode(signature));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('idle');
    }
  }

  const symbolFor = (mint: string) =>
    PAYOUT_TOKENS.find((t) => t.mint === mint)?.symbol ?? `${mint.slice(0, 4)}…`;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm leading-relaxed text-ink-muted text-pretty">
          Get your staking rewards as <span className="font-medium text-ink">{payoutToken.symbol}</span>,
          delivered to your wallet automatically. We size a slice equal to your projected yield and
          sell just that slice on a schedule. Your principal never moves, and you can cancel anytime
          for an instant refund of the unsold remainder.
        </p>
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-ring bg-bg-muted/60 p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-dim">Receive rewards in</div>
          <div className="mt-2 flex gap-2">
            {PAYOUT_TOKENS.map((t) => (
              <button
                key={t.mint}
                type="button"
                onClick={() => setPayoutMint(t.mint)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  payoutMint === t.mint ? 'bg-bg text-ink shadow-card ring-1 ring-ring' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {t.symbol}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-ring bg-bg-muted/60 p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-dim">For the next</div>
          <div className="mt-2 flex gap-2">
            {HORIZONS.map((h) => (
              <button
                key={h.months}
                type="button"
                onClick={() => setMonths(h.months)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  months === h.months ? 'bg-bg text-ink shadow-card ring-1 ring-ring' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Plan summary */}
      <div className="rounded-xl border border-sunrise-300 bg-bg-muted/60 p-5">
        <div className="text-xs uppercase tracking-[0.18em] text-ink-dim">Your stream</div>
        {balance == null || definsolUsd == null ? (
          <p className="mt-2 text-sm text-ink-muted">Loading balance and prices…</p>
        ) : balance <= 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            No {DEFINSOL_SYMBOL} in this wallet yet. Stake first, then set up a reward stream.
          </p>
        ) : plan ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink">
              Sells <span className="font-semibold">{fmtToken(plan.perCycleUi)} {DEFINSOL_SYMBOL}</span>{' '}
              {plan.intervalLabel} for ~{plan.numberOfOrders} payouts of{' '}
              <span className="font-semibold">${plan.perCycleUsd.toFixed(0)}</span> in {payoutToken.symbol}.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-dim">
              Total slice: {fmtToken(plan.inAmountUi)} {DEFINSOL_SYMBOL} (~${plan.totalUsd.toFixed(0)}),
              your projected yield on {fmtToken(balance, 1)} {DEFINSOL_SYMBOL} over {months} months at ~
              {(DEFINSOL_APY_ESTIMATE * 100).toFixed(1)}% APY. The other{' '}
              {fmtToken(Math.max(0, balance - plan.inAmountUi), 1)} {DEFINSOL_SYMBOL} stays in your wallet
              and keeps compounding.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Your projected yield over {months} months is below Jupiter&apos;s ${RECURRING_MIN_TOTAL_USD}{' '}
            order minimum. Try a longer horizon, or this becomes available as your stake grows
            (roughly ${Math.ceil(RECURRING_MIN_TOTAL_USD / (DEFINSOL_APY_ESTIMATE * (months / 12)) / 100) * 100}{' '}
            staked at the {months}-month horizon).
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!plan || busy !== 'idle'}
        onClick={onCreate}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CalendarSync className="h-4 w-4" aria-hidden="true" />
        {busy === 'preparing' ? 'Preparing…' : busy === 'signing' ? 'Confirm in wallet…' : 'Start reward stream'}
      </button>

      {lastSig ? (
        <p className="flex items-center justify-center gap-1.5 text-center text-sm text-success">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Stream live.{' '}
          <a
            className="inline-flex items-center gap-1 underline underline-offset-2"
            href={`https://solscan.io/tx/${lastSig}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction <ArrowUpRight className="h-3 w-3" />
          </a>
        </p>
      ) : null}
      {error ? <p className="break-words text-center text-sm text-fuchsia-600">Failed: {error}</p> : null}

      {/* Active streams */}
      {streams && streams.length > 0 ? (
        <div className="rounded-xl border border-ring bg-bg-muted/60 p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-dim">Active streams</div>
          <ul className="mt-2 divide-y divide-ring text-sm">
            {streams.map((s) => {
              const dep = Number(s.inDeposited) / 10 ** DEFINSOL_DECIMALS;
              const used = Number(s.inUsed) / 10 ** DEFINSOL_DECIMALS;
              return (
                <li key={s.orderKey} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <div className="text-ink">
                      {DEFINSOL_SYMBOL} → {symbolFor(s.outputMint)}
                    </div>
                    <div className="text-xs text-ink-dim">
                      {fmtToken(used, 2)} of {fmtToken(dep, 2)} sold · every{' '}
                      {Math.round(s.cycleFrequency / 86400)}d
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy !== 'idle'}
                    onClick={() => onCancel(s.orderKey)}
                    className="inline-flex items-center gap-1 text-xs text-ink-dim hover:text-ink disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel and refund
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="flex items-start justify-center gap-1.5 pt-1 text-center text-[11px] leading-relaxed text-ink-dim">
        <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" aria-hidden="true" />
        <span>
          Streams run on Jupiter&apos;s recurring-order program (live since 2023). Only the yield
          slice is committed; Definity never holds your funds, and the slice is an estimate of your
          yield, re-sized whenever you renew. Jupiter charges 0.1% per payout.
        </span>
      </p>
    </div>
  );
}
