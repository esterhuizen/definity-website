// Solana constants for the /stake surface.
//
// definSOL is a SANCTUM multi-validator stake pool (program SPMBzsVU…), not a
// vanilla SPL stake pool — so we mint it by routing SOL→definSOL through
// Jupiter (which deposits via Sanctum), rather than hand-building a deposit
// instruction. See the /stake widget.

export const SOLANA_CHAIN = 'solana:mainnet' as const;

// Wrapped-SOL mint (Jupiter treats this as native SOL with wrapAndUnwrapSol).
export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const SOL_DECIMALS = 9;

// definSOL — Definity's LST (Sanctum multi-pool token mint).
export const DEFINSOL_MINT = 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA';
export const DEFINSOL_DECIMALS = 9;
export const DEFINSOL_SYMBOL = 'definSOL';

// Same-origin RPC proxy (keeps the upstream key server-side; see app/api/rpc).
export const RPC_PROXY_PATH = '/api/rpc';

// Jupiter swap API (public lite tier; CSP connect-src allows https:). The
// quote+swap build the SOL→definSOL transaction; the wallet signs & submits.
export const JUPITER_BASE = 'https://lite-api.jup.ag/swap/v1';
export const DEFAULT_SLIPPAGE_BPS = 50; // 0.50%

// Jupiter Recurring + Price APIs (keyless tier on api.jup.ag — lite-api is
// being phased out for new products). Power the Yield Streams feature:
// user-signed recurring orders that sell a yield-sized definSOL slice into a
// target token each cycle. Escrow lives in Jupiter's DCA program
// (DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M); we never hold funds.
export const JUPITER_RECURRING_BASE = 'https://api.jup.ag/recurring/v1';
export const JUPITER_PRICE_BASE = 'https://api.jup.ag/price/v3';

// Trailing-APY estimate used ONLY to size yield streams (the slice sold per
// cycle). Conservative; the un-escrowed principal keeps accruing regardless,
// and renewals re-size from live data. TODO: derive from the pool's
// exchange-rate history once the stats job records it.
export const DEFINSOL_APY_ESTIMATE = 0.065;

// Common payout tokens for yield streams.
export const PAYOUT_TOKENS = [
  { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
] as const;

// Jupiter Recurring hard minimums (enforced by their API; we pre-validate for
// friendlier UX): $100 total order value, $50 per cycle, at least 2 cycles.
export const RECURRING_MIN_TOTAL_USD = 105;   // small buffer over the $100 floor
export const RECURRING_MIN_CYCLE_USD = 55;    // small buffer over the $50 floor
