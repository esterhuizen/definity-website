// definSOL base staking APY — the real Method-A figure (NAV growth per epoch, annualised
// at the live cadence), sourced from the public incentives feed we already run hourly.
// INTERIM: Phase 1 wires the existing live number; a later phase can compute it natively
// in this app. Returns null on failure so the caller renders a sane fallback.
export async function getBaseApy(): Promise<number | null> {
  try {
    const res = await fetch('https://incentive.definity.finance/last24h.json', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { latest?: { defsol_yield_pct?: number } };
    const pct = j?.latest?.defsol_yield_pct;
    return typeof pct === 'number' && pct > 3 && pct < 12 ? pct : null;
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
