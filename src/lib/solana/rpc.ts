'use client';

import { createSolanaRpc, address, type Address, type Signature } from '@solana/kit';
import { RPC_PROXY_PATH, SOL_DECIMALS, DEFINSOL_MINT, DEFINSOL_DECIMALS } from './constants';

// Kit RPC pointed at the same-origin proxy. createSolanaRpc needs an absolute
// URL (it uses fetch), so we resolve against the current origin in the browser.
let _rpc: ReturnType<typeof createSolanaRpc> | null = null;
let _baseOrigin: string | null = null;

// Embeds run on a third-party origin, so the proxy must be addressed absolutely
// (e.g. https://definity.finance) instead of same-origin. The main dapp leaves
// this unset and stays same-origin. Only read-only calls go through here — the
// wallet submits the signed tx via its own RPC.
export function setRpcBaseOrigin(origin: string) {
  _baseOrigin = origin.replace(/\/$/, '');
  _rpc = null;
}

export function getRpc() {
  if (_rpc) return _rpc;
  const origin = _baseOrigin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  _rpc = createSolanaRpc(`${origin}${RPC_PROXY_PATH}`);
  return _rpc;
}

/**
 * Wait until a signature reaches `confirmed` (or better). Wallets resolve as
 * soon as a transaction is SUBMITTED, so reading balances immediately after
 * signAndSend returns pre-trade values — poll confirmation first, then read.
 * Resolves true on confirmation, false on timeout or on-chain error (callers
 * refresh either way; this only gates WHEN).
 */
export async function waitForConfirmation(
  signature: string,
  { timeoutMs = 45_000, pollMs = 1_500 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  const sig = signature as Signature;
  while (Date.now() < deadline) {
    try {
      const { value } = await getRpc().getSignatureStatuses([sig]).send();
      const status = value[0];
      if (status?.err != null) return false;
      const cs = status?.confirmationStatus;
      if (cs === 'confirmed' || cs === 'finalized') return true;
    } catch {
      // transient proxy/network blip — keep polling until the deadline
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

/** Native SOL balance in whole SOL (confirmed commitment, so fresh trades show). */
export async function getSolBalance(owner: string): Promise<number> {
  const { value } = await getRpc()
    .getBalance(address(owner), { commitment: 'confirmed' })
    .send();
  return Number(value) / 10 ** SOL_DECIMALS;
}

/** definSOL balance in whole tokens (0 if the holder has no token account). */
export async function getDefinsolBalance(owner: string): Promise<number> {
  const res = await getRpc()
    .getTokenAccountsByOwner(
      address(owner),
      { mint: address(DEFINSOL_MINT) as Address },
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    )
    .send();
  let total = 0n;
  for (const acc of res.value) {
    // jsonParsed: data.parsed.info.tokenAmount.amount (string, base units)
    const info = (acc.account.data as { parsed?: { info?: { tokenAmount?: { amount?: string } } } })
      .parsed?.info?.tokenAmount?.amount;
    if (info) total += BigInt(info);
  }
  return Number(total) / 10 ** DEFINSOL_DECIMALS;
}
