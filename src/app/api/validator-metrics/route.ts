import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { getGdiStanding } from '@/lib/gdi';

// Joins TWO authoritative sources so the page shows exactly what each system says:
//  · the optimiser's per-validator snapshot (validator-targets.json) — the ONLY source
//    of the directed/curve stake split and the sigmoid CURVE TARGET it steers toward;
//  · the published GDI pool file (the same data gdindex.app shows) — the authoritative
//    G score (gradient `g`), per-dimension rarities, geo, and the pool's GDI + rank.
// The optimiser's gradient equals the published `g` by construction; we surface the
// published value so it matches gdindex to the digit.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TARGETS_PATH = process.env.VALIDATOR_TARGETS_PATH ?? '/var/lib/definity-dsp/validator-targets.json';
// Verified on-chain directed stake per vote ({ vote: directedSol }), rewritten by the DSP
// at DEPLOYMENT+verification time — fresher than the optimiser's plan-time snapshot below.
const DIRECTED_VERIFIED_PATH = process.env.DIRECTED_VERIFIED_PATH ?? '/var/lib/definity-dsp/directed-verified.json';
const POOL = process.env.DEFINSOL_POOL ?? 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL';
const GDI_POOL_PATH =
  process.env.GDI_POOL_PATH ?? `/var/lib/sgdi/published/pools/${POOL}/latest.json`;

type OptRow = { vote: string; name: string | null; directedSol: number; curveSol: number; totalSol: number; targetCurveSol: number; gradient: number;
  // Plan-time geo (what the target/gradient were computed on). Compared against the LIVE geo
  // below to detect a validator that has moved since the plan — only those carry a stale target.
  country?: string | null; city?: string | null; asn?: string | null;
  // Model B (two-book): curve-book gradient + curve target (independent of directed) + total target.
  // Optional — absent in telemetry that predates model B, in which case the page falls back.
  gradientCurve?: number; curveTargetSol?: number; totalTargetSol?: number };
type OptSnap = { epoch: number; ts: string; params: { minStakeSol: number; maxStakeSol: number; curveK: number; incGradMin?: number; minMove?: number;
  curveCapSol?: number; directedCapSol?: number; totalCapSol?: number; curveScale?: number; availableCurveSol?: number }; validators: OptRow[] };
type GdiVal = { pubkey: string; g: number; r_country: number; r_city: number; r_asn: number; country: string | null; city: string | null; asn: string | null; asn_name: string | null; wiz_score: number | null; stake_sol: number };
type GdiPool = { score: { gdi: number; epoch: number }; rank: number; total_ranked: number; validators: GdiVal[] };

export async function GET() {
  let opt: OptSnap;
  try {
    opt = JSON.parse(await readFile(TARGETS_PATH, 'utf8')) as OptSnap;
  } catch {
    return NextResponse.json({ unavailable: true, validators: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  // VERIFIED directed (deployment-time) overrides the optimiser's plan-time directedSol, which
  // lags whenever directed is deployed AFTER the plan is written: the plan snapshot keeps the old
  // directed while the SGDI total (below) already reflects the freshly-landed stake, so total −
  // stale-directed dumps the new directed into CURVE (Hive epoch 1015→16: plan 6,802 vs verified
  // 18,000 → 11.2k phantom curve). Falls back to the telemetry figure per-validator when absent.
  let verifiedDirected: Record<string, number> = {};
  try {
    verifiedDirected = JSON.parse(await readFile(DIRECTED_VERIFIED_PATH, 'utf8')) as Record<string, number>;
  } catch {
    /* verified-directed unavailable — every validator falls back to its plan-time directedSol */
  }

  // Pool-level GDI + rank come from the TVL-floor-FILTERED standing (public/stats.json,
  // written hourly by the collector with the ≥100k-SOL pool floor) — this is what the
  // footer shows and what the public gdindex leaderboard ranks. The pool file's own
  // rank/total_ranked is UNFILTERED (counts sub-scale pools), so it disagrees with what
  // a validator sees on gdindex; we use it only as a fallback for the per-validator join.
  const standing = await getGdiStanding();
  let gdiByVote = new Map<string, GdiVal>();
  // The CURRENT network/scoring epoch (published GDI pool file). The optimiser targets below
  // (validator-targets.json) are AS-OF `epoch`; geo/rarity here are as-of liveEpoch. When
  // epoch < liveEpoch the plan predates the live geo — a validator that changed location since
  // then carries a stale gradient/target (gradient ranks on geo rarity), so the page must flag it.
  let liveEpoch: number | null = null;
  let pool: { gdi: number | null; rank: number | null; totalRanked: number | null } =
    { gdi: standing?.gdi ?? null, rank: standing?.rank ?? null, totalRanked: standing?.total ?? null };
  try {
    const g = JSON.parse(await readFile(GDI_POOL_PATH, 'utf8')) as GdiPool;
    gdiByVote = new Map(g.validators.map((v) => [v.pubkey, v]));
    liveEpoch = g.score?.epoch ?? null;
    pool = {
      gdi: standing?.gdi ?? g.score?.gdi ?? null,
      rank: standing?.rank ?? g.rank ?? null,
      totalRanked: standing?.total ?? g.total_ranked ?? null,
    };
  } catch {
    /* published GDI unavailable — fall back to the optimiser's own gradient below */
  }

  // A target/gradient is geo-derived and computed at plan time, so it is stale ONLY for a
  // validator whose LOCATION has changed since the plan — not for the whole pool just because
  // the plan epoch is behind. (The plan is normally an epoch behind for most of every epoch: it
  // re-runs ≥36h in, so a global "everything is stale" flag would blank the whole table ~most of
  // the time.) We flag a validator PER-VALIDATOR when its plan-time geo differs from live geo,
  // and only while the plan is actually behind. For a flagged validator we null the target at the
  // SOURCE (not just the page) so no direct consumer — embed, partner integration — reads an
  // authoritative-looking wrong number. Current stake / directed / geo / G stay live throughout.
  const planBehind = opt.epoch != null && liveEpoch != null && opt.epoch < liveEpoch;
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const validators = opt.validators.map((o) => {
    const g = gdiByVote.get(o.vote);
    // Moved iff we have live geo AND any dimension (country / city / ASN) differs from plan geo.
    const moved = planBehind && g != null && (
      norm(o.country) !== norm(g.country) ||
      norm(o.city) !== norm(g.city) ||
      norm(o.asn) !== norm(g.asn)
    );
    // CURRENT stake is read LIVE from the SGDI pool file (`stake_sol`, ≈30-min fresh)
    // instead of the optimiser's per-epoch snapshot, which is only rewritten when a plan
    // is generated (≥36h-gated) and so shows a stale, pre-execution number between epochs.
    // Directed comes from the VERIFIED on-chain map (deployment-fresh), falling back to the
    // optimiser telemetry, capped at the fresh total so the split stays consistent
    // (directed ≤ total, curve = total − directed).
    // Falls back to the optimiser total when the SGDI figure is absent (brand-new validator).
    const freshTotal = g?.stake_sol ?? o.totalSol;
    const directedRaw = verifiedDirected[o.vote] ?? o.directedSol;   // prefer verified on-chain directed
    const directed = Math.min(directedRaw, freshTotal);
    const curve = Math.max(0, freshTotal - directed);
    return {
      vote: o.vote,
      name: o.name,
      // Geo + G + rarities from the published GDI (authoritative, gdindex-matching); the
      // optimiser gradient is the fallback so a brand-new validator still shows a G.
      country: g?.country ?? null,
      city: g?.city ?? null,
      asn: g?.asn ?? null,
      asnName: g?.asn_name ?? null,
      g: g?.g ?? o.gradient,
      rCountry: g?.r_country ?? null,
      rCity: g?.r_city ?? null,
      rAsn: g?.r_asn ?? null,
      wizScore: g?.wiz_score ?? null,
      // Current stake split: SGDI-fresh total + optimiser directed (see above).
      totalSol: freshTotal,
      directedSol: directed,
      curveSol: curve,
      // Geo-derived + plan-time — nulled only for THIS validator when it has moved (see `moved`).
      stale: moved,                                                  // per-validator: target held back
      targetCurveSol: moved ? null : o.targetCurveSol,               // legacy total sigmoid (compat)
      gradientCurve: moved ? null : (o.gradientCurve ?? null),       // model B: curve-book gradient
      curveTargetSol: moved ? null : (o.curveTargetSol ?? null),     // model B: curve target
      totalTargetSol: moved ? null : (o.totalTargetSol ?? null),     // model B: directed + curve target
    };
  }).sort((a, b) => b.totalSol - a.totalSol);

  // Top-level flag drives the page banner: true iff at least one validator actually moved.
  const stale = validators.some((v) => v.stale);
  return NextResponse.json(
    { epoch: opt.epoch, liveEpoch, stale, ts: opt.ts, params: opt.params, pool, validators },
    { headers: { 'cache-control': 'no-store' } },
  );
}
