'use client';

// Output-token account helper for Yield Streams. Jupiter Recurring auto-sends
// each fill to the user's wallet ONLY if their output-token ATA exists;
// otherwise payouts accumulate in the order escrow until close. So the stream
// setup flow checks for the ATA and, when missing, has the user sign one tiny
// create-ATA transaction first (idempotent instruction; safe to race).

import {
  address,
  appendTransactionMessageInstruction,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { getRpc } from './rpc';

/** Does `owner` hold any token account for `mint`? */
export async function hasTokenAccount(owner: string, mint: string): Promise<boolean> {
  const res = await getRpc()
    .getTokenAccountsByOwner(
      address(owner),
      { mint: address(mint) as Address },
      { encoding: 'jsonParsed' },
    )
    .send();
  return res.value.length > 0;
}

/**
 * Build an unsigned transaction creating the owner's ATA for `mint`
 * (idempotent). Returns wire-format bytes for the wallet to sign and send,
 * same as the Jupiter-built transactions in the stake flow.
 */
export async function buildCreateAtaTransaction(owner: string, mint: string): Promise<Uint8Array> {
  const ownerAddr = address(owner);
  const mintAddr = address(mint);
  const [ata] = await findAssociatedTokenPda({
    owner: ownerAddr,
    mint: mintAddr,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const { value: blockhash } = await getRpc().getLatestBlockhash().send();
  const payer = createNoopSigner(ownerAddr);
  const ix = getCreateAssociatedTokenIdempotentInstruction({
    payer,
    ata,
    mint: mintAddr,
    owner: ownerAddr,
  });
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(ownerAddr, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstruction(ix, m),
  );
  const tx = compileTransaction(message);
  return new Uint8Array(getTransactionEncoder().encode(tx));
}
