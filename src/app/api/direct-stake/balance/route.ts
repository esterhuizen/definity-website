import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';

// "My Direct Stake Balance" — a single staker's view of their directed positions,
// the counterpart to /requests (the operator's all-wallets view). Grouped by
// validator, with the ACTUAL minted definSOL per deposit reconstructed from the
// deposit tx (the true LST amount, JPool-style), its current SOL value at NAV,
// the unstakable portion (capped at what they still hold), and — our differentiator
// over JPool's card — the matched stake Definity directs on top. Read-only.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REGISTRY_PATH = process.env.DIRECTED_REGISTRY_PATH ?? '/var/lib/definity-dsp/directed-stake-registry.jsonl';
const WEBHOOK_PATH = process.env.DIRECTED_WEBHOOK_PATH ?? '/var/lib/definity-staging/directed-stake-webhook.jsonl';
const DEPLOYMENTS_PATH = process.env.DIRECTED_DEPLOYMENTS_PATH ?? '/var/lib/definity-dsp/directed-deployments.jsonl';
const UPSTREAM = process.env.SOLANA_RPC_URL;
const POOL = 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL';
const DEFINSOL_MINT = 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA';
const RETAIL_MULTIPLE = 3.5;

type RegistryEntry = {
  signature: string;
  slot: number;
  blockTime: number | null;
  depositor: string;
  validatorVote: string | null;
  depositSol: number | null;
  mintedDefinsol?: number | null; // captured at ingest by the scanner/webhook
};

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

// FALLBACK ONLY: reconstruct minted definSOL from the deposit tx, for legacy
// records ingested before the scanner/webhook started storing it. New records
// carry mintedDefinsol, so this RPC is not hit on the hot path.
async function reconstructMinted(signature: string, depositor: string): Promise<number | null> {
  try {
    const tx = await rpc<{
      meta: {
        preTokenBalances?: Array<{ mint: string; owner: string; uiTokenAmount: { uiAmount: number | null } }>;
        postTokenBalances?: Array<{ mint: string; owner: string; uiTokenAmount: { uiAmount: number | null } }>;
      } | null;
    }>('getTransaction', [signature, { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' }]);
    if (!tx?.meta) return null;
    const pick = (arr?: Array<{ mint: string; owner: string; uiTokenAmount: { uiAmount: number | null } }>) =>
      (arr ?? []).filter((b) => b.mint === DEFINSOL_MINT && b.owner === depositor)
        .reduce((a, b) => a + (b.uiTokenAmount.uiAmount ?? 0), 0);
    return Math.max(0, pick(tx.meta.postTokenBalances) - pick(tx.meta.preTokenBalances));
  } catch {
    return null;
  }
}

type DeployRec = { deployed: number; target: number };
// The optimiser appends one record per directed validator per cycle. Take the
// LATEST (highest epoch) per validator = current deployed; `target` lets us
// attribute a wallet's share of the match without scanning every wallet.
async function deployedPerValidator(): Promise<Map<string, DeployRec>> {
  const latest = new Map<string, { epoch: number; verified: boolean; deployed: number; target: number }>();
  try {
    const txt = await readFile(DEPLOYMENTS_PATH, 'utf8');
    for (const line of txt.split('\n')) {
      if (!line.trim()) continue;
      const d = JSON.parse(line) as { validatorVote?: string; epoch?: number; deployedDirectedSol?: number; targetDirectedSol?: number; verified?: boolean };
      if (!d.validatorVote) continue;
      const epoch = d.epoch ?? 0;
      const verified = d.verified === true;
      const prev = latest.get(d.validatorVote);
      // Higher epoch wins; within an epoch a VERIFIED record beats the planned one,
      // and same-type records fall through to the latest in file order.
      const take = !prev || epoch > prev.epoch || (epoch === prev.epoch && (verified || !prev.verified));
      if (take) latest.set(d.validatorVote, { epoch, verified, deployed: d.deployedDirectedSol ?? 0, target: d.targetDirectedSol ?? 0 });
    }
  } catch { /* none yet → 0 */ }
  const m = new Map<string, DeployRec>();
  for (const [v, r] of latest) m.set(v, { deployed: r.deployed, target: r.target });
  return m;
}

async function loadValidatorNames(): Promise<Map<string, { name: string | null; city: string | null }>> {
  const map = new Map<string, { name: string | null; city: string | null }>();
  try {
    const txt = await readFile(`${process.cwd()}/public/validators.json`, 'utf8');
    const v = JSON.parse(txt) as { validators?: Array<{ vote: string; name: string | null; city: string | null }> };
    for (const x of v.validators ?? []) map.set(x.vote, { name: x.name, city: x.city });
  } catch { /* best-effort */ }
  return map;
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export async function GET(req: Request) {
  if (!UPSTREAM) return NextResponse.json({ error: 'RPC not configured' }, { status: 503 });
  const wallet = new URL(req.url).searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'wallet required' }, { status: 400 });

  const readEntries = async (path: string): Promise<RegistryEntry[]> => {
    try {
      const txt = await readFile(path, 'utf8');
      return txt.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as RegistryEntry);
    } catch { return []; }
  };
  const [webhookEntries, cronEntries] = await Promise.all([readEntries(WEBHOOK_PATH), readEntries(REGISTRY_PATH)]);
  // Dedup by signature; when a deposit appears in both logs, prefer the copy that
  // already carries mintedDefinsol so the read path doesn't reconstruct it.
  const bySig = new Map<string, RegistryEntry>();
  for (const e of [...webhookEntries, ...cronEntries]) {
    if (!e.signature || e.depositor !== wallet || !e.validatorVote || e.depositSol == null) continue;
    const prev = bySig.get(e.signature);
    if (!prev || (prev.mintedDefinsol == null && e.mintedDefinsol != null)) bySig.set(e.signature, e);
  }
  const mine = [...bySig.values()];

  const [epochInfo, nav, holding, names, deployed] = await Promise.all([
    rpc<{ epoch: number; absoluteSlot: number; slotIndex: number; slotsInEpoch: number }>('getEpochInfo', []),
    poolNav(),
    definsolHoldings(wallet),
    loadValidatorNames(),
    deployedPerValidator(),
  ]);

  if (mine.length === 0) {
    return NextResponse.json({ wallet, nav: r6(nav), retailMultiple: RETAIL_MULTIPLE, positions: [],
      totals: { directedDefinsol: 0, directedValueSol: 0, matchedPlannedSol: 0, matchedDeployedSol: 0 } },
      { headers: { 'cache-control': 'no-store' } });
  }

  // Prefer the minted definSOL captured at ingest; only reconstruct (1 RPC) for
  // legacy records that predate it. At scale this is zero extra RPC per load.
  const minted = await Promise.all(
    mine.map((e) => (e.mintedDefinsol != null ? Promise.resolve(e.mintedDefinsol) : reconstructMinted(e.signature, wallet))),
  );

  // Eligibility MATCHES the optimiser's trailing-minimum lookback (attributed-balance.ts):
  // the lookback window is a sliding `slotsInEpoch` slots, and a deposit is only credited
  // once it has been held for that whole window — i.e. ~1 epoch of DURATION, not merely
  // crossing a boundary. So each deposit matures `slotsInEpoch` slots after IT landed.
  const windowStartSlot = epochInfo.absoluteSlot - epochInfo.slotsInEpoch;
  const isMatured = (slot: number) => slot > 0 && slot < windowStartSlot;
  // Whole hours — also the grouping key, so tranches from the same cycle merge into one wave.
  const maturesInHours = (slot: number) =>
    Math.max(1, Math.round(Math.max(0, slot + epochInfo.slotsInEpoch - epochInfo.absoluteSlot) * 0.4 / 3600));

  const totalDirectedSol = mine.reduce((a, e) => a + (e.depositSol ?? 0), 0);
  const holdingsSol = holding * nav;
  // Fraction of directed deposits the wallet still holds (anti-overstate when they exit).
  const heldScale = totalDirectedSol > 0 ? Math.min(1, holdingsSol / totalDirectedSol) : 0;

  type Pos = {
    vote: string; name: string | null; city: string | null;
    directedDefinsol: number; directedSol: number; mintedDefinsol: number;
    principalSol: number; matchedPlannedSol: number; pendingMatchSol: number; matchedDeployedSol: number;
    deposits: number; allMatured: boolean; pendingByHour: Map<number, number>;
  };
  const byVote = new Map<string, Pos>();
  mine.forEach((e, i) => {
    const vote = e.validatorVote!;
    const p = byVote.get(vote) ?? {
      vote, name: names.get(vote)?.name ?? null, city: names.get(vote)?.city ?? null,
      directedDefinsol: 0, directedSol: 0, mintedDefinsol: 0,
      principalSol: 0, matchedPlannedSol: 0, pendingMatchSol: 0, matchedDeployedSol: 0, deposits: 0, allMatured: true, pendingByHour: new Map<number, number>(),
    };
    const m = minted[i];
    // Prefer the true minted amount; fall back to depositSol/nav if the tx read failed.
    const mintedAmt = m != null && m > 0 ? m : (e.depositSol ?? 0) / nav;
    p.mintedDefinsol += mintedAmt;
    p.directedSol += e.depositSol ?? 0;
    p.deposits += 1;
    // Principal: the user's own 1× stake — directed to their validator at the NEXT
    // cycle regardless of maturity (self-funded, claws back on withdrawal).
    p.principalSol += (e.depositSol ?? 0) * heldScale;
    // Matching uplift: RETAIL_MULTIPLE×, gated by the anti-gaming maturity window.
    const match = RETAIL_MULTIPLE * (e.depositSol ?? 0) * heldScale;
    if (isMatured(e.slot)) {
      // held a full lookback window → eligible (directs on the next optimiser cycle)
      p.matchedPlannedSol += match;
    } else {
      // not yet a full window old → matures slotsInEpoch slots after THIS deposit landed
      p.allMatured = false;
      p.pendingMatchSol += match;
      const h = maturesInHours(e.slot);
      p.pendingByHour.set(h, (p.pendingByHour.get(h) ?? 0) + match);
    }
    byVote.set(vote, p);
  });

  // Distribute the wallet's matured planned match into deployed via each validator's share.
  const positions = [...byVote.values()].map((p) => {
    const dep = deployed.get(p.vote);
    // The staker's share of the validator's deployed directed stake = their planned
    // match ÷ the validator's total target (materialised in the ledger), applied to
    // what's actually deployed — no full-registry scan needed.
    const share = dep && dep.target > 0 ? Math.min(1, (p.principalSol + p.matchedPlannedSol) / dep.target) : 0;
    // directed definSOL the staker holds for this validator (capped at what they still hold)
    p.directedDefinsol = p.mintedDefinsol * heldScale;
    return {
      vote: p.vote,
      name: p.name,
      city: p.city,
      directedDefinsol: r6(p.directedDefinsol),
      directedValueSol: r6(p.directedDefinsol * nav),
      // unstakable == directed (liquid LST), already capped by heldScale
      unstakableDefinsol: r6(p.directedDefinsol),
      unstakableValueSol: r6(p.directedDefinsol * nav),
      mintedDefinsol: r6(p.mintedDefinsol),
      principalSol: r6(p.principalSol),
      matchedPlannedSol: r6(p.matchedPlannedSol),
      pendingMatchSol: r6(p.pendingMatchSol),
      // total stake the validator receives: your 1× principal + up to RETAIL_MULTIPLE× matching
      directedTotalSol: r6(p.principalSol + p.matchedPlannedSol + p.pendingMatchSol),
      // each distinct maturity time (deposits at different slots vest at different times)
      pendingWaves: [...p.pendingByHour.entries()]
        .map(([hours, matchSol]) => ({ hours, matchSol: r6(matchSol) }))
        .sort((a, b) => a.hours - b.hours),
      matchedDeployedSol: r6(dep ? dep.deployed * share : 0),
      deposits: p.deposits,
      allMatured: p.allMatured,
    };
  }).sort((a, b) => b.directedValueSol - a.directedValueSol);

  const totals = {
    directedDefinsol: r6(positions.reduce((a, p) => a + p.directedDefinsol, 0)),
    directedValueSol: r6(positions.reduce((a, p) => a + p.directedValueSol, 0)),
    principalSol: r6(positions.reduce((a, p) => a + p.principalSol, 0)),
    matchedPlannedSol: r6(positions.reduce((a, p) => a + p.matchedPlannedSol, 0)),
    pendingMatchSol: r6(positions.reduce((a, p) => a + p.pendingMatchSol, 0)),
    directedTotalSol: r6(positions.reduce((a, p) => a + p.directedTotalSol, 0)),
    matchedDeployedSol: r6(positions.reduce((a, p) => a + p.matchedDeployedSol, 0)),
    holdingDefinsol: r6(holding),
  };

  return NextResponse.json(
    { wallet, nav: r6(nav), retailMultiple: RETAIL_MULTIPLE, matchingLive: totals.matchedDeployedSol > 1e-9, positions, totals },
    { headers: { 'cache-control': 'no-store' } },
  );
}
