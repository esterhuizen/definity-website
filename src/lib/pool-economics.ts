// Shared live inputs for anything that prices the definSOL pool.
//
// Extracted from /api/fee-projection so the operator-facing projection and the
// public revenue-share calculator cannot drift apart. Both pages publish money
// figures; if the fee split or the APY basis is ever restated it has to change
// in exactly one place.
//
// The one piece of arithmetic that is easy to get wrong, stated once here:
// definSOL's published yield is NET of the entire 7.5% pool fee, so the gross
// rewards a stake actually generates are netAPY / (1 - poolFee). Every fee
// share is taken off that gross figure, never off the net one.

const DEFAULT_POOL_FEE_PCT = 7.5; // total pool fee charged on gross staking rewards
const DEFAULT_DEFINITY_FEE_PCT = 5.0; // Definity's cut; Sanctum takes the remaining 2.5%
const DEFAULT_EPOCH_DAYS = 1.83; // fallback only; the live measurement is preferred
const SLOTS_PER_EPOCH = 432_000;
export const YEAR_DAYS = 365.25;
export const MONTH_DAYS = 30.4375;

const COINGECKO =
  'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,nzd&include_last_updated_at=true';
const PUBLIC_RPC = process.env.PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com';

export type Stats = {
  totalSol?: number;
  baseApyPct?: number;
  exchangeRate?: number;
  updatedAt?: string;
  gdi?: { epoch?: number };
};

const loopback = (path: string) => `http://127.0.0.1:${process.env.PORT || '3000'}${path}`;

export async function fetchStats(): Promise<Stats | null> {
  try {
    const r = await fetch(loopback('/stats.json'), { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as Stats) : null;
  } catch {
    return null;
  }
}

export async function fetchSolPrice(): Promise<{
  usd: number | null;
  nzd: number | null;
  source: string | null;
  updatedAt: string | null;
}> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(COINGECKO, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const s = ((await r.json()) as { solana?: { usd?: number; nzd?: number; last_updated_at?: number } }).solana ?? {};
      const usd = typeof s.usd === 'number' && s.usd > 0 ? s.usd : null;
      const nzd = typeof s.nzd === 'number' && s.nzd > 0 ? s.nzd : null;
      if (usd == null) throw new Error('no usd');
      // CoinGecko's own last-updated time: when the price was current, not when we asked.
      const updatedAt = typeof s.last_updated_at === 'number' ? new Date(s.last_updated_at * 1000).toISOString() : null;
      return { usd, nzd, source: 'coingecko', updatedAt };
    } catch {
      /* retry once, then degrade to no price rather than a stale guess */
    }
  }
  return { usd: null, nzd: null, source: null, updatedAt: null };
}

export async function fetchEpochDays(): Promise<{ days: number; source: 'live' | 'default' }> {
  try {
    const r = await fetch(PUBLIC_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getRecentPerformanceSamples', params: [8] }),
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const samples = ((await r.json()) as { result?: Array<{ numSlots: number; samplePeriodSecs: number }> }).result ?? [];
    const valid = samples.filter((s) => s.numSlots > 0 && s.samplePeriodSecs > 0);
    if (!valid.length) throw new Error('no samples');
    const slotSec = valid.reduce((a, s) => a + s.samplePeriodSecs / s.numSlots, 0) / valid.length;
    const days = (SLOTS_PER_EPOCH * slotSec) / 86_400;
    // Bounds the physics, not the current era: slot times have fallen from 400ms
    // toward ~317ms and are expected to fall further, so this must not encode
    // today's cadence as the plausible range.
    if (!(days > 0.5 && days < 5)) throw new Error(`implausible ${days}`);
    return { days, source: 'live' };
  } catch {
    return { days: DEFAULT_EPOCH_DAYS, source: 'default' };
  }
}

export async function fetchChainEpoch(): Promise<number | null> {
  try {
    const r = await fetch(loopback('/api/rpc'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getEpochInfo', params: [] }),
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return null;
    const e = ((await r.json()) as { result?: { epoch?: number } }).result;
    return typeof e?.epoch === 'number' ? e.epoch : null;
  } catch {
    return null;
  }
}

export const numParam = (v: string | null): number | null => {
  if (v == null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export type Economics = {
  tvlSol: number | null;
  netApyPct: number | null;
  grossApyPct: number | null;
  poolFeePct: number;
  definityFeePct: number;
  sanctumFeePct: number;
  exchangeRate: number;
  solUsd: number | null;
  solNzd: number | null;
  priceSource: string | null;
  priceUpdatedAt: string | null;
  epochDays: number;
  epochDaysSource: 'live' | 'default' | 'override';
  epochsPerYear: number;
  epochsPerMonth: number;
  epoch: number | null;
  statsUpdatedAt: string | null;
};

/**
 * Every live input a money page needs, with query overrides applied. Overrides
 * exist so a figure can be modelled ("what if SOL were $200") without editing
 * code; the caller reports which ones were used so a page never presents an
 * assumption as a measurement.
 */
export async function loadEconomics(params: URLSearchParams): Promise<Economics> {
  const [stats, price, epochLen, chainEpoch] = await Promise.all([
    fetchStats(),
    fetchSolPrice(),
    fetchEpochDays(),
    fetchChainEpoch(),
  ]);

  const poolFeePct = numParam(params.get('poolFee')) ?? DEFAULT_POOL_FEE_PCT;
  const definityFeePct = numParam(params.get('definityFee')) ?? DEFAULT_DEFINITY_FEE_PCT;
  const netApyPct = numParam(params.get('apy')) ?? (typeof stats?.baseApyPct === 'number' ? stats.baseApyPct : null);
  const epochDays = numParam(params.get('epochDays')) ?? epochLen.days;

  return {
    tvlSol: numParam(params.get('tvl')) ?? (typeof stats?.totalSol === 'number' ? stats.totalSol : null),
    netApyPct,
    grossApyPct: netApyPct == null ? null : netApyPct / (1 - poolFeePct / 100),
    poolFeePct,
    definityFeePct,
    sanctumFeePct: Math.max(0, poolFeePct - definityFeePct),
    exchangeRate: typeof stats?.exchangeRate === 'number' && stats.exchangeRate > 0 ? stats.exchangeRate : 1,
    solUsd: numParam(params.get('sol')) ?? price.usd,
    solNzd: numParam(params.get('nzd')) ?? price.nzd,
    priceSource: price.source,
    priceUpdatedAt: price.updatedAt,
    epochDays,
    epochDaysSource: params.has('epochDays') ? 'override' : epochLen.source,
    epochsPerYear: YEAR_DAYS / epochDays,
    epochsPerMonth: MONTH_DAYS / epochDays,
    epoch: chainEpoch ?? stats?.gdi?.epoch ?? null,
    statsUpdatedAt: stats?.updatedAt ?? null,
  };
}
