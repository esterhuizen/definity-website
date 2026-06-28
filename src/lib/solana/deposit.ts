'use client';

// Retail direct-stake tx (DSP memo model). Deposit SOL into the definSOL pool
// reserve (Sanctum SanctumSplMulti `DepositSol`) and attach an SPL memo
// `direct:<validatorVote>` naming the chosen validator. definSOL is minted to
// the user's ATA. Definity's staker authority (the GDI optimiser) reads the memo
// and directs pool stake onto that validator on its next cycle, up to the sleeve
// caps and only if the validator is eligible. This mirrors JPool's verified
// mechanism — no user-built stake account, no active-stake epoch step.
//
// Every account below was read from mainnet (scratch/resolve-pool.mjs) and the
// full tx was simulated (scratch/sim-deposit.mjs → err: null): CreateATA +
// DepositSol(ix 14) + memo. DepositSol is permissionless on this pool
// (sol_deposit_authority = default PDA) and currently zero-fee.
//
// Safety: a single transaction. definSOL is minted straight to the user's own
// ATA; Definity never custodies it. Test with a small amount first.

import {
  address,
  pipe,
  AccountRole,
  getBase58Decoder,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signAndSendTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type TransactionSendingSigner,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { getRpc } from './rpc';
import { DEFINSOL_MINT } from './constants';

// definSOL Sanctum pool — verified on-chain 2026-06-25 (scratch/resolve-pool.mjs).
const SANCTUM_SPL_MULTI = address('SPMBzsVUuoHA4Jm6KunbsotaahvVikZs1JyTW6iJvbn');
const POOL = address('Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL');
const POOL_WITHDRAW_AUTHORITY = address('5ugu8RogBq5ZdfGt4hKxKotRBkndiV1ndsqWCf7PBmST');
const POOL_RESERVE = address('G6ncaiwGJ1A5kCRkaogWbrsrEBvmmUWZr4ZhsTgAEckp');
const POOL_MANAGER_FEE = address('BVWVFqB9UGTqh4jFgBeTg2JjgxD7jPEAZhZPLTztx2h');
const MINT = address(DEFINSOL_MINT);
const SYSTEM_PROGRAM = address('11111111111111111111111111111111');
const TOKEN_PROGRAM = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const MEMO_PROGRAM = address('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const LAMPORTS_PER_SOL = 1_000_000_000;
const DEPOSIT_SOL_IX = 14; // SPL stake-pool instruction index for DepositSol

/** SanctumSplMulti DepositSol instruction: data = u8(14) ++ u64_le(lamports). */
function depositSolInstruction(owner: Address, ata: Address, lamports: bigint): Instruction {
  const data = new Uint8Array(9);
  data[0] = DEPOSIT_SOL_IX;
  new DataView(data.buffer).setBigUint64(1, lamports, true);
  return {
    programAddress: SANCTUM_SPL_MULTI,
    accounts: [
      { address: POOL, role: AccountRole.WRITABLE },
      { address: POOL_WITHDRAW_AUTHORITY, role: AccountRole.READONLY },
      { address: POOL_RESERVE, role: AccountRole.WRITABLE },
      { address: owner, role: AccountRole.WRITABLE_SIGNER }, // lamports source (the user)
      { address: ata, role: AccountRole.WRITABLE }, // receives definSOL
      { address: POOL_MANAGER_FEE, role: AccountRole.WRITABLE },
      { address: POOL_MANAGER_FEE, role: AccountRole.WRITABLE }, // referral fee = manager fee
      { address: MINT, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
    ],
    data,
  };
}

/** SPL Memo instruction carrying `direct:<vote>` (no accounts). */
function memoInstruction(text: string): Instruction {
  return { programAddress: MEMO_PROGRAM, accounts: [], data: new TextEncoder().encode(text) };
}

/**
 * Build, sign and send the retail direct-stake transaction. Returns the base58
 * signature. `walletSigner` comes from
 * useWalletAccountTransactionSendingSigner(account, SOLANA_CHAIN).
 */
export async function directDepositSol(
  walletSigner: TransactionSendingSigner,
  ownerAddress: string,
  validatorVote: string,
  amountSol: number,
): Promise<string> {
  if (!(amountSol > 0)) throw new Error('Amount must be greater than zero.');
  const rpc = getRpc();
  const owner = address(ownerAddress);
  const lamports = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));

  const [ata] = await findAssociatedTokenPda({ owner, tokenProgram: TOKEN_PROGRAM_ADDRESS, mint: MINT });

  // Idempotent: no-op if the user already has a definSOL ATA.
  const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
    payer: walletSigner,
    ata,
    owner,
    mint: MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const depositIx = depositSolInstruction(owner, ata, lamports);
  const memoIx = memoInstruction(`direct:${validatorVote}`);

  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(walletSigner, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions([createAtaIx, depositIx, memoIx], m),
  );

  const signature = await signAndSendTransactionMessageWithSigners(message);
  return getBase58Decoder().decode(signature);
}
