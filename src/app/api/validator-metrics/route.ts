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
// LIVE geo — SGDI's flap-debounced current location per validator, republished every ~15 min.
// The GDI pool file above is FROZEN per epoch: it says where a validator was when the score was
// computed. This one says where it is NOW (a tuple only becomes "stable" after repeated sightings,
// so a flapping IP does not move anyone). Freshness is TIME-based on `computed_at` — stamped at the
// ingest tick — for the same reason as the live targets: its `epoch` stays put if the writer dies.
const GEO_LIVE_PATH = process.env.GEO_LIVE_PATH ?? '/var/lib/sgdi/published/geo-live.json';

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
// Live-geo file: the `country/city/asn` on a row is the STABLE (confirmed) tuple = current location;
// `candidate` is a location change seen but not yet confirmed, so it never replaces the stable one.
type GeoLiveCand = { country: string | null; city: string | null; asn: string | null; asn_name: string | null; count: number; first_seen: string };
type GeoLiveVal = { vote: string; country: string | null; city: string | null; asn: string | null; asn_name: string | null;
  stable_since: string | null; observations: number; present: boolean; last_seen: string; moving?: boolean; candidate?: GeoLiveCand };
type GeoLiveSnap = { schema: string; computed_at: string; published_at: string; epoch: number; stable_k: number; validators: GeoLiveVal[] };

const readSnap = async (path: string): Promise<OptSnap | null> => {
  try {
    const s = JSON.parse(await readFile(path, 'utf8')) as OptSnap;
    // Guard a valid-JSON-but-malformed/torn snapshot (the live file is rewritten every 15 min):
    // without a validators array the consumer would 500. Treat as absent → fall back to the other.
    return Array.isArray(s?.validators) ? s : null;
  } catch { return null; }
};

const readGeoLive = async (path: string): Promise<GeoLiveSnap | null> => {
  try {
    const s = JSON.parse(await readFile(path, 'utf8')) as GeoLiveSnap;
    // Same torn-read guard as readSnap, plus the schema tag: this file is rewritten every ~15 min,
    // and a shape we don't recognise must read as ABSENT (fall back to the frozen published geo)
    // rather than as "nobody has a location".
    return s?.schema === 'sgdi.geo-live/1' && Array.isArray(s?.validators) ? s : null;
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
  const [opt, liveRaw, geoRaw] = await Promise.all([readSnap(TARGETS_PATH), readSnap(LIVE_TARGETS_PATH), readGeoLive(GEO_LIVE_PATH)]);

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

  // Live-geo freshness — TIME-based on `computed_at`, on the SAME tiers as the live targets above
  // (one freshness convention on this page): ≤30 min fresh · 30 min–2 h degraded (shown, the writer
  // may be lagging) · >2 h broken → treated as ABSENT, so the page falls back to the frozen
  // published geo instead of presenting a two-hour-old location as "current".
  let geoState: 'fresh' | 'degraded' | null = null;
  let geoAgeMinutes: number | null = null;
  if (geoRaw?.computed_at) {
    const ms = Date.now() - Date.parse(geoRaw.computed_at);
    if (Number.isFinite(ms)) {
      geoAgeMinutes = Math.max(0, Math.round(ms / 60000));   // for display only
      // Raw-age comparison, as above, so the >2h cutoff is exact.
      if (ms <= 30 * 60000) geoState = 'fresh';
      else if (ms <= 120 * 60000) geoState = 'degraded';
    }
  }
  const geoLive = geoState != null ? geoRaw : null;          // usable live-geo snapshot, else null
  const geoByVote = new Map<string, GeoLiveVal>((geoLive?.validators ?? []).map((v) => [v.vote, v]));

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
  // Geo comparison against the LIVE file. A dimension only counts when BOTH sides report it: the
  // city is absent for ~1 in 4 validators (the MMDB has no city for that IP) and the two passes
  // don't always agree on which — comparing an absent city reports a move for a validator that has
  // not moved (that artifact is EVERY divergence in the pool today, 7 of 34). Absent ≠ changed.
  type Geo3 = { country?: string | null; city?: string | null; asn?: string | null };
  const dimDiffers = (a: string | null | undefined, b: string | null | undefined) =>
    norm(a) !== '' && norm(b) !== '' && norm(a) !== norm(b);
  const geoDiffers = (a: Geo3, b: Geo3) =>
    dimDiffers(a.country, b.country) || dimDiffers(a.city, b.city) || dimDiffers(a.asn, b.asn);

  const validators = src.validators.map((o) => {
    const g = gdiByVote.get(o.vote);
    const gl = geoByVote.get(o.vote);
    // Current location (stable tuple) + any unconfirmed change in flight. Null when the file is
    // absent/broken/stale or this validator has no stable tuple yet — the page then shows published.
    const liveGeo = gl == null ? null : {
      country: gl.country ?? null,
      city: gl.city ?? null,
      asn: gl.asn ?? null,
      asnName: gl.asn_name ?? null,
      stableSince: gl.stable_since ?? null,
      moving: gl.moving === true,
      candidate: gl.candidate
        ? { country: gl.candidate.country ?? null, city: gl.candidate.city ?? null, asn: gl.candidate.asn ?? null,
            count: gl.candidate.count, firstSeen: gl.candidate.first_seen }
        : null,
    };
    // Current location differs from the location the published score was computed on.
    const geoDiverged = liveGeo != null && g != null && geoDiffers(liveGeo, g);
    // Moved iff (plan path only) the validator's location differs from the plan-time geo. The
    // question is "did this validator move since the plan was computed", and the LIVE geo answers
    // it better than the published pool file — that file is itself frozen at the score epoch, so it
    // misses a move made after it. The frozen comparison stays as the degraded-path answer, raw:
    // both of its sides come out of the same enrichment pass, so an absent city means the same
    // thing on each and the original all-dimension compare holds.
    const moved = planBehind && (liveGeo != null
      ? geoDiffers(liveGeo, o)
      : g != null && (
          norm(o.country) !== norm(g.country) ||
          norm(o.city) !== norm(g.city) ||
          norm(o.asn) !== norm(g.asn)
        ));
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
      // Current location (live, ~15 min) alongside the published/frozen geo above — the page shows
      // live as "where you are" and keeps published as "what the score was computed on".
      liveGeo,
      geoDiverged,
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
      // Live-geo freshness (null = absent/broken/>2h → every row falls back to published geo).
      geoLive: geoLive != null ? { computedAt: geoLive.computed_at, ageMinutes: geoAgeMinutes, state: geoState } : null,
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
