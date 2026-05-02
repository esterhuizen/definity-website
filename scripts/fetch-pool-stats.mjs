#!/usr/bin/env node
//
// fetch-pool-stats.mjs — read live stats for the Definity stake pool from a
// Solana RPC and write them to public/stats.json. Designed to be run on a
// systemd timer (hourly is plenty — the data updates per epoch, ~2 days).
//
// No npm dependencies. Uses Node 20+ built-in fetch + Buffer.
//
// Usage:
//   node scripts/fetch-pool-stats.mjs                 # writes ./public/stats.json
//   node scripts/fetch-pool-stats.mjs path/to/out.json
//   SOLANA_RPC=https://my.rpc node scripts/fetch-pool-stats.mjs
//
// Exit codes:
//   0  success — file written
//   1  unrecoverable error (RPC down, account not found, layout mismatch).
//      The existing stats.json (if any) is left untouched.

import { writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const POOL_ADDRESS = 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL';
const LST_MINT     = 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA';
const OUT_PATH     = resolve(process.argv[2] || 'public/stats.json');

// AccountType discriminators — first byte of every SPL stake-pool account.
const ACCOUNT_TYPE = { UNINITIALIZED: 0, STAKE_POOL: 1, VALIDATOR_LIST: 2 };

const LAMPORTS_PER_SOL = 1_000_000_000n;

// ---------------------------------------------------------------------------
// Tiny RPC helper
// ---------------------------------------------------------------------------
async function rpc(method, params) {
  const r = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!r.ok) throw new Error(`RPC ${method} HTTP ${r.status}: ${await r.text()}`);
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function getAccountData(pubkey) {
  const r = await rpc('getAccountInfo', [pubkey, { encoding: 'base64' }]);
  if (!r?.value?.data?.[0]) throw new Error(`Account ${pubkey} not found or empty`);
  return Buffer.from(r.value.data[0], 'base64');
}

async function getMintSupply(pubkey) {
  const r = await rpc('getTokenSupply', [pubkey]);
  if (!r?.value) throw new Error(`Mint ${pubkey} not found`);
  // r.value = { amount: "12345...", decimals: 9, uiAmount, uiAmountString }
  return { rawAmount: BigInt(r.value.amount), decimals: r.value.decimals };
}

// ---------------------------------------------------------------------------
// Inline base58 encoder — no `bs58` dependency. Standard Solana alphabet.
// Input: 32-byte Buffer. Output: base58-encoded pubkey string.
// ---------------------------------------------------------------------------
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(bytes) {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = '';
  while (n > 0n) {
    s = B58_ALPHABET[Number(n % 58n)] + s;
    n = n / 58n;
  }
  for (const b of bytes) {
    if (b === 0) s = '1' + s;
    else break;
  }
  return s;
}

// ---------------------------------------------------------------------------
// SPL stake-pool layout decoders
//
// Layout reference: solana-program-library/stake-pool/program/src/state.rs
// These offsets are stable — the program is deployed and immutable on
// mainnet-beta. If they ever change it would be a new program-id, not a
// silent layout drift.
// ---------------------------------------------------------------------------
function parseStakePool(buf) {
  if (buf[0] !== ACCOUNT_TYPE.STAKE_POOL) {
    throw new Error(`Pool account type byte = ${buf[0]} (expected ${ACCOUNT_TYPE.STAKE_POOL})`);
  }
  // Offsets: account_type(1) + manager(32) + staker(32) + stake_deposit_authority(32)
  //        + stake_withdraw_bump_seed(1) + validator_list(32) + reserve_stake(32)
  //        + pool_mint(32) + manager_fee_account(32) + token_program_id(32)
  //        + total_lamports(u64) + pool_token_supply(u64)
  const validatorListBytes = buf.subarray(98, 130);
  const totalLamports     = buf.readBigUInt64LE(258);
  const poolTokenSupply   = buf.readBigUInt64LE(266);
  return {
    validatorListAddress: base58Encode(validatorListBytes),
    totalLamports,
    poolTokenSupply,
  };
}

function parseValidatorList(buf) {
  if (buf[0] !== ACCOUNT_TYPE.VALIDATOR_LIST) {
    throw new Error(`Validator-list account type byte = ${buf[0]} (expected ${ACCOUNT_TYPE.VALIDATOR_LIST})`);
  }
  // Offsets: account_type(1) + max_validators(u32) + validators_count(u32) + items...
  const maxValidators = buf.readUInt32LE(1);
  const count         = buf.readUInt32LE(5);
  if (count > maxValidators) {
    throw new Error(`validators_count (${count}) > max_validators (${maxValidators}) — layout mismatch`);
  }
  return { count, maxValidators };
}

// ---------------------------------------------------------------------------
// Atomic write — write to a tempfile next to the target, then rename.
// This guarantees the website never reads a half-written stats.json.
// ---------------------------------------------------------------------------
async function atomicWriteJson(path, obj) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  await rename(tmp, path);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const t0 = Date.now();

  const poolBuf = await getAccountData(POOL_ADDRESS);
  const pool = parseStakePool(poolBuf);

  const validatorListBuf = await getAccountData(pool.validatorListAddress);
  const vlist = parseValidatorList(validatorListBuf);

  const lstSupply = await getMintSupply(LST_MINT);

  const totalSol = Number(pool.totalLamports) / Number(LAMPORTS_PER_SOL);
  const definsolSupply = Number(lstSupply.rawAmount) / 10 ** lstSupply.decimals;
  const exchangeRate = definsolSupply > 0 ? totalSol / definsolSupply : null;

  const stats = {
    validators: vlist.count,
    maxValidators: vlist.maxValidators,
    totalSol,
    totalLamports: pool.totalLamports.toString(),
    definsolSupply,
    definsolRawSupply: lstSupply.rawAmount.toString(),
    exchangeRate,
    updatedAt: new Date().toISOString(),
    rpc: new URL(RPC).host,
    fetchedInMs: Date.now() - t0,
  };

  await atomicWriteJson(OUT_PATH, stats);

  console.log(
    `wrote ${OUT_PATH}: ${stats.validators} validators, ` +
    `${totalSol.toFixed(2)} SOL staked, ` +
    `${definsolSupply.toFixed(2)} ${'definSOL'} supply, ` +
    `rate ${exchangeRate?.toFixed(6)} SOL/definSOL ` +
    `(${stats.fetchedInMs} ms)`,
  );
}

main().catch((err) => {
  console.error(`fetch-pool-stats: ${err.message}`);
  process.exit(1);
});
