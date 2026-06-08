'use client';

import { createSolanaRpc, address, type Address } from '@solana/kit';
import { RPC_PROXY_PATH, SOL_DECIMALS, DEFINSOL_MINT, DEFINSOL_DECIMALS } from './constants';

// Kit RPC pointed at the same-origin proxy. createSolanaRpc needs an absolute
// URL (it uses fetch), so we resolve against the current origin in the browser.
let _rpc: ReturnType<typeof createSolanaRpc> | null = null;
export function getRpc() {
  if (_rpc) return _rpc;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  _rpc = createSolanaRpc(`${origin}${RPC_PROXY_PATH}`);
  return _rpc;
}

/** Native SOL balance in whole SOL. */
export async function getSolBalance(owner: string): Promise<number> {
  const { value } = await getRpc().getBalance(address(owner)).send();
  return Number(value) / 10 ** SOL_DECIMALS;
}

/** definSOL balance in whole tokens (0 if the holder has no token account). */
export async function getDefinsolBalance(owner: string): Promise<number> {
  const res = await getRpc()
    .getTokenAccountsByOwner(
      address(owner),
      { mint: address(DEFINSOL_MINT) as Address },
      { encoding: 'jsonParsed' },
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
