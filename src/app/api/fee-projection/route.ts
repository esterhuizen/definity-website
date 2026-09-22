import { NextResponse } from 'next/server';
import { loadEconomics, numParam, MONTH_DAYS, YEAR_DAYS } from '@/lib/pool-economics';

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
// The live inputs (TVL, netAPY, definSOL⇄SOL rate, SOL price, epoch length) come from
// @/lib/pool-economics, shared with the public /revenue-share calculator so the two pages
// cannot quote different economics. Overridable via query
// (?apy=&poolFee=&definityFee=&tvl=&sol=&nzd=&epochDays=&perEpoch=).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_OBSERVED_DEFSOL = 3.4; // operator-observed Definity take, last 2 epochs (2026-08)

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const e = await loadEconomics(p);

  const observedPerEpochDefSol = numParam(p.get('perEpoch')) ?? DEFAULT_OBSERVED_DEFSOL;

  if (e.tvlSol == null || e.netApyPct == null || e.grossApyPct == null) {
    return NextResponse.json(
      { ok: false, error: 'Live stats unavailable (TVL / APY). Try again shortly.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  // Definity's income = gross rewards × Definity's share.
  const annualSol = e.tvlSol * (e.grossApyPct / 100) * (e.definityFeePct / 100);
  const monthlySol = annualSol / 12;
  const perEpochSol = annualSol / e.epochsPerYear;
  const perEpochDefSol = e.exchangeRate > 0 ? perEpochSol / e.exchangeRate : null;
  const usd = (sol: number) => (e.solUsd != null ? sol * e.solUsd : null);
  const nzd = (sol: number) => (e.solNzd != null ? sol * e.solNzd : null);

  const ratioModelToObserved =
    perEpochDefSol != null && observedPerEpochDefSol > 0 ? perEpochDefSol / observedPerEpochDefSol : null;

  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      inputs: {
        tvlSol: e.tvlSol,
        netApyPct: e.netApyPct,
        grossApyPct: e.grossApyPct,
        poolFeePct: e.poolFeePct,
        definityFeePct: e.definityFeePct,
        sanctumFeePct: e.sanctumFeePct,
        exchangeRate: e.exchangeRate,
        solUsd: e.solUsd,
        solNzd: e.solNzd,
        priceSource: e.priceSource,
        priceUpdatedAt: e.priceUpdatedAt,
        epochDays: e.epochDays,
        epochDaysSource: e.epochDaysSource,
        epochsPerMonth: e.epochsPerMonth,
        epochsPerYear: e.epochsPerYear,
        epoch: e.epoch,
        statsUpdatedAt: e.statsUpdatedAt,
        observedPerEpochDefSol,
        overridden: ['apy', 'poolFee', 'definityFee', 'tvl', 'sol', 'nzd', 'epochDays', 'perEpoch'].filter((k) =>
          p.has(k),
        ),
        yearDays: YEAR_DAYS,
        monthDays: MONTH_DAYS,
      },
      perEpoch: { defSol: perEpochDefSol, sol: perEpochSol },
      monthly: {
        sol: monthlySol,
        usd: usd(monthlySol),
        nzd: nzd(monthlySol),
        defSol: monthlySol / (e.exchangeRate || 1),
      },
      annual: { sol: annualSol, usd: usd(annualSol), nzd: nzd(annualSol) },
      check: { observedPerEpochDefSol, ratioModelToObserved },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
