import { NextResponse } from 'next/server';
import { loadEconomics, numParam } from '@/lib/pool-economics';

// Live revenue-share figures for the public /revenue-share page.
//
// The offer: Definity keeps 5% of the gross staking rewards a stake generates
// (the pool charges 7.5% in total; Sanctum takes the other 2.5%). Half of
// Definity's 5% goes back to the staker, so the staker receives 2.5% of the
// gross rewards their own stake produced.
//
//   grossRewards(stake)  = stake × grossAPY            grossAPY = netAPY / (1 − 7.5%)
//   definityFee(stake)   = grossRewards × 5%
//   revShare(stake)      = definityFee × 50%           = stake × grossAPY × 2.5%
//
// Stated as yield, the share is an uplift of grossAPY × 2.5% in percentage
// POINTS on top of the net APY the staker already earns. It is NOT "2.5% APY":
// at a 5.6% gross yield it is about +0.14pp, which is roughly a third of the
// fee handed back. The page says so in those words, because the alternative
// reading is flattering and wrong.
//
// Query overrides: ?stake= (SOL, default 10000) &share= (% of Definity's fee,
// default 50) plus everything loadEconomics accepts (apy, poolFee, definityFee,
// tvl, sol, nzd, epochDays).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_STAKE_SOL = 10_000;
const DEFAULT_SHARE_PCT = 50; // half of Definity's fee
const MAX_STAKE_SOL = 10_000_000; // sanity bound so a pasted number cannot render nonsense

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;
  const e = await loadEconomics(p);

  const stakeSol = Math.min(numParam(p.get('stake')) ?? DEFAULT_STAKE_SOL, MAX_STAKE_SOL);
  const sharePct = Math.min(numParam(p.get('share')) ?? DEFAULT_SHARE_PCT, 100);

  if (e.netApyPct == null || e.grossApyPct == null) {
    return NextResponse.json(
      { ok: false, error: 'Live pool stats are unavailable right now. Try again shortly.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  // Annual figures first, then divided down: the epoch length moves, so anything
  // per-epoch has to be derived from the live cadence rather than a fixed count.
  const grossRewardsSol = stakeSol * (e.grossApyPct / 100);
  const definityFeeSol = grossRewardsSol * (e.definityFeePct / 100);
  const revShareSol = definityFeeSol * (sharePct / 100);

  // The uplift in percentage points on the staker's existing net yield.
  const upliftPp = e.grossApyPct * (e.definityFeePct / 100) * (sharePct / 100);
  const effectiveApyPct = e.netApyPct + upliftPp;
  // What fraction of the fee they paid comes back: 2.5 of 7.5 is a third.
  const feeReturnedPct = e.poolFeePct > 0 ? (e.definityFeePct * (sharePct / 100)) / e.poolFeePct * 100 : null;

  const perEpochSol = revShareSol / e.epochsPerYear;
  const perMonthSol = revShareSol / 12;
  const toDefSol = (sol: number) => (e.exchangeRate > 0 ? sol / e.exchangeRate : null);
  const usd = (sol: number) => (e.solUsd != null ? sol * e.solUsd : null);
  const nzd = (sol: number) => (e.solNzd != null ? sol * e.solNzd : null);
  const money = (sol: number) => ({ sol, defSol: toDefSol(sol), usd: usd(sol), nzd: nzd(sol) });

  return NextResponse.json(
    {
      ok: true,
      ts: new Date().toISOString(),
      inputs: {
        stakeSol,
        sharePct,
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
        epochsPerYear: e.epochsPerYear,
        epoch: e.epoch,
        tvlSol: e.tvlSol,
        statsUpdatedAt: e.statsUpdatedAt,
        overridden: ['stake', 'share', 'apy', 'poolFee', 'definityFee', 'tvl', 'sol', 'nzd', 'epochDays'].filter((k) =>
          p.has(k),
        ),
      },
      yield: {
        netApyPct: e.netApyPct,
        upliftPp,
        effectiveApyPct,
        feeReturnedPct,
      },
      perEpoch: money(perEpochSol),
      perMonth: money(perMonthSol),
      perYear: money(revShareSol),
      // Shown so the offer is auditable rather than asserted: this is the whole
      // fee the stake generates and how it splits three ways.
      breakdown: {
        grossRewardsSol,
        definityFeeSol,
        sanctumFeeSol: grossRewardsSol * (e.sanctumFeePct / 100),
        revShareSol,
        definityKeepsSol: definityFeeSol - revShareSol,
      },
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
