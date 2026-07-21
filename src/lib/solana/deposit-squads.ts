'use client';

// Squads / multisig direct-stake deposit (ISOLATED, staging WIP).
//
// Same on-chain shape as the normal deposit (create-ATA + Sanctum DepositSol +
// `direct:<vote>` memo) but built for a wallet that can only PROPOSE, not
// sign-and-send: we compile the transaction with the connected account (the
// Squads VAULT PDA) as fee payer + funds source, hand the serialized tx to the
// wallet's `solana:signTransaction`, and submit whatever it returns. For a
// Squads multisig the wallet substitutes our tx for a Multisig Transaction, so
// submitting it creates a PROPOSAL — the deposit itself executes later, after
// approval, owned by the vault. The DSP scanner attributes the executed deposit
// to the vault (the DepositSol funds source) — this REQUIRED a scanner change:
// a multisig execute CPIs the DepositSol + memo, so they appear in the tx's INNER
// instructions, not top level; memo-scan.ts now flattens both (proven 2026-07-21,
// vault 5RePEC… 0.1 SOL direct:StakeCraft). The earlier "no backend change" note
// was wrong — the first live multisig deposit was fetched but not attributed.
//
// Deliberately a private copy of the builders in ./deposit.ts: the normal
// deposit path stays byte-for-byte untouched while this flow is proven. Converge
// into one shared builder once we're happy.

import {
  address,
  pipe,
  AccountRole,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  getTransactionEncoder,
  type Address,
  type Instruction,
  type Base64EncodedWireTransaction,
} from '@solana/kit';
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import { getRpc } from './rpc';
import { DEFINSOL_MINT } from './constants';

// definSOL Sanctum pool — verified on-chain (see ./deposit.ts).
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
const DEPOSIT_SOL_IX = 14;

/** SanctumSplMulti DepositSol: data = u8(14) ++ u64_le(lamports). Source = `owner`. */
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
      { address: owner, role: AccountRole.WRITABLE_SIGNER }, // vault: lamports source
      { address: ata, role: AccountRole.WRITABLE }, // vault's definSOL ATA
      { address: POOL_MANAGER_FEE, role: AccountRole.WRITABLE },
      { address: POOL_MANAGER_FEE, role: AccountRole.WRITABLE },
      { address: MINT, role: AccountRole.WRITABLE },
      { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
      { address: TOKEN_PROGRAM, role: AccountRole.READONLY },
    ],
    data,
  };
}

function memoInstruction(text: string): Instruction {
  return { programAddress: MEMO_PROGRAM, accounts: [], data: new TextEncoder().encode(text) };
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

/**
 * Build the deposit as a serialized, UNSIGNED v0 transaction whose fee payer +
 * funds source is `vaultAddress` (the connected Squads vault). Returns wire bytes
 * to hand to the wallet's `solana:signTransaction`.
 */
export async function buildVaultDepositWireTx(
  vaultAddress: string,
  // A validator vote → a directed deposit (adds the `direct:<vote>` memo). Pass
  // null for a plain LIQUID deposit (no memo, no direction).
  validatorVote: string | null,
  amountSol: number,
): Promise<Uint8Array> {
  if (!(amountSol > 0)) throw new Error('Amount must be greater than zero.');
  const rpc = getRpc();
  const vault = address(vaultAddress);
  const lamports = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));

  const [ata] = await findAssociatedTokenPda({ owner: vault, tokenProgram: TOKEN_PROGRAM_ADDRESS, mint: MINT });

  const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
    // The wallet signs the whole serialized tx later — a noop signer just marks
    // the vault as the (writable, signing) rent payer without an in-process key.
    payer: createNoopSigner(vault),
    ata,
    owner: vault,
    mint: MINT,
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
  });
  const depositIx = depositSolInstruction(vault, ata, lamports);
  // Directed deposits carry a `direct:<vote>` memo; a liquid deposit has none.
  const ixs = validatorVote
    ? [createAtaIx, depositIx, memoInstruction(`direct:${validatorVote}`)]
    : [createAtaIx, depositIx];

  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(vault, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(ixs, m),
  );

  const tx = compileTransaction(message);
  return getTransactionEncoder().encode(tx) as Uint8Array;
}

/**
 * Submit an already-signed transaction (or, for a multisig wallet, the
 * substituted Multisig Transaction) and return its base58 signature. For a
 * Squads wallet this signature is the PROPOSAL-create tx — NOT the deposit,
 * which executes later after approval.
 */
export async function submitSignedTx(signed: Uint8Array): Promise<string> {
  const b64 = toBase64(signed) as Base64EncodedWireTransaction;
  // sendTransaction is allowlisted on our RPC proxy; base64 avoids a re-encode.
  const sig = await getRpc()
    .sendTransaction(b64, { encoding: 'base64', preflightCommitment: 'confirmed' })
    .send();
  return sig;
}
