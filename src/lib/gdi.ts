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
  stakeSol: number | null;
};

const GDI_BASE = 'https://gdindex.app';

// gdindex.app's default leaderboard ranks only pools at or above this TVL
// floor — it filters out sub-scale / single-validator pools that would
// otherwise top a rarity-weighted index (a 1-validator pool can post the
// highest GDI while being maximally centralised). Must stay in lock-step with
// SGDI's DEFAULT_TVL_FLOOR_SOL (sgdi/src/lib/leaderboard-config.ts); if they
// drift, the rank will disagree with the public leaderboard it links to — which
// would break the whole "independently verifiable" claim. The filter now runs in
// the collector (scripts/fetch-pool-stats.mjs); this value is the canonical copy it
// must mirror. Exported so it stays a referenced, documented constant.
export const GDI_MIN_TVL_SOL = 100_000;

export const GDI_URLS = {
  index: GDI_BASE,
  pool: `${GDI_BASE}/pools/${POOL.stakePoolAddress}`,
  methodology: `${GDI_BASE}/methodology`,
  repo: 'https://github.com/esterhuizen/sgdi',
};

// Read from the precomputed stats.json the collector writes hourly: it owns the
// gdindex fetch + the TVL-floor filter and keeps the last-good standing (age-bounded)
// on an outage, so this reader never hits gdindex at render and the callers never
// fabricate a rank. null if absent/expired → callers show "—".
export async function getGdiStanding(): Promise<GdiStanding | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const raw = await readFile(join(process.cwd(), 'public/stats.json'), 'utf8');
    const g = (JSON.parse(raw) as { gdi?: GdiStanding | null })?.gdi;
    return g && typeof g.rank === 'number' && typeof g.total === 'number' && typeof g.gdi === 'number' ? g : null;
  } catch {
    return null;
  }
}
