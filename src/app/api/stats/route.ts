import { NextResponse } from 'next/server';
import { getGdiStanding, GDI_URLS } from '@/lib/gdi';
import { POOL } from '@/config/pool';

// Public stats API — the figures a person or institution actually wants
// (current APY, TVL, NAV, decentralisation), as clean JSON. Deliberately
// excludes the internal incentive cost model. Sourced server-side; the raw
// incentive feed stays internal.

export const revalidate = 600; // 10 min

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };

type Latest = {
  ts?: string;
  defsol_yield_pct?: number;
  sol_price?: number;
  defsol_exch_rate?: number;
  defsol_epoch?: number;
};

export async function GET() {
  const [feed, gdi] = await Promise.all([
    fetch('https://incentive.definity.finance/last24h.json', { next: { revalidate: 600 } })
      .then((r) => (r.ok ? (r.json() as Promise<{ latest?: Latest }>) : null))
      .catch(() => null),
    getGdiStanding(),
  ]);

  const L = feed?.latest ?? {};
  const apy = typeof L.defsol_yield_pct === 'number' && L.defsol_yield_pct > 3 && L.defsol_yield_pct < 12
    ? round(L.defsol_yield_pct, 2) : null;
  const solPrice = typeof L.sol_price === 'number' ? round(L.sol_price, 2) : null;
  const nav = typeof L.defsol_exch_rate === 'number' ? round(L.defsol_exch_rate, 6) : null;
  const epoch = typeof L.defsol_epoch === 'number' ? L.defsol_epoch : gdi?.epoch ?? null;

  const tvlSol = gdi?.stakeSol ?? null;
  const tvlUsd = tvlSol != null && solPrice != null ? Math.round(tvlSol * solPrice) : null;

  const score = gdi?.gdi ?? null;
  const baseline = gdi?.baseline ?? null;
  const pctAbove = score != null && baseline ? Math.round(((score - baseline) / baseline) * 100) : null;

  const body = {
    asOf: L.ts ?? null,
    token: { symbol: POOL.lstSymbol, mint: POOL.lstMint, decimals: 9, solPerToken: nav },
    pool: POOL.stakePoolAddress,
    apyPct: apy,
    apyMethod: 'NAV growth (Method A), annualised at live cadence',
    tvl: { sol: tvlSol != null ? Math.round(tvlSol) : null, usd: tvlUsd },
    decentralisation: {
      index: 'GDI',
      rank: gdi?.rank ?? null,
      of: gdi?.total ?? null,
      score: score != null ? round(score, 2) : null,
      networkBaseline: baseline != null ? round(baseline, 2) : null,
      pctAboveBaseline: pctAbove,
      source: gdi ? GDI_URLS.pool : GDI_URLS.index,
    },
    network: { epoch, solPriceUsd: solPrice },
    custody: 'non-custodial',
    program: 'Sanctum stake-pool (audited)',
    links: {
      site: 'https://definity.finance',
      stake: 'https://definity.finance/stake',
      verify: 'https://definity.finance/addresses',
    },
  };

  return NextResponse.json(body, {
    headers: { ...CORS, 'cache-control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=600' },
  });
}

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}
