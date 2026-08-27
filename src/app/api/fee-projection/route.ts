import { NextResponse } from 'next/server';

// Live projection of DEFINITY's pool-fee income for the unlisted /ops/fee-projection page.
//
// The pool charges a 7.5% fee on gross staking rewards; of that, Definity keeps 5% and
// Sanctum takes 2.5%. So Definity's income is:
//
//   Definity annual (SOL) = TVL × grossAPY × 5%
//   grossAPY = netAPY / (1 − 7.5%)          (definSOL's published yield is net of the full fee)
//   monthly  = annual / 12 ;  per-epoch uses the live epoch length
//
// This reconciles with the operator's observed ~3.4 definSOL/epoch (shown as a check).
// TVL, netAPY and the definSOL⇄SOL rate come from the site's hourly stats.json; SOL→USD/NZD
// from CoinGecko; epoch length live from slot time. Overridable via query
// (?apy=&poolFee=&definityFee=&tvl=&sol=&nzd=&epochDays=&perEpoch=).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_POOL_FEE_PCT = 7.5;       // total pool fee on rewards
const DEFAULT_DEFINITY_FEE_PCT = 5.0;   // Definity's share (Sanctum takes the rest, 2.5%)
const DEFAULT_OBSERVED_DEFSOL = 3.4;    // operator-observed Definity take, last 2 epochs (2026-08)
const DEFAULT_EPOCH_DAYS = 1.83;        // measured fallback (epochs 1021–1022 ran ~43.9 h)
const SLOTS_PER_EPOCH = 432_000;
const YEAR_DAYS = 365.25;
const MONTH_DAYS = 30.4375;
const COINGECKO = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,nzd';
const PUBLIC_RPC = process.env.PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

type Stats = { totalSol?: number; baseApyPct?: number; exchangeRate?: number; updatedAt?: string; gdi?: { epoch?: number } };
const loopback = (path: string) => `http://127.0.0.1:${process.env.PORT || '3000'}${path}`;

async function fetchStats(): Promise<Stats | null> {
  try {
    const r = await fetch(loopback('/stats.json'), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as Stats) : null;
  } catch {
    return null;
  }
}

async function fetchSolPrice(): Promise<{ usd: number | null; nzd: number | null; source: string | null }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(COINGECKO, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const s = ((await r.json()) as { solana?: { usd?: number; nzd?: number } }).solana ?? {};
      const usd = typeof s.usd === 'number' && s.usd > 0 ? s.usd : null;
      const nzd = typeof s.nzd === 'number' && s.nzd > 0 ? s.nzd : null;
      if (usd == null) throw new Error('no usd');
      return { usd, nzd, source: 'coingecko' };
    } catch {
      /* retry once, then give up gracefully */
    }
  }
  return { usd: null, nzd: null, source: null };
}

async function fetchEpochDays(): Promise<{ days: number; source: 'live' | 'default' }> {
  try {
    const r = await fetch(PUBLIC_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getRecentPerformanceSamples', params: [8] }),
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const samples = ((await r.json()) as { result?: Array<{ numSlots: number; samplePeriodSecs: number }> }).result ?? [];
    const valid = samples.filter((s) => s.numSlots > 0 && s.samplePeriodSecs > 0);
    if (!valid.length) throw new Error('no samples');
    const slotSec = valid.reduce((a, s) => a + s.samplePeriodSecs / s.numSlots, 0) / valid.length;
    const days = (SLOTS_PER_EPOCH * slotSec) / 86_400;
    if (!(days > 0.5 && days < 5)) throw new Error(`implausible ${days}`);
    return { days, source: 'live' };
  } catch {
    return { days: DEFAULT_EPOCH_DAYS, source: 'default' };
  }
}

async function fetchChainEpoch(): Promise<number | null> {
  try {
    const r = await fetch(loopback('/api/rpc'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getEpochInfo', params: [] }),
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return null;
    const e = ((await r.json()) as { result?: { epoch?: number } }).result;
    return typeof e?.epoch === 'number' ? e.epoch : null;
  } catch {
    return null;
  }
}

const numParam = (v: string | null): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const [stats, price, epochLen, chainEpoch] = await Promise.all([
    fetchStats(),
    fetchSolPrice(),
    fetchEpochDays(),
    fetchChainEpoch(),
  ]);

  const tvlSol = numParam(url.searchParams.get('tvl')) ?? (typeof stats?.totalSol === 'number' ? stats.totalSol : null);
  const netApyPct = numParam(url.searchParams.get('apy')) ?? (typeof stats?.baseApyPct === 'number' ? stats.baseApyPct : null);
  const poolFeePct = numParam(url.searchParams.get('poolFee')) ?? DEFAULT_POOL_FEE_PCT;
  const definityFeePct = numParam(url.searchParams.get('definityFee')) ?? DEFAULT_DEFINITY_FEE_PCT;
  const exchangeRate = typeof stats?.exchangeRate === 'number' && stats.exchangeRate > 0 ? stats.exchangeRate : 1;
  const solUsd = numParam(url.searchParams.get('sol')) ?? price.usd;
  const solNzd = numParam(url.searchParams.get('nzd')) ?? price.nzd;
  const observedPerEpochDefSol = numParam(url.searchParams.get('perEpoch')) ?? DEFAULT_OBSERVED_DEFSOL;
  const epochDays = numParam(url.searchParams.get('epochDays')) ?? epochLen.days;

  if (tvlSol == null || netApyPct == null) {
    return NextResponse.json(
      { ok: false, error: 'Live stats unavailable (TVL / APY). Try again shortly.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  const epochsPerYear = YEAR_DAYS / epochDays;
  const epochsPerMonth = MONTH_DAYS / epochDays;
  const sanctumFeePct = Math.max(0, poolFeePct - definityFeePct);
  const grossApyPct = netApyPct / (1 - poolFeePct / 100); // net yield is after the FULL pool fee

  // Definity's income = gross rewards × Definity's share.
  const annualSol = tvlSol * (grossApyPct / 100) * (definityFeePct / 100);
  const monthlySol = annualSol / 12;
  const perEpochSol = annualSol / epochsPerYear;
  const perEpochDefSol = exchangeRate > 0 ? perEpochSol / exchangeRate : null;
  const usd = (sol: number) => (solUsd != null ? sol * solUsd : null);
  const nzd = (sol: number) => (solNzd != null ? sol * solNzd : null);

  const ratioModelToObserved =
    perEpochDefSol != null && observedPerEpochDefSol > 0 ? perEpochDefSol / observedPerEpochDefSol : null;

  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      inputs: {
        tvlSol,
        netApyPct,
        grossApyPct,
        poolFeePct,
        definityFeePct,
        sanctumFeePct,
        exchangeRate,
        solUsd,
        solNzd,
        priceSource: price.source,
        epochDays,
        epochDaysSource: url.searchParams.has('epochDays') ? 'override' : epochLen.source,
        epochsPerMonth,
        epochsPerYear,
        epoch: chainEpoch ?? stats?.gdi?.epoch ?? null,
        statsUpdatedAt: stats?.updatedAt ?? null,
        observedPerEpochDefSol,
        overridden: ['apy', 'poolFee', 'definityFee', 'tvl', 'sol', 'nzd', 'epochDays', 'perEpoch'].filter((k) => url.searchParams.has(k)),
      },
      perEpoch: { defSol: perEpochDefSol, sol: perEpochSol },
      monthly: { sol: monthlySol, usd: usd(monthlySol), nzd: nzd(monthlySol), defSol: monthlySol / (exchangeRate || 1) },
      annual: { sol: annualSol, usd: usd(annualSol), nzd: nzd(annualSol) },
      check: { observedPerEpochDefSol, ratioModelToObserved },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
