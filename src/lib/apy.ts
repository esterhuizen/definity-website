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
// grows (the staking yield accrues into the rate). Same hourly feed; null on failure.
export async function getNav(): Promise<number | null> {
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
