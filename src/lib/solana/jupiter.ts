'use client';

import { JUPITER_BASE, DEFAULT_SLIPPAGE_BPS } from './constants';

export type JupiterQuote = {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: { swapInfo: { label: string } }[];
  // opaque — passed straight back to /swap
  [k: string]: unknown;
};

/** Convert a decimal token-amount string to integer base units (no float drift). */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const [whole, frac = ''] = amount.trim().split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(fracPadded || '0');
}

export function baseUnitsToDecimal(amount: string, decimals: number): number {
  return Number(BigInt(amount)) / 10 ** decimals;
}

/**
 * Quote a swap between two mints. `amount` is in the input mint's base units.
 * Works both directions (SOL→definSOL to stake, definSOL→SOL to unstake).
 * Returns null if Jupiter has no route.
 */
export async function quoteSwap(
  inputMint: string,
  outputMint: string,
  amount: bigint,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
): Promise<JupiterQuote | null> {
  const url =
    `${JUPITER_BASE}/quote?inputMint=${inputMint}&outputMint=${outputMint}` +
    `&amount=${amount.toString()}&slippageBps=${slippageBps}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const q = (await res.json()) as JupiterQuote;
  return q?.outAmount ? q : null;
}

/** Output amount of a quote in whole tokens, given the output mint's decimals. */
export function quoteOut(q: JupiterQuote, outputDecimals: number): number {
  return baseUnitsToDecimal(q.outAmount, outputDecimals);
}

/**
 * Build the swap transaction for `userPublicKey` from a quote (either
 * direction). `wrapAndUnwrapSol` makes Jupiter wrap native SOL on the way in
 * and unwrap it on the way out, so unstake settles to native SOL.
 * Returns wire-format serialized VersionedTransaction bytes for the wallet.
 */
export async function buildSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string,
): Promise<Uint8Array> {
  const res = await fetch(`${JUPITER_BASE}/swap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Jupiter /swap failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const { swapTransaction } = (await res.json()) as { swapTransaction: string };
  if (!swapTransaction) throw new Error('Jupiter /swap returned no transaction');
  // base64 → Uint8Array (browser)
  const bin = atob(swapTransaction);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
