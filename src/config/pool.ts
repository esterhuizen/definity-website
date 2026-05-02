// Single source of truth for on-chain pool identifiers and external integration URLs.
// If addresses ever change, update only this file.

export const POOL = {
  name: 'Definity',
  lstSymbol: 'definSOL',
  lstName: 'Definity Liquid SOL',

  // Sourced from definity.finance/addresses
  stakePoolAddress: 'Bvbu55B991evqqhLtKcyTZjzQ4EQzRUwtf9T4CcpMmPL',
  lstMint: 'DEF1NXSZ8Th9n28hYBayrFtx9bj1EwwTiy3mhHEB9oyA',

  solMint: 'So11111111111111111111111111111111111111112',
} as const;

export const LINKS = {
  // Sanctum's deep-link pattern uses the LST ticker symbol (NOT the mint).
  sanctumLst: `https://app.sanctum.so/trade/SOL-${POOL.lstSymbol}`,
  // Jupiter swap pre-filled SOL → definSOL (mint addresses, query-string form).
  jupiterSwap: `https://jup.ag/swap?sell=${POOL.solMint}&buy=${POOL.lstMint}`,
  // Block explorers
  solscanPool: `https://solscan.io/account/${POOL.stakePoolAddress}`,
  solscanMint: `https://solscan.io/token/${POOL.lstMint}`,

  twitter: 'https://twitter.com/DefinityFinance',
  telegram: 'https://t.me/DefinityFinance',
  github: 'https://github.com/esterhuizen/definity-website',
  oldSite: 'https://definity.finance',

  // Validator whitelist application form. The /whitelist-apply page on this
  // site is a thin landing that opens this URL in a new tab. Replace this
  // placeholder with the real form URL (Tally / Google Forms / whatever you
  // already use) before going live — until then the CTA is disabled.
  // Example: 'https://forms.gle/abc123' or 'https://tally.so/r/your-form'
  applyForm: '',
} as const;

export const SITE = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://definity.finance',
  title: 'Definity — Stake SOL, grow the ecosystem where it matters most',
  description:
    'Definity is a Solana stake pool that turns staking yield into ecosystem growth in regions that need it most. Stake SOL, receive definSOL, keep your liquidity.',
} as const;
