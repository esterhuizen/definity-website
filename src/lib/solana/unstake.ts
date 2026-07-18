'use client';

// On-site unstake: redeem definSOL → SOL via a Jupiter swap, built client-side
// and signed by the user's own wallet (no redirect). The pool reserve isn't a
// reliable instant-withdraw source, so we use market liquidity — same path the
// main site links out to, here built inline. wrapAndUnwrapSol delivers native SOL.

import { getBase58Decoder } from '@solana/kit';
import { DEFINSOL_MINT } from './constants';

const JUP = 'https://lite-api.jup.ag/swap/v1';
const WSOL = 'So11111111111111111111111111111111111111112';

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type UnstakeQuote = { outSol: number; quote: unknown };

// definSOL → SOL is a single-hop Sanctum stake-pool redemption, so we request a
// LEGACY transaction (asLegacyTransaction). Jupiter self-restricts to routes
// that fit a legacy tx, which for this pair is the direct Sanctum route — and a
// legacy tx carries NO address-lookup-tables, which mobile wallet in-app
// browsers simulate reliably. (Versioned + ALT swaps made phone wallets report
// "simulation failed / can't predict balance changes" even though the tx was
// valid — verified 2026-07-18: versioned build resolves ALTs the wallet's RPC
// couldn't; the legacy build has 0 ALTs and simulates cleanly.)
const LEGACY = '&asLegacyTransaction=true';

/** Jupiter quote for definSOL → SOL (whole SOL out). null if there's no route. */
export async function quoteUnstake(amountDefinsol: number): Promise<UnstakeQuote | null> {
  if (!(amountDefinsol > 0)) return null;
  const lamports = Math.round(amountDefinsol * 1e9);
  const r = await fetch(`${JUP}/quote?inputMint=${DEFINSOL_MINT}&outputMint=${WSOL}&amount=${lamports}&slippageBps=50${LEGACY}`);
  if (!r.ok) return null;
  const quote = await r.json();
  if (!quote?.outAmount) return null;
  return { outSol: Number(quote.outAmount) / 1e9, quote };
}

/** Quote + build the swap; returns the wire tx bytes to hand to the wallet. */
export async function buildUnstakeSwap(ownerAddress: string, amountDefinsol: number): Promise<Uint8Array> {
  const q = await quoteUnstake(amountDefinsol);
  if (!q) throw new Error('No swap route for that amount.');
  const res = await fetch(`${JUP}/swap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: q.quote,
      userPublicKey: ownerAddress,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      asLegacyTransaction: true, // must match the quote
    }),
  });
  if (!res.ok) throw new Error('Could not build the swap.');
  const { swapTransaction } = await res.json();
  if (!swapTransaction) throw new Error('No swap transaction returned.');
  return b64ToBytes(swapTransaction);
}

export const sigToBase58 = (sig: Uint8Array) => getBase58Decoder().decode(sig);

/** Pull a human message out of ANYTHING thrown — Error, wallet-standard error
 * object, SolanaError, nested {error}, {code}, else JSON. Wallets and the
 * signing hooks frequently throw plain objects, so `String(e)` alone yields the
 * useless "[object Object]". */
export function errMsg(e: unknown): string {
  if (e == null) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  const o = e as Record<string, unknown>;
  const nested = o.error ?? o.cause;
  if (typeof o.message === 'string' && o.message) return o.message;
  if (typeof nested === 'string' && nested) return nested;
  if (nested && typeof nested === 'object') {
    const nm = (nested as Record<string, unknown>).message;
    if (typeof nm === 'string' && nm) return nm;
  }
  const parts = [o.name, o.code].filter((x) => x != null && x !== '').join(' ');
  if (parts) return `${parts}${typeof o.reason === 'string' ? `: ${o.reason}` : ''}`;
  try {
    const j = JSON.stringify(e);
    if (j && j !== '{}') return j;
  } catch { /* circular */ }
  return String(e);
}
