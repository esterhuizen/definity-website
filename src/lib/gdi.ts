import { POOL } from '@/config/pool';

// definSOL's standing on the GDI — the open, reproducible geographic
// decentralisation index at gdindex.app. Fetched server-side so the number is
// always live and matches the public leaderboard (the whole point is that it's
// independently verifiable). Degrades gracefully to null if the index is
// unreachable, so callers render a static fallback rather than break.

export type GdiStanding = {
  rank: number;
  total: number;
  gdi: number;
  baseline: number | null;
  epoch: number | null;
};

const GDI_BASE = 'https://gdindex.app';

// gdindex.app's default leaderboard ranks only pools at or above this TVL
// floor — it filters out sub-scale / single-validator pools that would
// otherwise top a rarity-weighted index (a 1-validator pool can post the
// highest GDI while being maximally centralised). Must stay in lock-step with
// SGDI's DEFAULT_TVL_FLOOR_SOL (sgdi/src/lib/leaderboard-config.ts); if they
// drift, the rank shown here will disagree with the public leaderboard it links
// to — which would break the whole "independently verifiable" claim.
const GDI_MIN_TVL_SOL = 100_000;

export const GDI_URLS = {
  index: GDI_BASE,
  pool: `${GDI_BASE}/pools/${POOL.stakePoolAddress}`,
  methodology: `${GDI_BASE}/methodology`,
  repo: 'https://github.com/esterhuizen/sgdi',
};

export async function getGdiStanding(): Promise<GdiStanding | null> {
  try {
    const res = await fetch(`${GDI_BASE}/gdi/leaderboard-latest.json`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const lb = (await res.json()) as {
      epoch?: number;
      network_baseline?: { gdi?: number };
      pools?: { pool_address: string; gdi: number | null; total_stake_sol?: number | null }[];
    };
    // Apply the SAME TVL floor gdindex.app uses for its default leaderboard so
    // the rank reported here matches the public index the claim is verified
    // against. Without it, a sub-scale pool (e.g. a single validator in a rare
    // datacentre) tops the raw-GDI sort and pushes definSOL down a place.
    const pools = (lb.pools ?? [])
      .filter((p) => p.gdi != null && (p.total_stake_sol ?? 0) >= GDI_MIN_TVL_SOL)
      .sort((a, b) => (b.gdi ?? 0) - (a.gdi ?? 0));
    const idx = pools.findIndex((p) => p.pool_address === POOL.stakePoolAddress);
    if (idx < 0) return null;
    return {
      rank: idx + 1,
      total: pools.length,
      gdi: pools[idx].gdi as number,
      baseline: lb.network_baseline?.gdi ?? null,
      epoch: lb.epoch ?? null,
    };
  } catch {
    return null;
  }
}
