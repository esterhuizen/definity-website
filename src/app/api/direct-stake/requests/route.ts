import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { computeDirectedPlanned } from '@/lib/directed-planned.mjs';

// Live view of directed-stake requests. Reads the scanner's registry (the
// on-chain `direct:<vote>` deposit log) and enriches each request with LIVE
// on-chain state:
//   • depositor's current definSOL × NAV = the "still in place" check;
//   • PLANNED matching = retailMultiple × holdings-capped deposit (the target);
//   • DEPLOYED matching = directed pool stake actually placed, read from the
//     optimiser's deployments log (0/pending until the first approved cycle lands);
//   • the validator's current pool stake, for context.
// Read-only.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGISTRY_PATH = process.env.DIRECTED_REGISTRY_PATH ?? '/var/lib/definity-dsp/directed-stake-registry.jsonl';
const WEBHOOK_PATH = process.env.DIRECTED_WEBHOOK_PATH ?? '/var/lib/definity-staging/directed-stake-webhook.jsonl';
const DEPLOYMENTS_PATH = process.env.DIRECTED_DEPLOYMENTS_PATH ?? '/var/lib/definity-dsp/directed-deployments.jsonl';
const UPSTREAM = process.env.SOLANA_RPC_URL;
const POOL = 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL';
const VALIDATOR_LIST = '98BPxQ3qwLDQWRcuvWwFbAabJSprANhiUPuHndv3VP8M';
const DEFINSOL_MINT = 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA';

const RETAIL_MULTIPLE = 3.5;
const PER_VALIDATOR_CAP_SOL = 20_000;
const SLEEVE_CAP_SOL = 60_000;

type RegistryEntry = {
  signature: string;
  slot: number;
  blockTime: number | null;
  depositor: string;
  kind: 'retail' | 'partner' | 'both';
  validatorVote: string | null;
  partnerCode: string | null;
  depositLamports: number | null;
  depositSol: number | null;
};

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes: Buffer): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = '';
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) s = '1' + s;
    else break;
  }
  return s;
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(UPSTREAM!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result as T;
}

async function definsolHoldings(wallet: string): Promise<number> {
  const r = await rpc<{ value: Array<{ account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }> }>(
    'getTokenAccountsByOwner',
    [wallet, { mint: DEFINSOL_MINT }, { encoding: 'jsonParsed', commitment: 'confirmed' }],
  );
  let total = 0n;
  for (const a of r.value) total += BigInt(a.account.data.parsed.info.tokenAmount.amount);
  return Number(total) / 1e9;
}

async function poolNav(): Promise<number> {
  const r = await rpc<{ value: { data: [string, string] } | null }>('getAccountInfo', [POOL, { encoding: 'base64' }]);
  if (!r.value) return 1;
  const buf = Buffer.from(r.value.data[0], 'base64');
  const total = buf.readBigUInt64LE(258);
  const supply = buf.readBigUInt64LE(266);
  return supply > 0n ? Number(total) / Number(supply) : 1;
}

// Current pool stake the pool has delegated to each validator (active_stake from
// the ValidatorList account). Header 5 + count u32 @5; entries @9, 73 bytes each;
// active_stake u64 @+0, vote pubkey 32 @+41.
async function poolStakePerValidator(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  try {
    const r = await rpc<{ value: { data: [string, string] } | null }>('getAccountInfo', [VALIDATOR_LIST, { encoding: 'base64' }]);
    if (!r.value) return m;
    const buf = Buffer.from(r.value.data[0], 'base64');
    const count = buf.readUInt32LE(5);
    const ENTRY = 73;
    for (let i = 0; i < count; i++) {
      const base = 9 + i * ENTRY;
      if (base + ENTRY > buf.length) break;
      const active = Number(buf.readBigUInt64LE(base)) / 1e9;
      const vote = base58(buf.subarray(base + 41, base + 41 + 32));
      m.set(vote, active);
    }
  } catch {
    /* context only */
  }
  return m;
}

// Directed stake the optimiser has ACTUALLY deployed per validator. Written by
// the optimiser at go-live; absent/empty while the DSP is dry-run → all 0.
async function deployedPerValidator(): Promise<Map<string, number>> {
  // Append-only ledger; latest per validator, preferring a VERIFIED record over
  // the planned one within the same epoch.
  const latest = new Map<string, { epoch: number; verified: boolean; deployed: number }>();
  try {
    const txt = await readFile(DEPLOYMENTS_PATH, 'utf8');
    for (const line of txt.split('\n')) {
      if (!line.trim()) continue;
      const d = JSON.parse(line) as { validatorVote?: string; epoch?: number; deployedDirectedSol?: number; verified?: boolean };
      if (!d.validatorVote) continue;
      const epoch = d.epoch ?? 0;
      const verified = d.verified === true;
      const prev = latest.get(d.validatorVote);
      const take = !prev || epoch > prev.epoch || (epoch === prev.epoch && (verified || !prev.verified));
      if (take) latest.set(d.validatorVote, { epoch, verified, deployed: d.deployedDirectedSol ?? 0 });
    }
  } catch {
    /* no deployments yet → 0 */
  }
  const m = new Map<string, number>();
  for (const [v, r] of latest) m.set(v, r.deployed);
  return m;
}

async function loadValidatorNames(): Promise<Map<string, { name: string | null; city: string | null }>> {
  const map = new Map<string, { name: string | null; city: string | null }>();
  try {
    const txt = await readFile(`${process.cwd()}/public/validators.json`, 'utf8');
    const v = JSON.parse(txt) as { validators?: Array<{ vote: string; name: string | null; city: string | null }> };
    for (const x of v.validators ?? []) map.set(x.vote, { name: x.name, city: x.city });
  } catch {
    /* best-effort */
  }
  return map;
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export async function GET() {
  if (!UPSTREAM) return NextResponse.json({ error: 'RPC not configured' }, { status: 503 });

  // Merge the webhook registry (instant) + the cron registry (backstop),
  // deduped by signature. Webhook first so an instant entry wins; the cron later
  // records the same signature and is deduped away.
  const readEntries = async (path: string): Promise<RegistryEntry[]> => {
    try {
      const txt = await readFile(path, 'utf8');
      return txt.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as RegistryEntry);
    } catch {
      return [];
    }
  };
  const [webhookEntries, cronEntries] = await Promise.all([readEntries(WEBHOOK_PATH), readEntries(REGISTRY_PATH)]);
  const seen = new Set<string>();
  const entries: RegistryEntry[] = [];
  for (const e of [...webhookEntries, ...cronEntries]) {
    if (e.signature && !seen.has(e.signature)) {
      seen.add(e.signature);
      entries.push(e);
    }
  }

  const retail = entries.filter((e) => e.validatorVote && e.depositSol != null);
  const wallets = [...new Set(retail.map((e) => e.depositor))];

  const [epochInfo, nav, names, deployed, poolStakes, ...holdingsArr] = await Promise.all([
    rpc<{ epoch: number; absoluteSlot: number; slotIndex: number; slotsInEpoch: number }>('getEpochInfo', []),
    poolNav(),
    loadValidatorNames(),
    deployedPerValidator(),
    poolStakePerValidator(),
    ...wallets.map((w) => definsolHoldings(w)),
  ]);
  const holdings = new Map(wallets.map((w, i) => [w, holdingsArr[i] as number]));

  // Anti-gaming maturity (spec §Matching basis): a deposit earns no match until it
  // has been held continuously for a full epoch-DURATION sliding window — the
  // optimiser's trailing-minimum basis, NOT an epoch boundary. Display estimate from
  // deposit age + current holdings; the optimiser applies the exact trailing minimum
  // reconstructed from on-chain events. Credited once held for slotsInEpoch slots.
  const windowStartSlot = epochInfo.absoluteSlot - epochInfo.slotsInEpoch;
  const isMatured = (slot: number) => slot > 0 && slot < windowStartSlot;
  const maturesInHours = (slot: number) =>
    Math.round((Math.max(0, slot + epochInfo.slotsInEpoch - epochInfo.absoluteSlot) * 0.4 / 3600) * 10) / 10;

  // Directed target per deposit — recency-first (LIFO), from the shared helper so
  // the /requests view, the balance card and the landing usage indicator can't
  // drift apart. Current holdings back a wallet's MOST RECENT deposits first; each
  // still-held deposit earns 1× principal + RETAIL_MULTIPLE× matching once matured.
  const holdingsSolByWallet = new Map(wallets.map((w) => [w, (holdings.get(w) ?? 0) * nav]));
  const { bySig } = computeDirectedPlanned(
    retail.map((e) => ({ signature: e.signature, depositor: e.depositor, depositSol: e.depositSol!, slot: e.slot })),
    holdingsSolByWallet,
    windowStartSlot,
    RETAIL_MULTIPLE,
  );
  const plannedByValidator = new Map<string, number>();
  for (const e of retail) {
    plannedByValidator.set(e.validatorVote!, (plannedByValidator.get(e.validatorVote!) ?? 0) + (bySig.get(e.signature)?.plannedSol ?? 0));
  }

  // Deployed stake is a per-VALIDATOR lump on-chain; the optimiser builds it from
  // the deposits present at each cycle. Attribute a validator's deployed total to
  // its deposits OLDEST-first, capped at each deposit's planned — so a large,
  // freshly deposited principal that hasn't been directed yet doesn't appear
  // deployed (a proportional split wrongly handed it the lion's share).
  const deployedBySig = new Map<string, number>();
  for (const vote of new Set(retail.map((e) => e.validatorVote!))) {
    let remaining = deployed.get(vote) ?? 0;
    const votes = retail.filter((e) => e.validatorVote === vote).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
    for (const e of votes) {
      const d = Math.min(bySig.get(e.signature)?.plannedSol ?? 0, Math.max(0, remaining));
      deployedBySig.set(e.signature, d);
      remaining -= d;
    }
  }

  const requests = retail
    .map((e) => {
      const info = bySig.get(e.signature);
      const f = info?.backedFrac ?? 0;
      const backedSol = (e.depositSol ?? 0) * f; // this deposit's still-held portion, in SOL
      const matured = isMatured(e.slot);
      const plannedMatchSol = info?.plannedSol ?? 0;
      const deployedMatchSol = deployedBySig.get(e.signature) ?? 0;
      const vote = e.validatorVote!;
      // Status from the direct staker's POV — where their MATCH is in its journey:
      //   maturing  → still in the anti-gaming hold window
      //   awaiting  → cleared the window, match directs on the next optimiser cycle
      //   matched   → matching pool stake actually directed onto the validator
      //   reduced   → this deposit is only partly still backed (LIFO boundary)
      //   withdrawn → superseded by a more-recent deposit / fully exited; no match
      // Dust: < 0.01 SOL still backed → withdrawn (a fully-exited deposit or a
      // negligible NAV-rounding residual), so it doesn't read as an all-zero
      // "maturing" row.
      const status =
        backedSol < 0.01 ? 'withdrawn'
          : !matured ? 'maturing'
          : f < 0.999 ? 'reduced'
          : deployedMatchSol > 1e-9 ? 'matched'
          : 'awaiting';
      const vn = names.get(vote);
      return {
        signature: e.signature,
        depositor: e.depositor,
        validatorVote: vote,
        validatorName: vn?.name ?? null,
        validatorCity: vn?.city ?? null,
        depositSol: e.depositSol,
        // "Held now" = the portion of THIS deposit still backed (recency-first),
        // not the wallet's total holdings repeated on every row.
        holdingsSol: r6(backedSol),
        plannedMatchSol: r6(plannedMatchSol),
        deployedMatchSol: r6(deployedMatchSol),
        validatorPoolStakeSol: r6(poolStakes.get(vote) ?? 0),
        status,
        matured,
        maturesInHours: matured ? 0 : maturesInHours(e.slot),
        blockTime: e.blockTime,
        slot: e.slot,
      };
    })
    .sort((a, b) => (b.blockTime ?? 0) - (a.blockTime ?? 0));

  const plannedSol = [...plannedByValidator.values()].reduce((a, b) => a + b, 0);
  const deployedSol = [...plannedByValidator.keys()].reduce((a, v) => a + (deployed.get(v) ?? 0), 0);
  const depositedSol = retail.reduce((a, e) => a + (e.depositSol ?? 0), 0);

  const perValidator = [...plannedByValidator.entries()].map(([vote, planned]) => ({
    vote,
    name: names.get(vote)?.name ?? null,
    plannedMatchSol: r6(planned),
    deployedMatchSol: r6(deployed.get(vote) ?? 0),
    poolStakeSol: r6(poolStakes.get(vote) ?? 0),
  }));

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      nav: r6(nav),
      retailMultiple: RETAIL_MULTIPLE,
      perValidatorCapSol: PER_VALIDATOR_CAP_SOL,
      sleeveCapSol: SLEEVE_CAP_SOL,
      deployment: {
        // The DSP is live in production (optimiser wired + directing); deployedSol
        // stays 0 only until the first operator-approved cycle lands on-chain.
        live: process.env.DSP_LIVE === '1' || deployedSol > 1e-9,
        plannedSol: r6(plannedSol),
        deployedSol: r6(deployedSol),
        deployedPct: plannedSol > 0 ? Math.round((deployedSol / plannedSol) * 1000) / 10 : 0,
      },
      totals: {
        requests: requests.length,
        wallets: wallets.length,
        depositedSol: r6(depositedSol),
        plannedSol: r6(plannedSol),
        deployedSol: r6(deployedSol),
        sleeveUsedPct: Math.round((plannedSol / SLEEVE_CAP_SOL) * 1000) / 10,
        matched: requests.filter((r) => r.status === 'matched').length,
        awaiting: requests.filter((r) => r.status === 'awaiting').length,
        maturing: requests.filter((r) => r.status === 'maturing').length,
        reduced: requests.filter((r) => r.status === 'reduced').length,
        withdrawn: requests.filter((r) => r.status === 'withdrawn').length,
      },
      perValidator,
      requests,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
