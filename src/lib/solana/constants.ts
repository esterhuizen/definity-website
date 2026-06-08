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
