import { NextResponse } from 'next/server';

// Live pool-fee projection for the unlisted /ops/fee-projection page.
//
//   annual pool fee (SOL) = TVL_SOL × (APY% / 100) × (fee% / 100)
//   monthly               = annual / 12         (run-rate, not booked revenue)
//
// TVL + APY come from the site's own hourly stats.json (totalSol, baseApyPct — the
// same numbers the homepage shows). SOL→USD and SOL→NZD come live from CoinGecko.
// Every input is overridable via query (?tvl=&apy=&fee=&sol=&nzd=) for what-ifs;
// with no query params the projection is fully live.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_FEE_PCT = 7.5;
const COINGECKO = 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,nzd';

type Stats = { totalSol?: number; baseApyPct?: number; updatedAt?: string; gdi?: { epoch?: number } };

async function fetchStats(): Promise<Stats | null> {
  // Read the site's own hourly stats.json over LOOPBACK — not the public hostname:
  // behind Cloudflare (with a Cloudflare-only origin firewall) a server-side fetch of
  // https://definity.finance/stats.json loops through the edge and fails. 127.0.0.1:PORT
  // hits this same Next process directly and is robust across prod/staging/dev.
  const url = process.env.STATS_JSON_URL || `http://127.0.0.1:${process.env.PORT || '3000'}/stats.json`;
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return (await r.json()) as Stats;
  } catch {
    return null;
  }
}

async function fetchSolPrice(): Promise<{ usd: number | null; nzd: number | null; source: string | null }> {
  try {
    const r = await fetch(COINGECKO, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const s = ((await r.json()) as { solana?: { usd?: number; nzd?: number } }).solana ?? {};
    const usd = typeof s.usd === 'number' && s.usd > 0 ? s.usd : null;
    const nzd = typeof s.nzd === 'number' && s.nzd > 0 ? s.nzd : null;
    if (usd == null) throw new Error('no usd');
    return { usd, nzd, source: 'coingecko' };
  } catch {
    return { usd: null, nzd: null, source: null };
  }
}

const numParam = (v: string | null): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const [stats, price] = await Promise.all([fetchStats(), fetchSolPrice()]);

  const liveTvl = typeof stats?.totalSol === 'number' ? stats.totalSol : null;
  const liveApy = typeof stats?.baseApyPct === 'number' ? stats.baseApyPct : null;

  // What-if overrides (default to live).
  const tvlSol = numParam(url.searchParams.get('tvl')) ?? liveTvl;
  const apyPct = numParam(url.searchParams.get('apy')) ?? liveApy;
  const feePct = numParam(url.searchParams.get('fee')) ?? DEFAULT_FEE_PCT;
  const solUsd = numParam(url.searchParams.get('sol')) ?? price.usd;
  const solNzd = numParam(url.searchParams.get('nzd')) ?? price.nzd;

  if (tvlSol == null || apyPct == null) {
    return NextResponse.json(
      { ok: false, error: 'Live stats unavailable (TVL / APY). Try again shortly.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  const annualFeeSol = tvlSol * (apyPct / 100) * (feePct / 100);
  const monthlyFeeSol = annualFeeSol / 12;
  const dailyFeeSol = annualFeeSol / 365;
  const conv = (sol: number, px: number | null) => (px != null ? sol * px : null);

  const overridden = ['tvl', 'apy', 'fee', 'sol', 'nzd'].filter((k) => url.searchParams.has(k));

  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      inputs: {
        tvlSol,
        apyPct,
        feePct,
        solUsd,
        solNzd,
        priceSource: price.source,
        epoch: stats?.gdi?.epoch ?? null,
        statsUpdatedAt: stats?.updatedAt ?? null,
        overridden,
      },
      sol: { annual: annualFeeSol, monthly: monthlyFeeSol, daily: dailyFeeSol },
      usd: { annual: conv(annualFeeSol, solUsd), monthly: conv(monthlyFeeSol, solUsd), daily: conv(dailyFeeSol, solUsd) },
      nzd: { annual: conv(annualFeeSol, solNzd), monthly: conv(monthlyFeeSol, solNzd), daily: conv(dailyFeeSol, solNzd) },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
