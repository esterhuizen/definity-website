// definSOL base staking APY — read from the precomputed stats.json the collector
// writes hourly. The collector owns the incentive-feed fetch and keeps the last-good
// value (age-bounded to ~a day) on a blip, so this reader never hits the feed at
// render and the caller never fabricates a number. null if absent/expired → "—".
export async function getBaseApy(): Promise<number | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const raw = await readFile(join(process.cwd(), 'public/stats.json'), 'utf8');
    const v = (JSON.parse(raw) as { baseApyPct?: number | null })?.baseApyPct;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

// definSOL → SOL redemption rate (NAV): how many SOL one definSOL is worth. It only
// grows (the staking yield accrues into the rate).
//
// Primary source: our own public/stats.json — written hourly by the
// definity-pool-stats timer straight from the on-chain pool account
// (totalLamports / poolTokenSupply), the authoritative rate. The incentives
// feed is fallback only: it relays Sanctum's sol-value API, which was observed
// frozen for weeks (2026-07: 1.0797 vs 1.0914 on-chain).
export async function getNav(): Promise<number | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const raw = await readFile(join(process.cwd(), 'public/stats.json'), 'utf8');
    const j = JSON.parse(raw) as { exchangeRate?: number; updatedAt?: string };
    const r = j?.exchangeRate;
    const ageOk = j?.updatedAt ? Date.now() - Date.parse(j.updatedAt) < 26 * 3600 * 1000 : false;
    if (typeof r === 'number' && r > 1 && r < 2 && ageOk) return r;
  } catch {
    /* fall through to the feed */
  }
  try {
    const res = await fetch('https://incentive.definity.finance/last24h.json', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { latest?: { defsol_exch_rate?: number } };
    const r = j?.latest?.defsol_exch_rate;
    return typeof r === 'number' && r > 1 && r < 2 ? r : null;
  } catch {
    return null;
  }
}

/** Directed-stake capacity used (%), read from the precomputed stats.json the
 *  collector writes — no on-chain work at render. null if absent (card shows a
 *  static fallback). */
export async function getDirectStakeUsedPct(): Promise<number | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const raw = await readFile(join(process.cwd(), 'public/stats.json'), 'utf8');
    const v = (JSON.parse(raw) as { directStakeUsedPct?: number })?.directStakeUsedPct;
    return typeof v === 'number' ? v : null;
  } catch {
    return null;
  }
}

// Total SOL staked in the pool — the authoritative on-chain figure from stats.json
// (age-guarded). Used for the hero's Total-staked tile so it matches StatsRow and can
// never diverge to a GDI-sourced fabrication. null if absent/stale → the caller shows "—".
export async function getTotalStakedSol(): Promise<number | null> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const raw = await readFile(join(process.cwd(), 'public/stats.json'), 'utf8');
    const j = JSON.parse(raw) as { totalSol?: number; updatedAt?: string };
    const ageOk = j?.updatedAt ? Date.now() - Date.parse(j.updatedAt) < 26 * 3600 * 1000 : false;
    return typeof j?.totalSol === 'number' && ageOk ? j.totalSol : null;
  } catch {
    return null;
  }
}
