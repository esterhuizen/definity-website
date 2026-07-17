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

import { writeFile, readFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const POOL_ADDRESS = 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL';
const LST_MINT     = 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA';
const OUT_PATH        = resolve(process.argv[2] || 'public/stats.json');
const VALIDATORS_PATH = resolve(process.argv[3] || 'public/validators.json');

const STAKEWIZ_URL = process.env.STAKEWIZ_URL || 'https://api.stakewiz.com/validators';
// Refresh validator geo at most once per day. Validators rarely change data
// centers, and Stakewiz doesn't need 24 hits per day per pool from us.
const VALIDATORS_TTL_MS = 24 * 60 * 60 * 1000;

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

  // ValidatorStakeInfo entries (73 bytes each), starting at offset 9.
  // Within each entry, vote_account_address sits at offset 41 (after 8+8+8+8+4+4+1).
  const HEADER_SIZE = 9;
  const ITEM_SIZE   = 73;
  const VOTE_OFFSET = 41;

  const votePubkeys = [];
  for (let i = 0; i < count; i++) {
    const start = HEADER_SIZE + i * ITEM_SIZE + VOTE_OFFSET;
    const bytes = buf.subarray(start, start + 32);
    votePubkeys.push(base58Encode(bytes));
  }

  return { count, maxValidators, votePubkeys };
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
// ---------------------------------------------------------------------------
// Validator geo refresh — called at most once per day. Pulls all validators
// from Stakewiz in one shot, filters to our pool's vote pubkeys, writes a
// slim public/validators.json that the website reads at render time.
// ---------------------------------------------------------------------------
// Notion "Active in pool = Active" votes that are NOT yet in the on-chain
// list: validators approved to join (e.g. fast-track acceptors) whose seat
// lands at the next optimiser approval. Including them (flagged pending) lets
// direct-stakers find them in the widget IMMEDIATELY — the deposit-maturity
// clock is wallet-bound and starts ticking before the seat exists. Fail-soft:
// no token / Notion error → empty list, the site simply shows pool members.
async function fetchPendingVotes(poolVotes) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch(
      'https://api.notion.com/v1/data_sources/c5bf5bae-c249-4503-a4d9-c6a4ca989834/query',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 100, filter: { property: 'Active in pool', status: { equals: 'Active' } } }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const inPool = new Set(poolVotes);
    const pending = [];
    for (const r of d.results ?? []) {
      const t = (r.properties?.['Operator / Vote ID']?.title ?? []).map((x) => x.plain_text).join('').trim();
      const v = (r.properties?.['Vote ID']?.rich_text ?? []).map((x) => x.plain_text).join('').trim();
      const vote = B58.test(t) ? t : B58.test(v) ? v : null;
      if (vote && !inPool.has(vote)) pending.push(vote);
    }
    return pending;
  } catch (e) {
    console.log(`WARN: pending-validator lookup failed (${e.message}) — pool members only`);
    return [];
  }
}

async function maybeRefreshValidators(votePubkeys, pendingVotes = []) {
  let existing = null;
  try {
    existing = JSON.parse(await readFile(VALIDATORS_PATH, 'utf8'));
  } catch {
    // file missing / bad JSON — treat as a fresh start.
  }

  const lastMs = existing?.lastFetchedAt ? new Date(existing.lastFetchedAt).getTime() : 0;
  const ageMs  = Date.now() - lastMs;

  // The daily TTL is Stakewiz courtesy, not correctness — a MEMBERSHIP change
  // must refresh immediately, or a newly added validator is invisible to the
  // direct-stake search for up to 24h (live incident: StakeCraft, 2026-07-16).
  const allVotes = [...votePubkeys, ...pendingVotes];
  const existingVotes = new Set((existing?.validators ?? []).map((v) => v?.vote).filter(Boolean));
  const setChanged = existing
    && (allVotes.some((v) => !existingVotes.has(v)) || existingVotes.size !== allVotes.length);

  if (existing && ageMs < VALIDATORS_TTL_MS && !setChanged) {
    console.log(`validators.json is ${(ageMs / 3600_000).toFixed(1)}h old, skipping geo refresh`);
    return;
  }
  if (setChanged) console.log('pool membership changed since last refresh — refreshing geo now');

  console.log(`refreshing validator geo from ${new URL(STAKEWIZ_URL).host}...`);

  const r = await fetch(STAKEWIZ_URL, {
    headers: { 'user-agent': 'definity-website/1.0 (+https://definity.finance)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`Stakewiz HTTP ${r.status}: ${await r.text().catch(() => '')}`);
  const all = await r.json();
  if (!Array.isArray(all)) throw new Error(`Stakewiz returned non-array (got ${typeof all})`);

  const pendingSet = new Set(pendingVotes);
  const want = new Set(allVotes);
  const matched = all.filter((v) => v && typeof v.vote_identity === 'string' && want.has(v.vote_identity));

  // Country tally
  const tally = new Map();
  for (const v of matched) {
    const key = v.ip_country || 'Unknown';
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  const byCountry = [...tally.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));

  // Slim per-validator records — just what the UI needs.
  const validators = matched.map((v) => ({
    vote:     v.vote_identity,
    identity: v.identity,
    name:     v.name || null,
    country:  v.ip_country || null,
    city:     v.ip_city || null,
    lat:      v.ip_latitude  != null ? Number(v.ip_latitude)  : null,
    lng:      v.ip_longitude != null ? Number(v.ip_longitude) : null,
    asn:      v.ip_org || null,
    activatedStakeSol: v.activated_stake != null ? Number(v.activated_stake) : null,
    commission:        v.commission     != null ? Number(v.commission)      : null,
    website:           v.website || null,
    image:             v.image   || null,
    ...(pendingSet.has(v.vote_identity) ? { pending: true } : {}),
  }));

  // Pool members Stakewiz doesn't know still belong in the file — a validator
  // must never be invisible to the direct-stake search just because a third
  // party hasn't indexed it. Geo fields stay null; the UI already guards.
  const matchedVotes = new Set(validators.map((v) => v.vote));
  for (const vote of allVotes) {
    if (!matchedVotes.has(vote)) {
      console.log(`  (no Stakewiz record for ${vote} — including without geo)`);
      validators.push({
        vote, identity: null, name: null, country: null, city: null,
        lat: null, lng: null, asn: null, activatedStakeSol: null,
        commission: null, website: null, image: null,
        ...(pendingSet.has(vote) ? { pending: true } : {}),
      });
    }
  }

  const out = {
    lastFetchedAt: new Date().toISOString(),
    expected: allVotes.length,
    matched: matched.length,
    pending: pendingVotes.length,
    countries: byCountry.length,
    byCountry,
    validators,
    source: new URL(STAKEWIZ_URL).host,
  };

  await atomicWriteJson(VALIDATORS_PATH, out);
  console.log(
    `wrote ${VALIDATORS_PATH}: ${matched.length}/${allVotes.length} matched ` +
    `(${votePubkeys.length} in pool + ${pendingVotes.length} pending), ${byCountry.length} countries`,
  );
}

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

  // Validator geo runs at most once per day. Failures here don't fail the
  // whole job — the stats portion already wrote, and the prior validators.json
  // (if any) is still intact.
  try {
    const pendingVotes = await fetchPendingVotes(vlist.votePubkeys);
    if (pendingVotes.length) console.log(`pending (Notion-Active, not yet on-chain): ${pendingVotes.length}`);
    await maybeRefreshValidators(vlist.votePubkeys, pendingVotes);
  } catch (err) {
    console.error(`validator geo refresh skipped: ${err.message}`);
  }
}

main().catch((err) => {
  console.error(`fetch-pool-stats: ${err.message}`);
  process.exit(1);
});
