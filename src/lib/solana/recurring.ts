'use client';

// Jupiter Recurring API client — the engine behind Yield Streams.
//
// Model (verified against developers.jup.ag, June 2026):
//   - createOrder escrows the FULL inAmount in Jupiter's DCA program
//     (DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M) and sells
//     inAmount/numberOfOrders every `interval` seconds.
//   - Each fill's output is auto-transferred to the user's wallet in the same
//     transaction, PROVIDED the output token account exists (otherwise it
//     accumulates in escrow and pays out at close — hence ensureAta below).
//   - cancelOrder returns all unspent input + unwithdrawn output. The order
//     account is user-owned on-chain, so cancel works even if Jupiter's API
//     disappears.
//   - Hard minimums enforced server-side: $100 total, $50 per cycle, >= 2
//     cycles. Fee: 0.1% of each fill's output. Token-2022 not supported
//     (definSOL is classic SPL — verified on-chain).
//
// All endpoints return UNSIGNED base64 transactions for the user to sign via
// the same wallet flow the stake widget already uses.

import {
  JUPITER_RECURRING_BASE,
  JUPITER_PRICE_BASE,
} from './constants';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ── Prices ──────────────────────────────────────────────────────────────────

/** USD prices for a set of mints via Jupiter Price v3. Missing mints → absent. */
export async function getUsdPrices(mints: string[]): Promise<Record<string, number>> {
  const res = await fetch(`${JUPITER_PRICE_BASE}?ids=${mints.join(',')}`);
  if (!res.ok) throw new Error(`price API ${res.status}`);
  const data = (await res.json()) as Record<string, { usdPrice?: number }>;
  const out: Record<string, number> = {};
  for (const [mint, v] of Object.entries(data)) {
    if (v?.usdPrice != null) out[mint] = v.usdPrice;
  }
  return out;
}

// ── Orders ──────────────────────────────────────────────────────────────────

export type RecurringOrder = {
  /** Order account pubkey — needed for cancel. Field name varies; normalized. */
  orderKey: string;
  inputMint: string;
  outputMint: string;
  /** Raw base units (strings from the API). */
  inDeposited: string;
  inUsed: string;
  inAmountPerCycle: string;
  outReceived: string;
  outWithdrawn: string;
  /** Seconds between fills. */
  cycleFrequency: number;
  createdAt: string | null;
  raw: Record<string, unknown>;
};

function num(v: unknown): string {
  return v == null ? '0' : String(v);
}

function normalizeOrder(o: Record<string, unknown>): RecurringOrder | null {
  const orderKey =
    (o.orderKey as string) ?? (o.publicKey as string) ?? (o.order as string) ?? (o.address as string) ?? null;
  if (!orderKey) return null;
  return {
    orderKey,
    inputMint: String(o.inputMint ?? ''),
    outputMint: String(o.outputMint ?? ''),
    inDeposited: num(o.inDeposited),
    inUsed: num(o.inUsed),
    inAmountPerCycle: num(o.inAmountPerCycle ?? o.rawInAmountPerCycle),
    outReceived: num(o.outReceived),
    outWithdrawn: num(o.outWithdrawn),
    cycleFrequency: Number(o.cycleFrequency ?? 0),
    createdAt: (o.createdAt as string) ?? null,
    raw: o,
  };
}

/** Active time-based recurring orders for a wallet. */
export async function listRecurringOrders(user: string): Promise<RecurringOrder[]> {
  const url =
    `${JUPITER_RECURRING_BASE}/getRecurringOrders?user=${user}` +
    `&orderStatus=active&recurringType=time&includeFailedTx=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getRecurringOrders ${res.status}`);
  const data = (await res.json()) as { time?: Record<string, unknown>[] };
  return (data.time ?? [])
    .map(normalizeOrder)
    .filter((o): o is RecurringOrder => o != null);
}

/**
 * Build the create-order transaction (unsigned). The caller signs and sends
 * via the wallet, exactly like the stake widget's swap flow.
 */
export async function createRecurringOrder(args: {
  user: string;
  inputMint: string;
  outputMint: string;
  /** Raw base units of input to escrow in total. */
  inAmountRaw: bigint;
  numberOfOrders: number;
  intervalSeconds: number;
}): Promise<Uint8Array> {
  const res = await fetch(`${JUPITER_RECURRING_BASE}/createOrder`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      user: args.user,
      inputMint: args.inputMint,
      outputMint: args.outputMint,
      params: {
        time: {
          inAmount: Number(args.inAmountRaw),
          numberOfOrders: args.numberOfOrders,
          interval: args.intervalSeconds,
        },
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    transaction?: string;
    error?: string;
    msg?: string;
  };
  if (!res.ok || !body.transaction) {
    throw new Error(body.error ?? body.msg ?? `createOrder failed (${res.status})`);
  }
  return b64ToBytes(body.transaction);
}

/** Build the cancel transaction (unsigned). Refunds unspent input + output. */
export async function cancelRecurringOrder(args: {
  user: string;
  orderKey: string;
}): Promise<Uint8Array> {
  const res = await fetch(`${JUPITER_RECURRING_BASE}/cancelOrder`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: args.user, order: args.orderKey, recurringType: 'time' }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    transaction?: string;
    error?: string;
    msg?: string;
  };
  if (!res.ok || !body.transaction) {
    throw new Error(body.error ?? body.msg ?? `cancelOrder failed (${res.status})`);
  }
  return b64ToBytes(body.transaction);
}

// ── Stream sizing ───────────────────────────────────────────────────────────

export type StreamPlan = {
  /** Total definSOL to escrow (raw base units). */
  inAmountRaw: bigint;
  /** Human definSOL total. */
  inAmountUi: number;
  numberOfOrders: number;
  intervalSeconds: number;
  intervalLabel: string;
  perCycleUi: number;
  perCycleUsd: number;
  totalUsd: number;
};

const INTERVALS: { seconds: number; label: string }[] = [
  { seconds: 7 * 86400, label: 'weekly' },
  { seconds: 14 * 86400, label: 'fortnightly' },
  { seconds: 30 * 86400, label: 'monthly' },
  { seconds: 91 * 86400, label: 'quarterly' },
];

/**
 * Size a yield stream: sell `holdings × apy × months/12` worth of definSOL
 * over `months`, at the shortest cadence that clears Jupiter's per-cycle
 * minimum. Returns null when even one-cycle-per-quarter can't clear the
 * floors (holder too small for the order minimums).
 */
export function planStream(args: {
  holdingsUi: number;
  apy: number;
  months: number;
  definsolUsd: number;
  minTotalUsd: number;
  minCycleUsd: number;
  decimals: number;
}): StreamPlan | null {
  const { holdingsUi, apy, months, definsolUsd, minTotalUsd, minCycleUsd, decimals } = args;
  const yieldUi = holdingsUi * apy * (months / 12);
  const totalUsd = yieldUi * definsolUsd;
  if (!(totalUsd >= minTotalUsd)) return null;

  const horizonSeconds = months * 30 * 86400;
  for (const iv of INTERVALS) {
    const n = Math.floor(horizonSeconds / iv.seconds);
    if (n < 2) continue;
    const perCycleUsd = totalUsd / n;
    if (perCycleUsd >= minCycleUsd) {
      const inAmountRaw = BigInt(Math.floor(yieldUi * 10 ** decimals));
      return {
        inAmountRaw,
        inAmountUi: yieldUi,
        numberOfOrders: n,
        intervalSeconds: iv.seconds,
        intervalLabel: iv.label,
        perCycleUi: yieldUi / n,
        perCycleUsd,
        totalUsd,
      };
    }
  }
  // Last resort: exactly 2 cycles across the horizon.
  const perCycleUsd = totalUsd / 2;
  if (perCycleUsd >= minCycleUsd) {
    const inAmountRaw = BigInt(Math.floor(yieldUi * 10 ** decimals));
    return {
      inAmountRaw,
      inAmountUi: yieldUi,
      numberOfOrders: 2,
      intervalSeconds: Math.floor(horizonSeconds / 2),
      intervalLabel: `every ${Math.round(horizonSeconds / 2 / 86400)} days`,
      perCycleUi: yieldUi / 2,
      perCycleUsd,
      totalUsd,
    };
  }
  return null;
}
