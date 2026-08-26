import { NextResponse } from 'next/server';

// Live pool-fee projection for the unlisted /ops/fee-projection page.
//
// TWO figures, deliberately:
//  · OBSERVED (headline, accurate): the operator's actual take, ~3.4 definSOL/epoch,
//    projected to a month using the live epoch cadence. This is ground truth.
//  · APY MODEL (cross-check): TVL × gross APY × 7.5% fee. Gross = net / (1 − fee),
//    since the 7.5% is skimmed off gross staking rewards. This runs ~40% hot versus
//    the observed take (baseApyPct overstates the pool's realised yield), so it's shown
//    only as a sanity comparison, not the headline.
//
// TVL, APY and the definSOL⇄SOL exchange rate come from the site's hourly stats.json;
// SOL→USD/NZD from CoinGecko; epoch length live from slot time. Everything overridable
// via query (?perEpoch=&apy=&fee=&tvl=&sol=&nzd=&epochDays=).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_FEE_PCT = 7.5;
const DEFAULT_PER_EPOCH_DEFSOL = 3.4;   // operator-observed, last 2 epochs (2026-08)
const DEFAULT_EPOCH_DAYS = 1.83;        // measured fallback (epochs 1021–1022 ran 43.9 h)
const SLOTS_PER_EPOCH = 432_000;
const YEAR_DAYS = 365.25;
const MONTH_DAYS = 30.4375;
const COINGECKO = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,nzd';
const PUBLIC_RPC = process.env.PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

type Stats = { totalSol?: number; baseApyPct?: number; exchangeRate?: number; updatedAt?: string; gdi?: { epoch?: number } };

const loopback = (path: string) => `http://127.0.0.1:${process.env.PORT || '3000'}${path}`;

async function fetchStats(): Promise<Stats | null> {
  // Loopback, not the public hostname: behind Cloudflare + the Cloudflare-only origin
  // firewall a server-side fetch of the public URL loops the edge and fails.
  try {
    const r = await fetch(loopback('/stats.json'), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as Stats) : null;
  } catch {
    return null;
  }
}

async function fetchSolPrice(): Promise<{ usd: number | null; nzd: number | null; source: string | null }> {
  // Two attempts — CoinGecko's free tier blips under bursty polling; one retry clears most.
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
      /* retry once, then give up gracefully (SOL amounts still render; fiat shows —) */
    }
  }
  return { usd: null, nzd: null, source: null };
}

// Live epoch length from recent slot time (public RPC); falls back to the measured default.
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
  const feePct = numParam(url.searchParams.get('fee')) ?? DEFAULT_FEE_PCT;
  const exchangeRate = typeof stats?.exchangeRate === 'number' && stats.exchangeRate > 0 ? stats.exchangeRate : 1;
  const solUsd = numParam(url.searchParams.get('sol')) ?? price.usd;
  const solNzd = numParam(url.searchParams.get('nzd')) ?? price.nzd;
  const perEpochDefSol = numParam(url.searchParams.get('perEpoch')) ?? DEFAULT_PER_EPOCH_DEFSOL;
  const epochDays = numParam(url.searchParams.get('epochDays')) ?? epochLen.days;

  if (tvlSol == null || netApyPct == null) {
    return NextResponse.json(
      { ok: false, error: 'Live stats unavailable (TVL / APY). Try again shortly.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  const epochsPerYear = YEAR_DAYS / epochDays;
  const epochsPerMonth = MONTH_DAYS / epochDays;
  const feeFrac = feePct / 100;
  const grossApyPct = netApyPct / (1 - feeFrac); // 7.5% skimmed off gross → gross = net / 0.925
  const usd = (sol: number) => (solUsd != null ? sol * solUsd : null);
  const nzd = (sol: number) => (solNzd != null ? sol * solNzd : null);

  // OBSERVED (headline): the operator's actual take.
  const obsEpochSol = perEpochDefSol * exchangeRate;
  const obsMonthSol = obsEpochSol * epochsPerMonth;
  const obsYearSol = obsEpochSol * epochsPerYear;
  const observed = {
    perEpochDefSol,
    perEpochSol: obsEpochSol,
    monthlyDefSol: perEpochDefSol * epochsPerMonth,
    monthly: { sol: obsMonthSol, usd: usd(obsMonthSol), nzd: nzd(obsMonthSol) },
    annual: { sol: obsYearSol, usd: usd(obsYearSol), nzd: nzd(obsYearSol) },
  };

  // APY MODEL (gross basis) — cross-check.
  const mdlYearSol = tvlSol * (grossApyPct / 100) * feeFrac;
  const mdlMonthSol = mdlYearSol / 12;
  const mdlEpochSol = mdlYearSol / epochsPerYear;
  const model = {
    basis: 'gross',
    grossApyPct,
    netApyPct,
    perEpochDefSol: exchangeRate > 0 ? mdlEpochSol / exchangeRate : null,
    monthly: { sol: mdlMonthSol, usd: usd(mdlMonthSol), nzd: nzd(mdlMonthSol) },
    annual: { sol: mdlYearSol, usd: usd(mdlYearSol), nzd: nzd(mdlYearSol) },
  };

  const modelVsObserved = observed.perEpochDefSol > 0 && model.perEpochDefSol != null
    ? model.perEpochDefSol / observed.perEpochDefSol
    : null;

  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      inputs: {
        tvlSol,
        netApyPct,
        grossApyPct,
        feePct,
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
        overridden: ['perEpoch', 'apy', 'fee', 'tvl', 'sol', 'nzd', 'epochDays'].filter((k) => url.searchParams.has(k)),
      },
      observed,
      model,
      modelVsObserved,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
