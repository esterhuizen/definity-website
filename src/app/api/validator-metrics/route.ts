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
// LIVE curve targets — recomputed every 15 min from live stake+geo+rarities (definity-publish-
// targets.timer). Same schema as the plan file. This is "what the curve would target right now",
// so its numbers are correct all epoch; the plan file above lags for ~¾ of every epoch (≥36h gate).
// Freshness is TIME-based on its `ts` (see GET): its `epoch` is the SGDI score epoch and stays put
// when the publisher dies, so an epoch comparison cannot tell fresh from stalled.
const LIVE_TARGETS_PATH = process.env.LIVE_TARGETS_PATH ?? '/var/lib/definity-targets/validator-targets-live.json';
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

const readSnap = async (path: string): Promise<OptSnap | null> => {
  try {
    const s = JSON.parse(await readFile(path, 'utf8')) as OptSnap;
    // Guard a valid-JSON-but-malformed/torn snapshot (the live file is rewritten every 15 min):
    // without a validators array the consumer would 500. Treat as absent → fall back to the other.
    return Array.isArray(s?.validators) ? s : null;
  } catch { return null; }
};

export async function GET() {
  // TWO target sources, priority LIVE → PLAN:
  //  · LIVE (validator-targets-live.json): recomputed every 15 min from the current book, so its
  //    targets are correct all epoch. Used for display when fresh/stale (≤2h); when broken (>2h,
  //    publisher dead) we do NOT show its numbers — a stale-live figure presented as live is the
  //    exact failure it exists to remove.
  //  · PLAN (validator-targets.json): what the last APPROVED plan computed. Lags ~¾ of every epoch
  //    (≥36h gate). Kept as the >2h fallback + record of "targets as planned"; its `epoch` drives
  //    planBehind + mover-suppression in that fallback path only. NEVER swap planBehind to live.
  const [opt, liveRaw] = await Promise.all([readSnap(TARGETS_PATH), readSnap(LIVE_TARGETS_PATH)]);

  // Live-file freshness — TIME-based on `ts` (spec): ≤30 min fresh · 30 min–2 h stale-but-shown ·
  // >2 h broken → ignored for display (fall back to the plan file below).
  let liveState: 'fresh' | 'stale' | null = null;
  let liveAgeMinutes: number | null = null;
  let liveTs: string | null = null;
  if (liveRaw?.ts) {
    const ms = Date.now() - Date.parse(liveRaw.ts);
    if (Number.isFinite(ms)) {
      liveAgeMinutes = Math.max(0, Math.round(ms / 60000));   // for display only
      liveTs = liveRaw.ts;
      // Compare the RAW age so the >2h "broken" cutoff is exact — rounding to minutes would leak
      // ~30s past it, and the spec stresses "prefer nothing over a confident wrong number".
      if (ms <= 30 * 60000) liveState = 'fresh';
      else if (ms <= 120 * 60000) liveState = 'stale';
    }
  }
  const live = liveState != null ? liveRaw : null;   // usable live snapshot (fresh or stale), else null
  const useLive = live != null;
  const src = useLive ? live! : opt;                 // drives displayed targets/params (+ stake when live)
  if (src == null) {
    return NextResponse.json({ unavailable: true, validators: [] }, { headers: { 'cache-control': 'no-store' } });
  }

  // VERIFIED directed (deployment-time) overrides the PLAN file's plan-time directedSol, which lags
  // whenever directed is deployed AFTER the plan is written (Hive 1015→16: plan 6,802 vs verified
  // 18,000 → 11.2k phantom curve). Only needed on the plan-fallback path — the live file's own split
  // is already deployment-fresh. Falls back to the telemetry figure per-validator when absent.
  let verifiedDirected: Record<string, number> = {};
  if (!useLive) {
    try {
      verifiedDirected = JSON.parse(await readFile(DIRECTED_VERIFIED_PATH, 'utf8')) as Record<string, number>;
    } catch {
      /* verified-directed unavailable — every validator falls back to its plan-time directedSol */
    }
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

  // PLAN-FALLBACK only: a plan-time target is geo-derived, so it's stale ONLY for a validator whose
  // LOCATION changed since the plan — flag those PER-VALIDATOR (plan-geo vs live geo) and null just
  // their targets. Not evaluated on the live path (a live target already reflects the move).
  const planBehind = !useLive && opt != null && opt.epoch != null && liveEpoch != null && opt.epoch < liveEpoch;
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

  const validators = src.validators.map((o) => {
    const g = gdiByVote.get(o.vote);
    // Moved iff (plan path only) we have live geo AND any dimension differs from the plan-time geo.
    const moved = planBehind && g != null && (
      norm(o.country) !== norm(g.country) ||
      norm(o.city) !== norm(g.city) ||
      norm(o.asn) !== norm(g.asn)
    );
    // STAKE SPLIT.
    //  · Live path: use the live file's own totalSol/directedSol/curveSol — recomputed with the
    //    same book as its targets, so `totalTargetSol − totalSol` reconciles exactly (the delta the
    //    spec defines) and directed is already deployment-fresh.
    //  · Plan path: the plan snapshot's stake lags between epochs, so read the LIVE total from SGDI
    //    (`stake_sol`, ~30-min) and directed from the VERIFIED on-chain map, capped at the total.
    const total = useLive ? o.totalSol : (g?.stake_sol ?? o.totalSol);
    const directed = useLive
      ? Math.min(o.directedSol, total)
      : Math.min(verifiedDirected[o.vote] ?? o.directedSol, total);
    const curve = Math.max(0, total - directed);
    return {
      vote: o.vote,
      name: o.name,
      // Geo + G + rarities always from the published GDI (authoritative, gdindex-matching); the
      // source gradient is the fallback so a brand-new validator still shows a G.
      country: g?.country ?? null,
      city: g?.city ?? null,
      asn: g?.asn ?? null,
      asnName: g?.asn_name ?? null,
      g: g?.g ?? o.gradient,
      rCountry: g?.r_country ?? null,
      rCity: g?.r_city ?? null,
      rAsn: g?.r_asn ?? null,
      wizScore: g?.wiz_score ?? null,
      totalSol: total,
      directedSol: directed,
      curveSol: curve,
      // Targets: live path serves them straight (correct all epoch, never suppressed); plan path
      // nulls them only for a moved validator (its geo-derived target is genuinely stale).
      stale: moved,                                                  // per-validator: plan target held back
      targetCurveSol: moved ? null : o.targetCurveSol,               // legacy total sigmoid (compat)
      gradientCurve: moved ? null : (o.gradientCurve ?? null),       // model B: curve-book gradient
      curveTargetSol: moved ? null : (o.curveTargetSol ?? null),     // model B: curve target
      totalTargetSol: moved ? null : (o.totalTargetSol ?? null),     // model B: directed + curve target
    };
  }).sort((a, b) => b.totalSol - a.totalSol);

  // Banner flag: on the plan path, true iff ≥1 validator moved. On the live path there is nothing to
  // flag — the numbers are current — so it's always false.
  const stale = !useLive && validators.some((v) => v.stale);
  return NextResponse.json(
    {
      source: useLive ? 'live' : 'plan',
      epoch: src.epoch,                                  // display epoch (live score epoch, or plan epoch)
      liveEpoch,                                         // SGDI score epoch
      planEpoch: opt?.epoch ?? null,                     // last plan's epoch (fallback banner / record)
      liveTargets: useLive ? { ts: liveTs, ageMinutes: liveAgeMinutes, state: liveState } : null,
      // Fell back to the plan AND the plan is behind the live epoch → the numbers are stale and the
      // live path is down. Keyed off planBehind (not "live file present"), so an ABSENT/torn live
      // file surfaces the fallback banner too, instead of silently serving last-epoch numbers under
      // the page's "live" promise. When the plan is current (plan==live epoch) no banner is needed.
      liveTargetsDown: planBehind,
      stale,
      ts: src.ts,
      params: src.params,
      pool,
      validators,
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
