'use client';

import {
  JUPITER_BASE, SOL_MINT, DEFINSOL_MINT, SOL_DECIMALS, DEFINSOL_DECIMALS, DEFAULT_SLIPPAGE_BPS,
} from './constants';

export type JupiterQuote = {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: { swapInfo: { label: string } }[];
  // opaque — passed straight back to /swap
  [k: string]: unknown;
};

/** Convert a decimal SOL string to integer lamports (no float drift). */
export function solToLamports(amount: string): bigint {
  const [whole, frac = ''] = amount.trim().split('.');
  const fracPadded = (frac + '0'.repeat(SOL_DECIMALS)).slice(0, SOL_DECIMALS);
  return BigInt(whole || '0') * 10n ** BigInt(SOL_DECIMALS) + BigInt(fracPadded || '0');
}

export function baseUnitsToDecimal(amount: string, decimals: number): number {
  return Number(BigInt(amount)) / 10 ** decimals;
}

/** Quote SOL → definSOL. Returns null if no route. */
export async function quoteSolToDefinsol(
  lamports: bigint,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
): Promise<JupiterQuote | null> {
  const url =
    `${JUPITER_BASE}/quote?inputMint=${SOL_MINT}&outputMint=${DEFINSOL_MINT}` +
    `&amount=${lamports.toString()}&slippageBps=${slippageBps}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const q = (await res.json()) as JupiterQuote;
  return q?.outAmount ? q : null;
}

export function quoteOutDefinsol(q: JupiterQuote): number {
  return baseUnitsToDecimal(q.outAmount, DEFINSOL_DECIMALS);
}

/**
 * Build the SOL→definSOL swap transaction for `userPublicKey` from a quote.
 * Returns the wire-format serialized VersionedTransaction bytes, ready to hand
 * to the wallet's signAndSendTransaction.
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
