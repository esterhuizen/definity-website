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
import { computeDirectedPlanned, SLEEVE_CAP_SOL } from '../src/lib/directed-planned.mjs';

// RPC: prefer the conventional SOLANA_RPC_URL (what the site + the box already set
// to Helius); SOLANA_RPC kept only as a legacy fallback name; the public RPC is a
// last resort — it rate-limits the per-wallet token lookups the capacity % needs.
const RPC = process.env.SOLANA_RPC_URL || process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const POOL_ADDRESS = 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL';
const LST_MINT     = 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA';
const OUT_PATH        = resolve(process.argv[2] || 'public/stats.json');
const VALIDATORS_PATH = resolve(process.argv[3] || 'public/validators.json');
// Directed-stake registry + webhook (same files the /requests API reads). Paths
// derive from DSP_DIRECTED_DIR (the dir the pool-stats env sets) so a relocation is
// honoured; a per-file env var still overrides. Was: a stale hardcoded *staging*
// webhook path baked into this prod script.
const DSP_DIR = process.env.DSP_DIRECTED_DIR || '/var/lib/definity-dsp';
const DIRECTED_REGISTRY_PATH = process.env.DIRECTED_REGISTRY_PATH || `${DSP_DIR}/directed-stake-registry.jsonl`;
const DIRECTED_WEBHOOK_PATH  = process.env.DIRECTED_WEBHOOK_PATH  || `${DSP_DIR}/directed-stake-webhook.jsonl`;
// Cross-service hero sources the collector now owns + keeps last-good for, so the
// site never fabricates a number when a feed blips (see last-good in main()).
const INCENTIVE_FEED  = process.env.INCENTIVE_FEED_URL  || 'https://incentive.definity.finance/last24h.json';
const GDI_LEADERBOARD = process.env.GDI_LEADERBOARD_URL || 'https://gdindex.app/gdi/leaderboard-latest.json';
const GDI_MIN_TVL_SOL = 100_000; // MUST match src/lib/gdi.ts GDI_MIN_TVL_SOL + SGDI's floor

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
// Notion votes to surface in the widget even before they hold an on-chain pool
// seat, so direct-stakers can find them IMMEDIATELY (the deposit-maturity clock
// is wallet-bound and starts ticking before the seat exists). TWO sources:
//   (a) "Active in pool = Active" votes not yet in the on-chain list — approved
//       validators whose seat lands at the next optimiser approval.
//   (b) "Fast track (3k direct) = Whitelisted" votes — fast-track acceptors who
//       are admitted and ALLOWED to stake but have NOT yet reached the 3k
//       commitment, so their "Active in pool" is still inactive (James sets
//       only Whitelisted on acceptance; the timer flips Active in pool at
//       Active(staking)). They must be direct-stakeable so operators can build
//       toward the 3k. Fail-soft: no token / Notion error → empty list, the
//       site simply shows pool members.
async function fetchPendingVotes(poolVotes) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return [];
  // TWO single-property queries, unioned — NOT one OR filter. Notion silently drops
  // rows from complex (or/and) filters when not run via a saved view (observed live
  // on the pool-membership sync — a run dropped seated validators), which here would
  // transiently HIDE a stakeable validator from the widget. Single "equals"
  // predicates mirror the saved-view semantics and are reliable.
  const query = async (filter) => {
    const res = await fetch(
      'https://api.notion.com/v1/data_sources/c5bf5bae-c249-4503-a4d9-c6a4ca989834/query',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ page_size: 100, filter }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).results ?? [];
  };
  try {
    const rows = [
      ...(await query({ property: 'Active in pool', status: { equals: 'Active' } })),
      ...(await query({ property: 'Fast track (3k direct)', select: { equals: 'Whitelisted' } })),
    ];
    const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    const inPool = new Set(poolVotes);
    const pending = new Set(); // dedup: a vote matching both queries appears once
    for (const r of rows) {
      const t = (r.properties?.['Operator / Vote ID']?.title ?? []).map((x) => x.plain_text).join('').trim();
      const v = (r.properties?.['Vote ID']?.rich_text ?? []).map((x) => x.plain_text).join('').trim();
      const vote = B58.test(t) ? t : B58.test(v) ? v : null;
      if (vote && !inPool.has(vote)) pending.add(vote);
    }
    return [...pending];
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
  // must refresh immediately, or the widget shows stale state for up to 24h.
  // TWO kinds of change both count:
  //   (a) the vote SET gains/loses a pubkey (e.g. StakeCraft added, 2026-07-16).
  //   (b) a pubkey flips pending → active (or back): same set, same count, but
  //       its "joining" badge is now wrong (e.g. WEB34EVER added, 2026-07-18).
  //       Comparing only the vote set misses this, so compare the pending set too.
  const allVotes = [...votePubkeys, ...pendingVotes];
  const existingVotes = new Set((existing?.validators ?? []).map((v) => v?.vote).filter(Boolean));
  const existingPending = new Set((existing?.validators ?? []).filter((v) => v?.pending).map((v) => v.vote));
  const pendingNow = new Set(pendingVotes);
  const voteSetChanged = allVotes.some((v) => !existingVotes.has(v)) || existingVotes.size !== allVotes.length;
  const pendingSetChanged = pendingNow.size !== existingPending.size
    || [...pendingNow].some((v) => !existingPending.has(v));
  const setChanged = existing && (voteSetChanged || pendingSetChanged);

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

// Directed-stake capacity used (% of the 60k matching budget), precomputed here
// so the landing card just reads stats.json — no on-chain work at view time. Uses
// the SAME shared LIFO helper as the /requests API, so the two agree. Fail-soft:
// returns null on any error (registry missing, RPC hiccup), leaving the field out.
async function computeDirectStakeUsedPct(nav) {
  try {
    const readJsonl = (txt) => txt.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
    // The registry is REQUIRED: if it's unreadable (path drift / permissions) return
    // null so the caller keeps the last-good %, instead of silently computing 0% and
    // rendering a confident, wrong "0% capacity used". An empty-but-readable registry
    // legitimately yields 0 below. The webhook is optional (may be absent) → soft read.
    let cr;
    try {
      cr = readJsonl(await readFile(DIRECTED_REGISTRY_PATH, 'utf8'));
    } catch (e) {
      console.error(`direct-stake usage: registry unreadable (${DIRECTED_REGISTRY_PATH}): ${e.message}`);
      return null;
    }
    let wh = [];
    try { wh = readJsonl(await readFile(DIRECTED_WEBHOOK_PATH, 'utf8')); } catch { /* optional */ }
    const seen = new Set();
    const deposits = [];
    for (const e of [...wh, ...cr]) {
      if (!e.signature || seen.has(e.signature) || !e.validatorVote || e.depositSol == null || !e.depositor) continue;
      seen.add(e.signature);
      deposits.push({ signature: e.signature, depositor: e.depositor, depositSol: e.depositSol, slot: e.slot ?? 0 });
    }
    if (!deposits.length) return 0;

    const wallets = [...new Set(deposits.map((d) => d.depositor))];
    const epoch = await rpc('getEpochInfo', []);
    const holdRes = await Promise.all(
      wallets.map((w) => rpc('getTokenAccountsByOwner', [w, { mint: LST_MINT }, { encoding: 'jsonParsed', commitment: 'confirmed' }])),
    );
    const holdingsSolByWallet = new Map();
    wallets.forEach((w, i) => {
      let total = 0n;
      for (const a of holdRes[i].value) total += BigInt(a.account.data.parsed.info.tokenAmount.amount);
      holdingsSolByWallet.set(w, (Number(total) / 1e9) * (nav ?? 1));
    });
    const windowStartSlot = epoch.absoluteSlot - epoch.slotsInEpoch;
    const { totalSol } = computeDirectedPlanned(deposits, holdingsSolByWallet, windowStartSlot);
    return Math.round((totalSol / SLEEVE_CAP_SOL) * 1000) / 10;
  } catch (err) {
    console.error(`direct-stake usage skipped: ${err.message}`);
    return null;
  }
}

// Base staking APY from the incentives feed (defsol_yield_pct, validated band). The
// collector owns the fetch so the value can be kept last-good in stats.json; the site
// then reads the file instead of hitting the feed at render + fabricating on failure.
async function fetchBaseApy() {
  try {
    const res = await fetch(INCENTIVE_FEED, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const pct = j?.latest?.defsol_yield_pct;
    return typeof pct === 'number' && pct > 3 && pct < 12 ? pct : null;
  } catch (e) {
    console.error(`base APY fetch skipped: ${e.message}`);
    return null;
  }
}

// definSOL's GDI standing from gdindex.app, applying the SAME TVL floor the public
// leaderboard uses so the rank matches (the "independently verifiable" claim).
async function fetchGdiStanding() {
  try {
    const res = await fetch(GDI_LEADERBOARD, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const lb = await res.json();
    const pools = (lb.pools ?? [])
      .filter((p) => p.gdi != null && (p.total_stake_sol ?? 0) >= GDI_MIN_TVL_SOL)
      .sort((a, b) => (b.gdi ?? 0) - (a.gdi ?? 0));
    const idx = pools.findIndex((p) => p.pool_address === POOL_ADDRESS);
    if (idx < 0) return null;
    return {
      rank: idx + 1,
      total: pools.length,
      gdi: pools[idx].gdi,
      baseline: lb.network_baseline?.gdi ?? null,
      epoch: lb.epoch ?? null,
      stakeSol: pools[idx].total_stake_sol ?? null,
    };
  } catch (e) {
    console.error(`GDI standing fetch skipped: ${e.message}`);
    return null;
  }
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

  // Cross-service hero values (capacity %, base APY, GDI standing) are computed HERE
  // and KEPT LAST-GOOD in stats.json: on a source blip we re-use the previous value
  // (age-bounded to ~a day) rather than dropping to null — so the site reads a real,
  // recent number instead of fabricating one or blanking. On-chain figures (totalSol,
  // rate) are always fresh; if the pool account is unreachable the whole run throws
  // and the prior (served) stats.json stays intact.
  let prev = {};
  try { prev = JSON.parse(await readFile(OUT_PATH, 'utf8')); } catch { /* first run / missing */ }
  const nowIso = new Date().toISOString();
  const LAST_GOOD_MAX_AGE_MS = 26 * 3600 * 1000; // keep a stale value at most ~a day
  const lastGood = (fresh, prevVal, prevAt) =>
    fresh != null ? { v: fresh, at: nowIso }
    : (prevVal != null && prevAt && Date.now() - Date.parse(prevAt) < LAST_GOOD_MAX_AGE_MS)
        ? { v: prevVal, at: prevAt }
        : { v: null, at: null };

  const [freshDsPct, freshApy, freshGdi] = await Promise.all([
    computeDirectStakeUsedPct(exchangeRate),
    fetchBaseApy(),
    fetchGdiStanding(),
  ]);
  const dsLG  = lastGood(freshDsPct, prev.directStakeUsedPct, prev.directStakeUsedAsOf);
  const apyLG = lastGood(freshApy,   prev.baseApyPct,          prev.baseApyAsOf);
  const gdiLG = lastGood(freshGdi,   prev.gdi,                 prev.gdiAsOf);

  const stats = {
    validators: vlist.count,
    maxValidators: vlist.maxValidators,
    totalSol,
    totalLamports: pool.totalLamports.toString(),
    definsolSupply,
    definsolRawSupply: lstSupply.rawAmount.toString(),
    exchangeRate,
    directStakeUsedPct: dsLG.v,
    directStakeUsedAsOf: dsLG.at,
    baseApyPct: apyLG.v,
    baseApyAsOf: apyLG.at,
    gdi: gdiLG.v,
    gdiAsOf: gdiLG.at,
    updatedAt: nowIso,
    rpc: new URL(RPC).host,
    fetchedInMs: Date.now() - t0,
  };
  const stale = [dsLG, apyLG, gdiLG].some((x) => x.v != null && x.at !== nowIso);
  if (stale) console.log(`  ⚠ kept last-good for: ${[['capacity', dsLG], ['apy', apyLG], ['gdi', gdiLG]].filter(([, x]) => x.v != null && x.at !== nowIso).map(([n]) => n).join(', ')}`);

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
