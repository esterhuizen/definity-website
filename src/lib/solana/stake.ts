'use client';

// Direct-stake tx-1: create + initialize + delegate a native stake account to a
// validator the user chooses (which must be in the definSOL pool's validator
// list — the picker only offers those). This is the first leg of the spec's
// retail `deposit_stake` flow. The stake activates at the next epoch boundary;
// tx-2 (DepositStake into the Sanctum pool → definSOL) is a separate step once
// it is active.
//
// Safety: a single atomic transaction. If anything is malformed it fails
// wholesale (funds never leave the wallet). On success the stake account is
// owned by the user (staker + withdrawer = the user), so it is always
// recoverable by them. Test with a small amount first.

import {
  address,
  pipe,
  generateKeyPairSigner,
  getBase58Decoder,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signAndSendTransactionMessageWithSigners,
  type TransactionSendingSigner,
} from '@solana/kit';
import { getCreateAccountInstruction } from '@solana-program/system';
import { getInitializeInstruction, getDelegateStakeInstruction, STAKE_PROGRAM_ADDRESS } from '@solana-program/stake';
import { getRpc } from './rpc';

const SYSTEM_PROGRAM = address('11111111111111111111111111111111');
const STAKE_CONFIG = address('StakeConfig11111111111111111111111111111111');
// StakeStateV2 is 200 bytes; rent-exempt minimum for it is a stable constant.
const STAKE_STATE_SPACE = 200n;
const STAKE_RENT_EXEMPT_LAMPORTS = 2_282_880n; // (200 + 128) * 3480 * 2

const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Build, sign (wallet + new stake-account keypair) and send tx-1. Returns the
 * base58 transaction signature. `walletSigner` comes from
 * useWalletAccountTransactionSendingSigner(account, SOLANA_CHAIN).
 */
export async function delegateStakeToValidator(
  walletSigner: TransactionSendingSigner,
  ownerAddress: string,
  validatorVote: string,
  amountSol: number,
): Promise<string> {
  if (!(amountSol > 0)) throw new Error('Amount must be greater than zero.');
  const rpc = getRpc();
  const owner = address(ownerAddress);
  const stake = await generateKeyPairSigner();

  const stakedLamports = BigInt(Math.round(amountSol * LAMPORTS_PER_SOL));
  const lamports = stakedLamports + STAKE_RENT_EXEMPT_LAMPORTS;

  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const createIx = getCreateAccountInstruction({
    payer: walletSigner,
    newAccount: stake,
    lamports,
    space: STAKE_STATE_SPACE,
    programAddress: STAKE_PROGRAM_ADDRESS,
  });
  const initIx = getInitializeInstruction({
    stake: stake.address,
    // Authorized { staker, withdrawer } — both the user, so they keep control.
    arg0: { staker: owner, withdrawer: owner },
    // Lockup: none.
    arg1: { unixTimestamp: 0n, epoch: 0n, custodian: SYSTEM_PROGRAM },
  });
  const delegateIx = getDelegateStakeInstruction({
    stake: stake.address,
    vote: address(validatorVote),
    unused: STAKE_CONFIG, // formerly the stake config account
    stakeAuthority: walletSigner,
  });

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(walletSigner, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions([createIx, initIx, delegateIx], m),
  );

  const signature = await signAndSendTransactionMessageWithSigners(message);
  return getBase58Decoder().decode(signature);
}
