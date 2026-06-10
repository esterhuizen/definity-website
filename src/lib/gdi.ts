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
      pools?: { pool_address: string; gdi: number | null }[];
    };
    const pools = (lb.pools ?? [])
      .filter((p) => p.gdi != null)
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
